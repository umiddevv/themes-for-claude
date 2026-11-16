import type { EngineInterface } from 'claude-code'

import type { LiveSession, NeedItem, NeedsResult } from '../types'
import { canClaim, findSources, hashText, parseRanked, pruneLive, rankPrompt } from './needs-core'
import type { FoundSource, SourceKind } from './needs-core'

// One Needs you check: read each connected app through its MCP tools, rank
// the text with a small model, and keep the result in $.store for every
// session. One session checks per round, by a lease in the store.

export const LEASE_MS = 14 * 60_000
const CAP = 6000
const CALL_TIMEOUT_MS = 30_000
const MODEL_TIMEOUT_MS = 90_000

export const NAME: Record<SourceKind, string> = { calendar: 'Calendar', gmail: 'Gmail', slack: 'Slack', upwork: 'Upwork' }
const GMAIL_QUERY = 'is:unread in:inbox -category:promotions -category:social -category:updates newer_than:1d'

function textOf(r: { content: { type: string; text?: string }[]; isError: boolean }): string {
  if (r.isError) throw new Error(r.content.map(b => b.text ?? '').join(' ') || 'the tool reported an error')

  return r.content.map(b => (b.type === 'text' ? (b.text ?? '') : '')).join('\n')
}

/** Rejects after `ms`; where the clock can't sleep, it never settles (no timeout rather than a false one). */
async function timeout($: EngineInterface, ms: number): Promise<never> {
  try {
    await $.clock.sleep(ms)
  } catch {
    return new Promise<never>(() => undefined)
  }
  throw new Error(`no answer in ${ms / 1000} s`)
}

async function call($: EngineInterface, s: FoundSource, tool: string, args: Record<string, unknown>): Promise<string> {
  const result = await Promise.race([$.mcp.call(s.server, tool, args), timeout($, CALL_TIMEOUT_MS)])

  return textOf(result as never)
}

/** Reads one source as plain text for the ranking model. */
export async function readSource($: EngineInterface, s: FoundSource): Promise<string> {
  if (s.kind === 'calendar') return call($, s, 'list_events', { pageSize: 10, orderBy: 'startTime' })

  if (s.kind === 'gmail') {
    const tool = ['search_threads', 'search_messages', 'list_messages', 'list_threads'].find(t => s.tools.includes(t)) ?? 'search_threads'

    return call($, s, tool, { query: GMAIL_QUERY })
  }

  if (s.kind === 'slack') {
    const tool = s.tools.includes('slack_search_public_and_private') ? 'slack_search_public_and_private' : 'slack_search_public'

    return call($, s, tool, { query: 'to:me after:yesterday' })
  }

  // Upwork: the org first, then the message rooms.
  const accounts = await call($, s, 'upwork__list_accounts', {})
  const org = /"?org_uid"?\s*[:=]\s*"?([\w~.-]+)/.exec(accounts)?.[1] ?? /"?uid"?\s*[:=]\s*"?([\w~.-]+)/.exec(accounts)?.[1]
  if (org === undefined) throw new Error('no Upwork org found')

  return call($, s, 'upwork__get_messages', { action: 'list_rooms', org_uid: org })
}

/** Every session's own report, from the `live:` keys; with `prune`, entries gone for 6 h are deleted. */
export async function readLive($: EngineInterface, prune = false): Promise<LiveSession[]> {
  const keys = (await $.store.keys()).filter(k => k.startsWith('live:'))
  const live: LiveSession[] = []

  for (const k of keys) {
    const v = (await $.store.get(k)) as LiveSession | undefined
    if (v !== undefined && typeof v.id === 'string') live.push(v)
  }
  const { keep, drop } = pruneLive(live, await $.clock.now())

  if (prune) {
    for (const id of drop) await $.store.delete(`live:${id}`)
  }

  return keep
}

export async function checkNeeds($: EngineInterface, opts: { me: string; force: boolean; vips: string[] }): Promise<NeedsResult | undefined> {
  const now = await $.clock.now()
  const lease = (await $.store.get('needs-lease')) as { by: string; until: number } | undefined
  if (!opts.force && !canClaim(lease, opts.me, now)) return undefined
  await $.store.set('needs-lease', { by: opts.me, until: now + LEASE_MS })

  const last = (await $.store.get('needs-result')) as NeedsResult | undefined
  const found = findSources((await $.tool.list()).filter(t => t.mcp).map(t => t.name))
  const sources = found.map(s => NAME[s.kind])
  const texts: { source: string; text: string }[] = []
  const failed: string[] = []
  const failedWhy: Record<string, string> = {}

  for (const s of found) {
    try {
      texts.push({ source: NAME[s.kind], text: (await readSource($, s)).slice(0, CAP) })
    } catch (err) {
      failed.push(NAME[s.kind])
      failedWhy[NAME[s.kind]] = err instanceof Error ? err.message : String(err)
    }
  }
  await readLive($, true)
  // A failed app keeps the items it had, so a blip neither hides them nor notifies them again.
  const kept: NeedItem[] = (last?.items ?? []).filter(i => failed.includes(i.source))
  const base = { checkedAt: now, failed, sources, ...(failed.length > 0 ? { failedWhy } : {}) }
  const hash = hashText(JSON.stringify(texts))
  let result: NeedsResult

  if (found.length === 0) {
    result = { items: [], hash, ...base }
  } else if (texts.length === 0) {
    result = { items: last?.items ?? [], hash: last?.hash ?? '', ...base, error: `Couldn't read any app this round` }
  } else if (last !== undefined && last.hash === hash && last.error === undefined) {
    result = { ...last, ...base, items: [...last.items.filter(i => !failed.includes(i.source)), ...kept] }
  } else {
    const raw = Object.fromEntries(texts.map(t => [t.source, t.text]))
    const reply = await $.model.complete({ model: 'haiku', prompt: rankPrompt(texts, now, opts.vips), maxTokens: 4000, timeoutMs: MODEL_TIMEOUT_MS })
    const items = reply.isAnswered ? parseRanked(reply.text, raw) : []
    const isEmptyAnswer = reply.isAnswered && /^\s*(```\w*\s*)?\[\s*\](\s*```)?\s*$/.test(reply.text)

    result =
      items.length > 0 || isEmptyAnswer
        ? { items: [...items, ...kept], hash, ...base }
        : { items: last?.items ?? [], hash, ...base, error: reply.isAnswered ? 'Could not read the ranking' : `Ranking failed (${reply.reason})` }
  }
  await $.store.set('needs-result', result)

  return result
}
