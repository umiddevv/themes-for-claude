import { describe, expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { findSources } from '../hooks/needs-core'
import { usageCard } from '../hooks/today-card'
import { costDays, eventsOn, nextCost, nextFree, parseCalendars, parseEvents, spent } from '../hooks/today-core'
import { CLASSIC } from '../hooks/pomo-theme'

// Tests for the fixes from the whole-branch review of the Today pane.

const OFFSET = 300
const at = (local: string) => Date.parse(`${local}+05:00`)
const T = (day: string, from: string, to: string) => ({ start: { dateTime: `${day}T${from}:00+05:00` }, end: { dateTime: `${day}T${to}:00+05:00` } })
const MIDNIGHT = at('2026-11-16T00:00:00')

describe('cost per session', () => {
  test('a session that started before today counts $0 when first seen; a new one counts all; growth adds the difference', async () => {
    const old = nextCost(undefined, 38, at('2026-11-15T09:00:00'), '2026-11-16', MIDNIGHT)
    expect(old.days['2026-11-16'] ?? 0).toBe(0)
    expect(old.last).toBe(38)
    expect(nextCost(old, 40.5, at('2026-11-15T09:00:00'), '2026-11-16', MIDNIGHT).days['2026-11-16']).toBe(2.5)

    const fresh = nextCost(undefined, 1.2, at('2026-11-16T08:00:00'), '2026-11-16', MIDNIGHT)
    expect(fresh.days['2026-11-16']).toBe(1.2)

    // A running total that went down (a reset) counts the new total.
    expect(nextCost({ last: 5, days: { '2026-11-16': 5 } }, 1, 0, '2026-11-16', MIDNIGHT).days['2026-11-16']).toBe(6)
  })

  test('each session is its own key, so two sessions never overwrite each other, and old days drop off', async () => {
    const days = costDays({
      'cost:a': { last: 3, days: { '2026-11-16': 1.5, '2026-11-01': 9 } },
      'cost:b': { last: 2.7, days: { '2026-11-16': 2.7 } },
      junk: 1,
    })
    expect(spent(days, '2026-11-16')).toEqual({ today: 4.2, week: 4.2, sessions: 2 })
  })
})

test('only a server with both list_calendars and list_events is a calendar', async () => {
  expect(findSources(['mcp__ccd_session_mgmt__list_events', 'mcp__cal__list_calendars', 'mcp__cal__list_events']).find(s => s.kind === 'calendar')?.server).toBe('cal')
  expect(findSources(['mcp__ccd_session_mgmt__list_events'])).toEqual([])
})

describe('events across days and messy links', () => {
  test('an out-of-office block shows on every day it covers and leaves no free time', async () => {
    const evs = parseEvents(JSON.stringify({ events: [{ id: 'ooo', summary: 'Out of office', start: { dateTime: '2026-11-16T09:00:00+05:00' }, end: { dateTime: '2026-11-18T18:00:00+05:00' } }] }), 'a')
    expect(eventsOn(evs, '2026-11-17', [], OFFSET).map(e => e.id)).toEqual(['ooo'])
    expect(eventsOn(evs, '2026-11-19', [], OFFSET)).toEqual([])
    expect(nextFree(evs, '2026-11-17', at('2026-11-17T08:00:00'), OFFSET)).toBe('')
  })

  test('a join link from a description loses trailing punctuation and HTML escapes', async () => {
    const evs = parseEvents(
      JSON.stringify({
        events: [
          { id: 'a', summary: 'A', ...T('2026-11-16', '10:00', '11:00'), description: 'Join at https://zoom.us/j/123.' },
          { id: 'b', summary: 'B', ...T('2026-11-16', '12:00', '13:00'), description: 'https://us02web.zoom.us/j/9?pwd=x&amp;uname=y,' },
        ],
      }),
      'a',
    )
    expect(evs.map(e => e.join?.url)).toEqual(['https://zoom.us/j/123', 'https://us02web.zoom.us/j/9?pwd=x&uname=y'])
  })

  test('the same meeting on two calendars shows once', async () => {
    const one = JSON.stringify({ events: [{ id: 'm', summary: 'Sync', ...T('2026-11-16', '10:00', '11:00') }] })
    const evs = [...parseEvents(one, 'work'), ...parseEvents(one, 'team')]
    expect(eventsOn(evs, '2026-11-16', [], OFFSET).map(e => e.calId)).toEqual(['work'])
  })

  test('an answer that is not JSON is an error, not an empty calendar', async () => {
    expect(parseCalendars('Sorry, something went wrong')).toBe(undefined)
    expect(() => parseEvents('Sorry', 'a')).toThrow()
  })
})

test('the usage card fits every limit and names the ring briefly', async () => {
  const card = usageCard({ today: 1, week: 2, sessions: 1, limits: [{ name: '5-hour limit', pct: 10, resets: '' }, { name: 'Weekly limit', pct: 20, resets: '' }, { name: 'Weekly · Opus', pct: 64, resets: '' }] }, CLASSIC)
  const height = Number(/viewBox="0 0 312 (\d+)"/.exec(card)?.[1])
  expect(height).toBeGreaterThanOrEqual(250)
  expect(card).toContain('>OPUS<')
  expect(card).toContain('7 days $2.00')
})

// ---- The pane ----

const TODAY_PANE = {
  plugin: 'themes-for-claude',
  component: 'Pane',
  requestId: 'today-pane',
  props: { title: 'Today', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const
const runCmd = (command: string, args = '') => ({ command, args, origin: { kind: 'sdk' as const }, presentation: { isFullscreen: false, columns: 80 } })
const CALS = '{"calendars":[{"id":"a@x","summary":"Work"},{"id":"b","summary":"Family"}]}'
const WORK = JSON.stringify({ events: [{ id: 'w1', summary: 'Standup', ...T('2026-11-22', '10:00', '10:30') }, { id: 'w2', summary: 'Planning', ...T('2026-11-23', '10:00', '11:00') }] })

function stub(on: Parameters<TestBody>[1], opts: { now: number; family: 'ok' | 'error'; calendars?: string }) {
  const store = new Map<string, unknown>()
  const calls: string[] = []
  on('clock.now', () => ({ value: opts.now }))
  on('session.id', () => ({ value: 'me' }))
  on('session.usage', () => ({ value: { startedAt: opts.now, context: { tokens: 1, window: 200_000 }, rateLimits: [] } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)

    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('tool.list', () => ({ value: [{ name: 'mcp__cal__list_calendars', description: '', mcp: true }, { name: 'mcp__cal__list_events', description: '', mcp: true }] }))
  on('mcp.call', async (_, e) => {
    const args = e.args as { calendarId?: string; startTime?: string }
    calls.push(`${e.tool}:${args.calendarId ?? ''}:${args.startTime ?? ''}`)
    await new Promise(r => (globalThis as unknown as { setTimeout: (f: (v?: unknown) => void, ms: number) => void }).setTimeout(r, 10))
    if (e.tool === 'list_calendars') return { value: { content: [{ type: 'text', text: opts.calendars ?? CALS }], isError: false } }
    if (args.calendarId === 'b' && opts.family === 'error') return { value: { content: [{ type: 'text', text: 'Not Found' }], isError: true } }

    return { value: { content: [{ type: 'text', text: args.calendarId === 'b' ? '{"events":[]}' : WORK }], isError: false } }
  })

  return { store, calls }
}

test('one calendar that fails keeps the others and names the one that failed', async ($, on) => {
  stub(on, { now: at('2026-11-22T09:00:00'), family: 'error' })
  await $.command.run(runCmd('today'))
  const ui = await $.ui.mount({ ...TODAY_PANE, surface: 'desktop' })
  expect((await ui.findAll({ type: 'Svg' })).length).toBe(3)
  expect((await ui.find({ text: /Family/ }))?.text).toContain("Couldn't read Family")
  await ui.unmount()
})

test('a calendar answer that is not JSON shows an error, not an empty day', async ($, on) => {
  stub(on, { now: at('2026-11-22T09:00:00'), family: 'ok', calendars: 'Service unavailable' })
  await $.command.run(runCmd('today'))
  const ui = await $.ui.mount({ ...TODAY_PANE, surface: 'desktop' })
  expect(await ui.find({ text: /Nothing on this day/ })).toBe(undefined)
  expect((await ui.find({ text: /Couldn't read the calendar/ }))?.text).toContain("Couldn't read the calendar")
  await ui.unmount()
})

test('moving to next week while a load runs still loads next week', async ($, on) => {
  const { calls } = stub(on, { now: at('2026-11-22T09:00:00'), family: 'ok' })
  await $.command.run(runCmd('today'))
  const ui = await $.ui.mount({ ...TODAY_PANE, surface: 'desktop' })
  // A refresh is running (its calendar list is on the way) when the person moves from Sunday into next week.
  const sleep = (ms: number) => new Promise(r => (globalThis as unknown as { setTimeout: (f: (v?: unknown) => void, ms: number) => void }).setTimeout(r, ms))
  const refresh = $.command.run(runCmd('today'))
  for (let i = 0; i < 50 && calls.filter(c => c.startsWith('list_calendars')).length < 2; i++) await sleep(1)
  await ui.press({ key: 'today-next' })
  await refresh
  // Let the follow-up load finish.
  for (let i = 0; i < 20 && !calls.some(c => c.includes('2026-11-23T00:00:00')); i++) {
    await new Promise(r => (globalThis as unknown as { setTimeout: (f: (v?: unknown) => void, ms: number) => void }).setTimeout(r, 20))
  }
  await new Promise(r => (globalThis as unknown as { setTimeout: (f: (v?: unknown) => void, ms: number) => void }).setTimeout(r, 80))
  expect(calls.some(c => c.startsWith('list_events:a@x:2026-11-23T00:00:00'))).toBe(true)
  expect((await ui.find({ text: /Nothing on this day/ }))?.text).toBe(undefined)
  await ui.unmount()
})
