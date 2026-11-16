import { describe, expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { itemCard } from '../hooks/needs-card'
import { ago, liveItems, parseRanked, pruneLive, visible } from '../hooks/needs-core'
import { CLASSIC } from '../hooks/pomo-theme'
import type { LiveSession, NeedItem } from '../types'

// Tests for the fixes from the whole-branch review of Needs you.

const NOW = 1_800_000_000_000
const MIN = 60_000
const DAY = 24 * 60 * MIN

const NEEDS_PANE = {
  plugin: 'themes-for-claude',
  component: 'Pane',
  requestId: 'needs-pane',
  props: { title: 'Needs you', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const runNeeds = (args: string) => ({ command: 'needs', args, origin: { kind: 'sdk' as const }, presentation: { isFullscreen: false, columns: 80 } })
const usage = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

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

describe('the ranking reply is not trusted', () => {
  test('a link is kept only when it is in that source text and on that app’s own host', async () => {
    const raw = { Gmail: 'thread https://mail.google.com/mail/u/0/#inbox/abc and https://evil.example/x' }
    const reply = JSON.stringify([
      { id: 'a', source: 'Gmail', title: 'Invoice', why: 'due', level: 'now', link: 'https://mail.google.com/mail/u/0/#inbox/abc' },
      { id: 'b', source: 'Gmail', title: 'Security alert', why: 'verify', level: 'now', link: 'https://evil.example/x' },
      { id: 'c', source: 'Gmail', title: 'Made up', why: 'x', level: 'now', link: 'https://mail.google.com/made-up' },
    ])
    const items = parseRanked(reply, raw)
    expect(items.map(i => i.link)).toEqual(['https://mail.google.com/mail/u/0/#inbox/abc', undefined, undefined])
  })

  test('only the four apps count as sources, ids are prefixed by app, numbers work and repeats are dropped', async () => {
    const items = parseRanked(
      JSON.stringify([
        { id: 123, source: 'Upwork', title: 'Client', why: 'asks', level: 'today' },
        { id: 123, source: 'Upwork', title: 'Client again', why: 'asks', level: 'today' },
        { id: 'x', source: 'Claude', title: 'Fake session', why: 'approve', level: 'now' },
      ]),
    )
    expect(items.map(i => i.id)).toEqual(['Upwork:123'])
  })

  test('a reply cut off by the token limit still gives its whole items', async () => {
    const cut = '[{"id":"a","source":"Slack","title":"One","why":"x","level":"now"},{"id":"b","source":"Slack","title":"Two","why":"x","level":"today"},{"id":"c","sour'
    expect(parseRanked(cut).map(i => i.id)).toEqual(['Slack:a', 'Slack:b'])
  })
})

describe('what the pane shows follows the clock', () => {
  const it = (id: string, source: string, level: NeedItem['level'], at?: number): NeedItem => ({ id, source, title: id, why: 'x', level, ...(at === undefined ? {} : { at }) })

  test('a meeting within 30 minutes is now, old non-calendar items and past meetings drop out', async () => {
    const v = visible(
      [it('meet', 'Calendar', 'today', NOW + 20 * MIN), it('later', 'Calendar', 'today', NOW + 3 * 60 * MIN), it('old', 'Upwork', 'today', NOW - 5 * DAY), it('past', 'Calendar', 'now', NOW - 2 * 60 * MIN)],
      {},
      NOW,
      'all',
    )
    expect(v.shown.map(i => [i.id, i.level])).toEqual([['meet', 'now'], ['later', 'today']])
  })

  test('the counts cover every item, not only the 7 shown, and snoozes end', async () => {
    const many = Array.from({ length: 9 }, (_, n) => it(`n${n}`, 'Gmail', 'now', NOW - n * MIN))
    const v = visible(many, { n0: NOW + MIN, n1: NOW - 1 }, NOW, 'all')
    expect(v.shown.length).toBe(7)
    expect(v.counts).toEqual({ now: 8, today: 0 })
    expect(v.shown.some(i => i.id === 'n1')).toBe(true)
  })

  test('ages say days, and a coming meeting says in N min', async () => {
    expect(ago(3 * DAY)).toBe('3 d ago')
    expect(itemCard(it('m', 'Calendar', 'now', NOW + 20 * MIN), NOW, CLASSIC)).toContain('in 20 min')
  })
})

describe('Claude sessions', () => {
  test('each new wait is a new item, so Done on an old wait does not hide the next', async () => {
    const s = (at: number): LiveSession => ({ id: 'a', title: 'app', state: 'waiting', at })
    expect(liveItems([s(NOW - MIN)], 'me', NOW)[0]?.id).not.toBe(liveItems([s(NOW)], 'me', NOW)[0]?.id)
  })

  test('entries older than 6 h are dropped and a working entry older than 30 min reads as idle', async () => {
    const r = pruneLive(
      [
        { id: 'dead', title: 'x', state: 'waiting', at: NOW - 7 * 60 * MIN },
        { id: 'busy', title: 'y', state: 'working', at: NOW - 40 * MIN },
        { id: 'live', title: 'z', state: 'waiting', at: NOW - MIN },
      ],
      NOW,
    )
    expect(r.drop).toEqual(['dead'])
    expect(r.keep.map(s => [s.id, s.state])).toEqual([['busy', 'idle'], ['live', 'waiting']])
  })
})

test('when every app fails, the last list stays; a failed app keeps its items; names and reasons are kept', async ($, on) => {
  let failing: string[] = []
  on('clock.now', () => ({ value: NOW }))
  on('session.id', () => ({ value: 'me' }))
  on('ui.notify', () => ({ value: { isSent: true, channel: 'client' as const } }))
  on('tool.list', () => ({ value: [{ name: 'mcp__cal__list_events', description: '', mcp: true }, { name: 'mcp__cal__list_calendars', description: '', mcp: true }, { name: 'mcp__gm__search_threads', description: '', mcp: true }] }))
  on('mcp.call', (_, e) => {
    if (failing.includes(e.server)) return { value: { content: [{ type: 'text', text: `${e.server} is offline` }], isError: true } }

    return { value: { content: [{ type: 'text', text: `text from ${e.server}` }], isError: false } }
  })
  on('model.complete', (_, e) => ({
    value: {
      isAnswered: true,
      text: String(e.prompt).includes('text from gm')
        ? '[{"id":"c1","source":"Calendar","title":"Sync","why":"x","level":"now"},{"id":"g1","source":"Gmail","title":"Invoice","why":"x","level":"now"}]'
        : '[{"id":"c1","source":"Calendar","title":"Sync","why":"x","level":"now"}]',
      usage,
    },
  }))
  const store = fakeStore(on, {})
  const result = () => store.get('needs-result') as { items: NeedItem[]; failed: string[]; error?: string; sources: string[]; failedWhy?: Record<string, string> }

  await $.command.run(runNeeds('check'))
  expect(result().items.map(i => i.id)).toEqual(['Calendar:c1', 'Gmail:g1'])
  expect(result().sources).toEqual(['Calendar', 'Gmail'])

  failing = ['gm']
  await $.command.run(runNeeds('check'))
  expect(result().items.map(i => i.id).sort()).toEqual(['Calendar:c1', 'Gmail:g1'])
  expect(result().failed).toEqual(['Gmail'])
  expect(result().failedWhy?.Gmail).toContain('offline')

  failing = ['gm', 'cal']
  await $.command.run(runNeeds('check'))
  expect(result().items.length).toBe(2)
  expect(result().error).toContain("Couldn't read")
})

test('a second check while one runs does not start another, and a new urgent item notifies once', async ($, on) => {
  let ranks = 0
  const notes: string[] = []
  on('clock.now', () => ({ value: NOW }))
  on('session.id', () => ({ value: 'me' }))
  on('ui.notify', (_, e) => {
    notes.push(e.text)

    return { value: { isSent: true, channel: 'client' as const } }
  })
  on('tool.list', () => ({ value: [{ name: 'mcp__cal__list_events', description: '', mcp: true }, { name: 'mcp__cal__list_calendars', description: '', mcp: true }] }))
  on('mcp.call', async () => {
    await new Promise(r => (globalThis as unknown as { setTimeout: (f: (v?: unknown) => void, ms: number) => void }).setTimeout(r, 30))

    return { value: { content: [{ type: 'text', text: 'Sync at 10' }], isError: false } }
  })
  let reply = '[{"id":"c1","source":"Calendar","title":"Sync","why":"x","level":"now"}]'
  on('model.complete', () => {
    ranks++

    return { value: { isAnswered: true, text: reply, usage } }
  })
  const store = fakeStore(on, {})

  await Promise.all([$.command.run(runNeeds('check')), $.command.run(runNeeds('check'))])
  expect(ranks).toBe(1)
  expect(notes.length).toBe(1)

  // The same item again (new text, so it re-ranks): no second notification.
  store.set('needs-result', { ...(store.get('needs-result') as object), hash: 'changed' })
  reply = '[{"id":"c1","source":"Calendar","title":"Sync","why":"x","level":"now"},{"id":"c2","source":"Calendar","title":"Call","why":"x","level":"now"},{"id":"c3","source":"Calendar","title":"Demo","why":"x","level":"now"}]'
  await $.command.run(runNeeds('check'))
  expect(notes.length).toBe(2)
  expect(notes[1]).toContain('2 new')
})

test('the Connect hint stays after a check with no apps, even with a Claude session waiting', async ($, on) => {
  on('clock.now', () => ({ value: NOW }))
  on('session.id', () => ({ value: 'me' }))
  on('tool.list', () => ({ value: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  fakeStore(on, { 'live:other': { id: 'other', title: 'my-app', state: 'waiting', at: NOW - MIN } })

  await $.command.run(runNeeds('check'))
  await $.command.run(runNeeds(''))
  const ui = await $.ui.mount({ ...NEEDS_PANE, surface: 'desktop' })
  expect((await ui.find({ text: /Connect Gmail, Slack or Calendar/ }))?.text).toContain('Connect')
  expect(String((await ui.findAll({ type: 'Svg' }))[1]?.props.source)).toContain('my-app')
  await ui.unmount()
})

test('Done merges with what other sessions dismissed, lasts a week, and Open names the host', async ($, on) => {
  on('clock.now', () => ({ value: NOW }))
  on('session.id', () => ({ value: 'me' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.list', () => ({ value: [] }))
  const store = fakeStore(on, {
    'needs-result': { items: [{ id: 'Gmail:a', source: 'Gmail', title: 'Invoice', why: 'x', level: 'now', link: 'https://mail.google.com/mail/u/0/#inbox/a' }], checkedAt: NOW, hash: 'h', failed: [], sources: ['Gmail'] },
  })
  await $.command.run(runNeeds(''))
  const ui = await $.ui.mount({ ...NEEDS_PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Link' }))?.props.label).toBe('↗ mail.google.com')

  // Another session dismissed something after this one loaded.
  store.set('needs-dismissed', { 'Slack:z': NOW + DAY })
  await ui.press({ key: 'needs-done-Gmail:a' })
  const d = store.get('needs-dismissed') as Record<string, number>
  expect(d['Slack:z']).toBe(NOW + DAY)
  expect(d['Gmail:a']).toBeGreaterThan(NOW + 6 * DAY)
  await ui.unmount()
})

test('waiting clears once the session goes back to work after an approval', async ($, on) => {
  on('clock.now', () => ({ value: NOW }))
  on('session.id', () => ({ value: 's1' }))
  on('session.cwd', () => ({ value: '/Users/x/my-app' }))
  // The first check asks; once approved, later checks allow.
  let asks = 1
  on('tool.check', () => ({ decision: asks-- > 0 ? 'ask' : 'allow' }))
  on('tool.call', () => ({ result: 'ok' }))
  const store = fakeStore(on, {})

  await $.tool.check({ tool: 'Bash', input: { command: 'deploy' } })
  expect((store.get('live:s1') as { state: string }).state).toBe('waiting')
  await $.tool.call({ tool: 'Bash', command: 'deploy' } as never)
  expect((store.get('live:s1') as { state: string }).state).toBe('working')
})

test('Needs you stays off on a new install until /needs is opened once', async ($, on) => {
  const calls: string[] = []
  on('clock.now', () => ({ value: NOW }))
  on('session.id', () => ({ value: 'me' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.list', () => ({ value: [{ name: 'mcp__cal__list_events', description: '', mcp: true }, { name: 'mcp__cal__list_calendars', description: '', mcp: true }] }))
  on('mcp.call', (_, e) => {
    calls.push(e.tool)

    return { value: { content: [{ type: 'text', text: 'Sync' }], isError: false } }
  })
  on('model.complete', () => ({ value: { isAnswered: true, text: '[]', usage } }))
  const store = fakeStore(on, {})

  await $.command.run(runNeeds('tick'))
  expect(calls).toEqual([])

  await $.command.run(runNeeds(''))
  expect(store.get('needs-enabled')).toBe(true)
  await $.command.run(runNeeds('tick'))
  expect(calls).toEqual(['list_events'])
})
