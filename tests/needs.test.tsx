import { describe, expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { ago, canClaim, findSources, hashText, liveItems, parseRanked, rankPrompt, visible } from '../hooks/needs-core'
import { itemCard, summaryCard } from '../hooks/needs-card'
import { CLASSIC, pomoPalette } from '../hooks/pomo-theme'
import { findTheme } from '../hooks/themes'
import type { LiveSession, NeedItem } from '../types'

const NOW = 1_800_000_000_000

const item = (id: string, level: NeedItem['level'], at = NOW): NeedItem => ({ id, source: 'Gmail', title: id, why: 'x', level, at })

describe('needs core', () => {
  test('finds each kind of source from the tool list', async () => {
    const found = findSources(['mcp__94c3__list_events', 'mcp__94c3__list_calendars', 'mcp__g1__search_threads', 'mcp__s1__slack_search_public', 'mcp__u1__upwork__get_messages', 'Read'])
    expect(found.map(f => f.kind)).toEqual(['calendar', 'gmail', 'slack', 'upwork'])
    expect(found.map(f => f.server)).toEqual(['94c3', 'g1', 's1', 'u1'])
  })

  test('reads the ranked list out of a fenced reply and drops bad entries', async () => {
    const r = parseRanked('```json\n[{"id":"a","source":"Gmail","title":"Invoice","why":"due today","level":"now"},{"title":"x"}]\n```')
    expect(r.length).toBe(1)
    expect(r[0]?.level).toBe('now')
    expect(parseRanked('sorry')).toEqual([])
  })

  test('shows at most 7, now first, without done, hidden or snoozed items', async () => {
    const items = [
      item('n1', 'now'), item('n2', 'now'), item('n3', 'now'),
      item('t1', 'today'), item('t2', 'today'), item('t3', 'today'), item('t4', 'today'), item('t5', 'today'),
      item('h1', 'hidden'),
    ]
    const v = visible(items, { t1: NOW + 1 }, NOW, 'all')
    expect(v.shown.length).toBe(7)
    expect(v.shown.slice(0, 3).map(i => i.level)).toEqual(['now', 'now', 'now'])
    expect(v.shown.find(i => i.id === 't1')).toBe(undefined)
    expect(v.hidden).toBe(1)

    expect(visible(items, { n1: NOW - 1 }, NOW, 'all').shown.some(i => i.id === 'n1')).toBe(true)
    expect(visible(items, { n1: NOW + 1 }, NOW, 'all').shown.some(i => i.id === 'n1')).toBe(false)
    expect(visible(items, {}, NOW, 'now').shown.every(i => i.level === 'now')).toBe(true)
  })

  test('a waiting Claude session becomes a today item; old ones and this session do not', async () => {
    const s = (id: string, at: number): LiveSession => ({ id, title: 'my-app', state: 'waiting', at })
    const one = liveItems([s('a', NOW - 60_000)], 'me', NOW)
    expect(one.length).toBe(1)
    expect(one[0]?.level).toBe('today')
    expect(one[0]?.title).toBe('my-app is waiting for you')
    expect(liveItems([s('a', NOW - 7 * 3600_000)], 'me', NOW)).toEqual([])
    expect(liveItems([s('me', NOW)], 'me', NOW)).toEqual([])
  })

  test('lease, hash, age and the ranking prompt', async () => {
    expect(canClaim(undefined, 'me', 0)).toBe(true)
    expect(canClaim({ by: 'other', until: 100 }, 'me', 50)).toBe(false)
    expect(canClaim({ by: 'other', until: 100 }, 'me', 150)).toBe(true)
    expect(canClaim({ by: 'me', until: 100 }, 'me', 50)).toBe(true)

    expect(hashText('abc')).toBe(hashText('abc'))
    expect(hashText('abc')).not.toBe(hashText('abd'))

    expect(ago(0)).toBe('just now')
    expect(ago(180_000)).toBe('3 min ago')
    expect(ago(7_200_000)).toBe('2 h ago')

    const p = rankPrompt([{ source: 'Calendar', text: 'Design sync 10:30' }], NOW, ['Alex'])
    expect(p).toContain('meeting within 30 minutes')
    expect(p).toContain('JSON')
    expect(p).toContain('Alex')
  })
})

test('needs cards draw counts, titles and theme colours', async () => {
  const sum = summaryCard({ now: 2, today: 3, note: 'checked just now' }, CLASSIC)
  expect(sum).toContain('>5<')
  expect(sum).toContain('2 now')
  expect(sum).toContain('3 today')
  expect(sum).toContain('#e5484d')

  const card = itemCard({ id: 'a', source: 'Gmail', title: 'Invoice <today>', why: 'due', level: 'now' }, 0, CLASSIC, false)
  expect(card).toContain('Invoice &lt;today&gt;')
  expect(card).toContain('✉️')

  // A theme's own danger colour reaches the card.
  const aurora = pomoPalette(findTheme('aurora'))
  expect(aurora.alert.now).toBe('#d9475b')
  expect(summaryCard({ now: 1, today: 0, note: '' }, aurora)).toContain('#d9475b')
})

test('check fetches connected sources once, ranks with haiku, and respects the lease', async ($, on) => {
  const store = new Map<string, unknown>()
  const calls: string[] = []
  let ranks = 0
  let clock = NOW
  let gmailFails = false
  let me = 'a'
  on('clock.now', () => ({ value: clock }))
  on('session.id', () => ({ value: me }))
  on('ui.toast', () => ({ value: undefined }))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)

    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('tool.list', () => ({
    value: [
      { name: 'mcp__cal__list_events', description: '', mcp: true }, { name: 'mcp__cal__list_calendars', description: '', mcp: true },
      { name: 'mcp__gm__search_threads', description: '', mcp: true },
      { name: 'Read', description: '', mcp: false },
    ],
  }))
  on('mcp.call', (_, e) => {
    calls.push(`${e.server}:${e.tool}`)
    if (gmailFails && e.server === 'gm') return { value: { content: [{ type: 'text', text: 'offline' }], isError: true } }

    return { value: { content: [{ type: 'text', text: e.server === 'cal' ? 'Design sync 10:30' : 'Invoice from client' }], isError: false } }
  })
  on('model.complete', (_, e) => {
    ranks++
    expect(e.model).toBe('haiku')

    return { value: { isAnswered: true, text: '[{"id":"c1","source":"Calendar","title":"Design sync","why":"in 14 min","level":"now"}]', usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }
  })

  const check = async () => {
    await $.command.run({ command: 'needs', args: 'check', origin: { kind: 'sdk' as const }, presentation: { isFullscreen: false, columns: 80 } })

    return store.get('needs-result') as { items: unknown[]; checkedAt: number; failed: string[] } | undefined
  }
  // The clock tick checks only when this session can claim the round: run it as a tick would.
  const tick = async () => {
    await $.command.run({ command: 'needs', args: 'tick', origin: { kind: 'sdk' as const }, presentation: { isFullscreen: false, columns: 80 } })
  }

  const first = await check()
  expect(first?.items.length).toBe(1)
  expect(ranks).toBe(1)
  expect(calls).toEqual(['cal:list_events', 'gm:search_threads'])
  expect((store.get('needs-result') as { items: unknown[] }).items.length).toBe(1)

  // Another session inside the lease does not check on its tick.
  clock += 16 * 60_000
  me = 'b'
  store.set('needs-lease', { by: 'a', until: clock + 60_000 })
  const before = calls.length
  await tick()
  expect(calls.length).toBe(before)

  // Checking now, with the same text: no second ranking.
  const again = await check()
  expect(ranks).toBe(1)
  expect(again?.checkedAt).toBe(clock)

  // A source that throws is named, and the others still count.
  gmailFails = true
  const partial = await check()
  expect(partial?.failed).toEqual(['Gmail'])
})

const NEEDS_PANE = {
  plugin: 'themes-for-claude',
  component: 'Pane',
  requestId: 'needs-pane',
  props: { title: 'Needs you', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const runNeeds = (args: string) => ({ command: 'needs', args, origin: { kind: 'sdk' as const }, presentation: { isFullscreen: false, columns: 80 } })

function fakeStore(on: Parameters<TestBody>[1], seed: Record<string, unknown>) {
  const store = new Map<string, unknown>(Object.entries(seed))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)

    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    store.delete(e.key)

    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...store.keys()] }))

  return store
}

test('needs pane shows ranked items, done hides one, snooze brings it back after an hour', async ($, on) => {
  let clock = NOW
  on('clock.now', () => ({ value: clock }))
  on('session.id', () => ({ value: 'me' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.list', () => ({ value: [] }))
  const store = fakeStore(on, {
    'needs-result': {
      items: [
        { id: 'n1', source: 'Gmail', title: 'Invoice needed', why: 'due today', level: 'now', link: 'https://mail.google.com/x' },
        { id: 't1', source: 'Slack', title: 'Review the copy', why: 'asks you', level: 'today' },
        { id: 't2', source: 'Calendar', title: 'Design sync', why: 'invite', level: 'today' },
        { id: 'h1', source: 'Gmail', title: 'Newsletter', why: '', level: 'hidden' },
      ],
      checkedAt: NOW,
      hash: 'x',
      failed: [],
    },
  })
  await $.command.run(runNeeds(''))

  const ui = await $.ui.mount({ ...NEEDS_PANE, surface: 'desktop' })
  const cards = async () => (await ui.findAll({ type: 'Svg' })).length - 1
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('>3<')
  expect(await cards()).toBe(3)
  expect((await ui.find({ type: 'Link' }))?.props.href).toBe('https://mail.google.com/x')
  expect((await ui.find({ text: /1 hidden/ }))?.text).toContain('1 hidden')

  await ui.press({ key: 'needs-done-n1' })
  expect(await cards()).toBe(2)
  expect((store.get('needs-dismissed') as Record<string, number>).n1).toBeGreaterThan(NOW)

  await ui.press({ key: 'needs-snooze-t1' })
  expect(await cards()).toBe(1)
  clock += 61 * 60_000
  await ui.press({ key: 'needs-all' })
  expect(await cards()).toBe(2)
  await ui.unmount()

  const term = await $.ui.mount({ ...NEEDS_PANE, surface: 'terminal' })
  expect((await term.find({ text: /Review the copy/ }))?.text).toContain('Review the copy')
  await term.unmount()
})

test('with nothing checked and no apps connected, the pane says how to start', async ($, on) => {
  on('clock.now', () => ({ value: NOW }))
  on('session.id', () => ({ value: 'me' }))
  on('tool.list', () => ({ value: [] }))
  fakeStore(on, {})

  const ui = await $.ui.mount({ ...NEEDS_PANE, surface: 'desktop' })
  expect((await ui.find({ text: /Connect Gmail, Slack or Calendar/ }))?.text).toContain('Connect Gmail, Slack or Calendar')
  await ui.unmount()
})

test('a session reports waiting on a permission ask, and idle or waiting after a turn', async ($, on) => {
  on('clock.now', () => ({ value: NOW }))
  on('session.id', () => ({ value: 's1' }))
  on('session.cwd', () => ({ value: '/Users/x/Workspace/my-app' }))
  on('tool.check', () => ({ decision: 'ask' }))
  on('turn.complete', () => ({ text: '' }))
  const store = fakeStore(on, {})
  const live = () => store.get('live:s1') as { state: string; title: string; note?: string } | undefined

  await $.tool.check({ tool: 'Bash', input: { command: 'deploy' } })
  expect(live()?.state).toBe('waiting')
  expect(live()?.title).toBe('my-app')
  expect(live()?.note).toBe('Asks to approve Bash')

  const turn = (answer: string) => ({ answer, durationMs: 1, isAborted: false, turnId: 't', reason: 'end_turn', category: null, explanation: null, text: answer }) as never
  await $.turn.complete(turn('All done.'))
  expect(live()?.state).toBe('idle')
  await $.turn.complete(turn('Should I deploy it now?'))
  expect(live()?.state).toBe('waiting')
})
