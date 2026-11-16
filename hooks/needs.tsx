import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, Timer } from 'claude-code'

import { THEMES } from '../themes'
import type { Dismissed, LiveSession, NeedItem, NeedsResult } from '../types'
import { itemCard, summaryCard } from './needs-card'
import { SNOOZE_MS, ago, findSources, liveItems, visible } from './needs-core'
import { checkNeeds, readLive } from './needs-sources'
import { pomoPalette } from './pomo-theme'
import { findTheme } from './themes'

// The Needs you pane: what needs the person across their connected apps and
// Claude sessions, ranked, in the Pomodoro widget's style. Each session also
// reports its own state (working, waiting for you, idle) for the others.

export const NEEDS_PANE = 'needs-pane'
const TITLE = 'Needs you'
const EMPTY: NeedsResult = { items: [], checkedAt: 0, hash: '', failed: [] }
const DEFAULT_INTERVAL_MIN = 15
const DONE_MS = 7 * 24 * 3600_000

const resultAtom = atom({ plugin: 'themes-for-claude', key: 'needsResult' } as const, EMPTY, { shape: 'needs-result-1' })
const dismissedAtom = atom({ plugin: 'themes-for-claude', key: 'needsDismissed' } as const, {} as Dismissed, { shape: 'needs-dismissed-1' })
const filterAtom = atom({ plugin: 'themes-for-claude', key: 'needsFilter' } as const, 'all' as 'all' | 'now')
const liveAtom = atom({ plugin: 'themes-for-claude', key: 'needsLive' } as const, [] as LiveSession[], { shape: 'needs-live-1' })
const vipsAtom = atom({ plugin: 'themes-for-claude', key: 'needsVips' } as const, [] as string[], { shape: 'needs-vips-1' })
const editingAtom = atom({ plugin: 'themes-for-claude', key: 'needsEditing' } as const, false)
const tickAtom = atom({ plugin: 'themes-for-claude', key: 'needsTick' } as const, 0)
const themeAtom = atom({ plugin: 'themes-for-claude', key: 'themeId' } as const, THEMES[0]?.id ?? '')

let ticker: Timer | undefined
let intervalMs = DEFAULT_INTERVAL_MIN * 60_000
/** A check running in this session; a second one waits for the next round. */
let isChecking = false

/** Brings the shared store into this session's values. */
export async function loadNeeds($: EngineInterface): Promise<void> {
  const result = (await $.store.get('needs-result')) as NeedsResult | undefined
  const dismissed = (await $.store.get('needs-dismissed')) as Dismissed | undefined
  const vips = (await $.store.get('needs-vips')) as string[] | undefined

  if (result !== undefined && Array.isArray(result.items)) await update($, resultAtom, () => result)
  if (dismissed !== undefined && typeof dismissed === 'object') await update($, dismissedAtom, () => dismissed)
  if (Array.isArray(vips)) await update($, vipsAtom, () => vips)
  const live = await readLive($)
  await update($, liveAtom, () => live)
}

/** Checks, shows the result, and sends one notification for "now" items not notified before. */
export async function checkAndShow($: EngineInterface, force: boolean): Promise<string> {
  if (isChecking) return 'Already checking.'
  isChecking = true

  try {
    const me = await $.session.id()
    const result = await checkNeeds($, { me, force, vips: await read($, vipsAtom) })

    if (result === undefined) {
      await loadNeeds($)

      return 'Another session checked this round.'
    }
    await update($, resultAtom, () => result)
    await notifyNew($, result.items)
    const shown = result.items.filter(i => i.level !== 'hidden').length

    return `${shown} item${shown === 1 ? '' : 's'} need you.${result.failed.length > 0 ? ` Couldn't read: ${result.failed.join(', ')}.` : ''}`
  } finally {
    isChecking = false
  }
}

/** One desktop notification for the "now" items not notified yet and not cleared. */
async function notifyNew($: EngineInterface, items: NeedItem[]): Promise<void> {
  const now = await $.clock.now()
  const sent = ((await $.store.get('needs-notified')) as Record<string, number> | undefined) ?? {}
  const dismissed = ((await $.store.get('needs-dismissed')) as Dismissed | undefined) ?? {}
  const fresh = visible(items, dismissed, now, 'now').shown.filter(i => sent[i.id] === undefined)

  if (fresh.length > 0) {
    const text = fresh.length === 1 ? `${fresh[0]?.source}: ${fresh[0]?.title}` : `${fresh.length} new things need you: ${fresh.map(i => i.title).join(', ')}`
    void $.ui.notify(text, { title: 'Needs you', key: 'needs-now' }).catch(() => undefined)
  }
  // Keep a week of what was sent.
  const keep = Object.fromEntries(Object.entries(sent).filter(([, at]) => now - at < DONE_MS))
  for (const i of fresh) keep[i.id] = now
  await $.store.set('needs-notified', keep)
}

/** Needs you reads apps and spends tokens only once someone opened /needs on this Mac. */
async function isEnabled($: EngineInterface): Promise<boolean> {
  return (await $.store.get('needs-enabled')) === true || (await $.store.get('needs-result')) !== undefined
}

/** Every minute: pick up other sessions' work, and check when the last check is old. */
export async function needsTick($: EngineInterface): Promise<void> {
  await loadNeeds($)
  if (!(await isEnabled($))) return
  const last = await read($, resultAtom)

  if ((await $.clock.now()) - last.checkedAt >= intervalMs) await checkAndShow($, false)
  await update($, tickAtom, n => n + 1)
}

export async function openNeeds($: EngineInterface) {
  return $.ui.open({ id: NEEDS_PANE, title: TITLE })
}

export async function startNeeds($: EngineInterface, options: Record<string, unknown>): Promise<void> {
  const minutes = Number(options.needsInterval)
  intervalMs = (Number.isFinite(minutes) && minutes >= 5 ? minutes : DEFAULT_INTERVAL_MIN) * 60_000
  await $.command.register({ name: 'needs', description: 'Open the Needs you pane; /needs check checks your apps now' })
  await loadNeeds($)
  ticker?.cancel()
  ticker = $.clock.every(60_000, () => void needsTick($))
  if (options.openNeeds !== false && (await isEnabled($))) void openNeeds($)
}

/** This session's own report for the others, under `live:<id>`. */
export async function reportLive($: EngineInterface, state: LiveSession['state'], note?: string): Promise<void> {
  const id = await $.session.id()
  const cwd = String(await $.session.cwd())
  const title = cwd.split('/').filter(Boolean).at(-1) ?? 'Claude'
  const entry: LiveSession = { id, title, state, at: await $.clock.now(), ...(note === undefined ? {} : { note }) }

  await $.store.set(`live:${id}`, entry)
}

/** A tool runs after an approval: the session is working again, no longer waiting. */
async function backToWork($: EngineInterface): Promise<void> {
  const mine = (await $.store.get(`live:${await $.session.id()}`)) as LiveSession | undefined

  if (mine?.state === 'waiting') await reportLive($, 'working')
}

/** After a main-loop turn: waiting when it ended on a question, else idle. Called from usage.tsx's turn.complete hook. */
export async function reportTurn($: EngineInterface, turn: { agentId?: string; answer: string }): Promise<void> {
  if (turn.agentId !== undefined) return
  const isQuestion = /\?\s*$/.test(turn.answer.trim())

  await reportLive($, isQuestion ? 'waiting' : 'idle', isQuestion ? 'Asked you a question' : undefined).catch(() => undefined)
}

/** Done (a week) and snooze (an hour), merged with what other sessions dismissed meanwhile. */
async function saveDismissed($: EngineInterface, id: string, until: number): Promise<void> {
  const now = await $.clock.now()
  const shared = ((await $.store.get('needs-dismissed')) as Dismissed | undefined) ?? {}
  const merged = Object.fromEntries(Object.entries({ ...(await read($, dismissedAtom)), ...shared, [id]: until }).filter(([, t]) => t > now))
  await update($, dismissedAtom, () => merged)
  await $.store.set('needs-dismissed', merged)
}

function hostOf(link: string): string {
  try {
    return new URL(link).hostname
  } catch {
    return 'Open'
  }
}

async function saveVips($: EngineInterface, text: string): Promise<void> {
  const vips = text.split(',').map(v => v.trim()).filter(v => v !== '').slice(0, 12)
  await update($, vipsAtom, () => vips)
  await update($, editingAtom, () => false)
  await $.store.set('needs-vips', vips)
}

async function setFilter($: EngineInterface, filter: 'all' | 'now'): Promise<void> {
  await update($, filterAtom, () => filter)
  await update($, tickAtom, n => n + 1)
}

export function registerNeeds(on: On): void {
  on('command.run', { command: 'needs' }, async ($, e) => {
    const arg = e.args.trim()

    if (arg !== 'tick') await $.store.set('needs-enabled', true)
    if (arg === 'check') return { text: await checkAndShow($, true) }

    if (arg === 'tick') {
      await needsTick($)

      return { text: 'Needs you: checked the round.' }
    }
    await loadNeeds($)
    await openNeeds($)

    return { text: 'Needs you pane opened. /needs check checks your apps now.' }
  })

  // ---- Each session tells the others what it is doing ----
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await reportLive($, 'working').catch(() => undefined)

    return next(e)
  })

  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)

    if (verdict.decision === 'ask' && e.agentId === undefined) {
      await reportLive($, 'waiting', `Asks to approve ${e.tool.replace(/^mcp__.+?__/, '')}`).catch(() => undefined)
    }

    return verdict
  })

  // Back to work after an approval: no longer waiting.
  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) await backToWork($).catch(() => undefined)

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await $.store.delete(`live:${await $.session.id()}`).catch(() => undefined)

    return next(e)
  })

  // ---- The pane ----
  on('ui.render', { component: 'Pane', requestId: NEEDS_PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text, Button, Input } = elements
    const Svg = e.surface !== 'terminal' && 'Svg' in elements ? elements.Svg : undefined
    const Link = 'Link' in elements ? elements.Link : undefined
    const result = await read($, resultAtom)
    const dismissed = await read($, dismissedAtom)
    const filter = await read($, filterAtom)
    const live = await read($, liveAtom)
    const isEditing = await read($, editingAtom)
    const vips = await read($, vipsAtom)
    const palette = pomoPalette(findTheme(await read($, themeAtom)))
    await read($, tickAtom)
    const now = await $.clock.now()
    const me = await $.session.id()

    const all: NeedItem[] = [...result.items, ...liveItems(live, me, now)]
    const { shown, hidden, counts } = visible(all, dismissed, now, filter)
    const nowCount = counts.now
    const total = counts.now + counts.today
    const note = result.checkedAt === 0 ? 'not checked yet' : `checked ${ago(now - result.checkedAt)}`
    // Whether any app is connected: from the last check, or from the tool list before the first.
    const hasSources =
      result.checkedAt > 0 && result.sources !== undefined
        ? result.sources.length > 0
        : findSources((await $.tool.list()).filter(t => t.mcp).map(t => t.name)).length > 0

    const controls = (
      <Box flexDirection="row" gap={1} justifyContent="center" alignItems="center">
        <Button key="needs-check" label="↻ Check now" variant="primary" hotkey="c" onPress={() => void checkAndShow($, true)} />
        <Button key="needs-all" label="All" variant={filter === 'all' ? 'primary' : 'secondary'} onPress={() => void setFilter($, 'all')} />
        <Button key="needs-now" label="🔴 Now" variant={filter === 'now' ? 'primary' : 'secondary'} onPress={() => void setFilter($, 'now')} />
        <Button key="needs-vip" label="⚙" plain dimColor onPress={() => void update($, editingAtom, v => !v)} />
      </Box>
    )
    const vipRow = isEditing ? (
      <Box flexDirection="column" gap={1} width="100%" paddingX={1}>
        <Text dimColor>People whose messages always come first, separated by commas</Text>
        <Input key="needs-vip-input" placeholder="Alex, Sam, client@example.com" submitLabel="save" value={vips.join(', ')} onSubmit={value => void saveVips($, value)} />
      </Box>
    ) : undefined

    const actions = (i: NeedItem) => (
      <Box key={`needs-act-${i.id}`} flexDirection="row" gap={1} justifyContent="center" alignItems="center">
        {i.link !== undefined && Link !== undefined && <Link href={i.link} label={`↗ ${hostOf(i.link)}`} />}
        <Button key={`needs-done-${i.id}`} label="✓ Done" plain onPress={() => void saveDismissed($, i.id, now + DONE_MS)} />
        <Button key={`needs-snooze-${i.id}`} label="⏰ 1h" plain dimColor onPress={() => void saveDismissed($, i.id, now + SNOOZE_MS)} />
      </Box>
    )
    const footer = [
      hidden > 0 ? `${hidden} hidden: newsletters and notifications` : '',
      result.failed.length > 0 ? `Couldn't read: ${result.failed.join(', ')}` : '',
      result.error ?? '',
    ].filter(t => t !== '')
    const connect = hasSources ? '' : 'Connect Gmail, Slack or Calendar to start. Claude sessions waiting for you show here too.'
    const empty = !hasSources
      ? ''
      : shown.length === 0
        ? result.checkedAt === 0
          ? 'Press ↻ Check now to look through your apps.'
          : 'All clear. Nothing needs you right now.'
        : ''

    // ---- Desktop, mobile and the editor: picture cards ----
    if (Svg !== undefined) {
      return (
        <Box flexDirection="column" gap={1} alignItems="center">
          <Svg source={summaryCard({ now: nowCount, today: counts.today, note }, palette)} alt={`${total} things need you, ${nowCount} now. ${note}.`} />
          {controls}
          {vipRow}
          {connect !== '' && <Text dimColor>{connect}</Text>}
          {empty !== '' && <Text dimColor>{empty}</Text>}
          {shown.map(i => (
            <Box key={`needs-item-${i.id}`} flexDirection="column" alignItems="center">
              <Svg source={itemCard(i, now, palette)} alt={`${i.level === 'now' ? 'Now' : 'Today'}: ${i.source}, ${i.title}. ${i.why}`} />
              {actions(i)}
            </Box>
          ))}
          {footer.map(t => (
            <Text key={`needs-foot-${t}`} dimColor>
              {t}
            </Text>
          ))}
        </Box>
      )
    }

    // ---- The terminal: text ----
    return (
      <Box flexDirection="column" gap={1} paddingX={1}>
        <Text weight="semibold">{`NEEDS YOU · ${total}  (${nowCount} now) · ${note}`}</Text>
        {controls}
        {vipRow}
        {connect !== '' && <Text dimColor>{connect}</Text>}
        {empty !== '' && <Text dimColor>{empty}</Text>}
        {shown.map(i => (
          <Box key={`needs-item-${i.id}`} flexDirection="column">
            <Text color={i.level === 'now' ? 'error' : 'warning'}>{`● ${i.title}`}</Text>
            <Text dimColor>{`  ${i.source} · ${i.why}`}</Text>
            {actions(i)}
          </Box>
        ))}
        {footer.map(t => (
          <Text key={`needs-foot-${t}`} dimColor>
            {t}
          </Text>
        ))}
      </Box>
    )
  })
}
