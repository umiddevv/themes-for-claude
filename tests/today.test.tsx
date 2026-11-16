import { describe, expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { eventCard, usageCard, weekStrip } from '../hooks/today-card'
import { CLASSIC } from '../hooks/pomo-theme'
import { badge, busy, eventsOn, nextFree, parseCalendars, parseEvents, spent, weekDays } from '../hooks/today-core'

// Shapes as the Google Calendar connector returns them.
const OFFSET = 300 // +05:00
const at = (local: string) => Date.parse(`${local}+05:00`)

const T = (day: string, from: string, to: string) => ({ start: { dateTime: `${day}T${from}:00+05:00` }, end: { dateTime: `${day}T${to}:00+05:00` } })

export const EVENTS = JSON.stringify({
  events: [
    { id: 'e1', summary: 'Standup', ...T('2026-11-16', '09:30', '10:00'), hangoutLink: 'https://meet.google.com/abc-defg-hij', htmlLink: 'https://www.google.com/calendar/event?eid=e1', status: 'confirmed' },
    { id: 'e2', summary: 'Client <review>', ...T('2026-11-16', '11:00', '12:00'), location: 'https://us02web.zoom.us/j/123?pwd=x', description: 'backup https://evil.example/zoom' },
    { id: 'e3', summary: 'Holiday', start: { date: '2026-11-16' }, end: { date: '2026-11-17' } },
    { id: 'e4', summary: 'Gone', status: 'cancelled', ...T('2026-11-16', '13:00', '14:00') },
    { id: 'e5', summary: 'Declined', ...T('2026-11-16', '15:00', '15:30'), attendees: [{ email: 'me@x', self: true, responseStatus: 'declined' }] },
    { id: 'e6', summary: 'Sneaky', ...T('2026-11-16', '16:00', '16:30'), description: 'call at https://evil.example/j/1', htmlLink: 'https://evil.example/cal' },
    { id: 'e7', summary: 'Tomorrow', ...T('2026-11-17', '10:00', '11:00'), conferenceData: { entryPoints: [{ entryPointType: 'phone', uri: 'tel:+1' }, { entryPointType: 'video', uri: 'https://teams.microsoft.com/l/meetup-join/1' }] } },
  ],
})

describe('today core', () => {
  test('calendars and events are read from the connector JSON', async () => {
    expect(parseCalendars('{"calendars":[{"id":"a@x","summary":"Main"},{"id":"b","summary":"Family"}]}')).toEqual([
      { id: 'a@x', name: 'Main' },
      { id: 'b', name: 'Family' },
    ])
    expect(parseCalendars('junk')).toBe(undefined)

    const evs = parseEvents(EVENTS, 'a@x')
    expect(evs.map(e => e.id)).toEqual(['e1', 'e2', 'e3', 'e5', 'e6', 'e7'])
    expect(evs.find(e => e.id === 'e5')?.isDeclined).toBe(true)
    expect(evs.find(e => e.id === 'e3')?.isAllDay).toBe(true)
    expect(evs.find(e => e.id === 'e1')?.start).toBe(at('2026-11-16T09:30:00'))
    expect(() => parseEvents('nope', 'a@x')).toThrow()
  })

  test('join links come only from meeting hosts; Open in Calendar only from Google', async () => {
    const evs = parseEvents(EVENTS, 'a@x')
    const by = (id: string) => evs.find(e => e.id === id)
    expect(by('e1')?.join).toEqual({ url: 'https://meet.google.com/abc-defg-hij', label: 'Meet' })
    expect(by('e2')?.join).toEqual({ url: 'https://us02web.zoom.us/j/123?pwd=x', label: 'Zoom' })
    expect(by('e7')?.join).toEqual({ url: 'https://teams.microsoft.com/l/meetup-join/1', label: 'Teams' })
    expect(by('e6')?.join).toBe(undefined)
    expect(by('e1')?.open).toBe('https://www.google.com/calendar/event?eid=e1')
    expect(by('e6')?.open).toBe(undefined)
  })

  test('a day lists all-day first, then by time, without declined or hidden calendars', async () => {
    const evs = parseEvents(EVENTS, 'a@x')
    expect(eventsOn(evs, '2026-11-16', [], OFFSET).map(e => e.id)).toEqual(['e3', 'e1', 'e2', 'e6'])
    expect(eventsOn(evs, '2026-11-16', ['a@x'], OFFSET)).toEqual([])
    expect(busy(evs, '2026-11-16', [], OFFSET)).toBe(3)
    expect(busy(evs, '2026-11-17', [], OFFSET)).toBe(1)
    expect(busy(evs, '2026-11-19', [], OFFSET)).toBe(0)
  })

  test('the week starts on Monday', async () => {
    const w = weekDays('2026-11-18')
    expect(w[0]).toBe('2026-11-16')
    expect(w.length).toBe(7)
    expect(w[6]).toBe('2026-11-22')
  })

  test('badges and the next free slot follow the clock', async () => {
    const e2 = parseEvents(EVENTS, 'a@x').find(e => e.id === 'e2')!
    expect(badge(e2, at('2026-11-16T10:40:00'))).toBe('in 20 min')
    expect(badge(e2, at('2026-11-16T11:10:00'))).toBe('now')
    expect(badge(e2, at('2026-11-16T12:01:00'))).toBe('done')
    expect(badge(e2, at('2026-11-16T08:00:00'))).toBe('')

    const evs = parseEvents(EVENTS, 'a@x')
    expect(nextFree(evs, '2026-11-16', at('2026-11-16T08:00:00'), OFFSET)).toBe('09:00–09:30')
    expect(nextFree(evs, '2026-11-16', at('2026-11-16T10:05:00'), OFFSET)).toBe('10:05–11:00')
  })
})

test('today cards draw spend, limits, the week and an event in the theme colours', async () => {
  const u = usageCard({ today: 4.2, week: 31.5, sessions: 6, contextPct: 62, limits: [{ name: '5-hour limit', pct: 48, resets: '15:00' }, { name: 'Weekly limit', pct: 21, resets: 'Mon' }] }, CLASSIC)
  expect(u).toContain('$4.20')
  expect(u).toContain('SPENT TODAY')
  expect(u).toContain('48%')
  expect(u).toContain('Weekly limit')

  const strip = weekStrip([{ label: 'Mon', num: 16, dots: 2, colors: ['#111111', '#222222'] }, { label: 'Tue', num: 17, dots: 0, colors: [] }], 1, CLASSIC)
  expect(strip).toContain('>17<')
  expect(strip).toContain(CLASSIC.accent)

  const ev = parseEvents(EVENTS, 'a@x').find(e => e.id === 'e2')!
  const card = eventCard(ev, 'in 20 min', '#123456', 'Work', CLASSIC, OFFSET)
  expect(card).toContain('Client &lt;review&gt;')
  expect(card).toContain('in 20 min')
  expect(card).toContain('#123456')
  expect(card).toContain('11:00')
})

const TODAY_PANE = {
  plugin: 'themes-for-claude',
  component: 'Pane',
  requestId: 'today-pane',
  props: { title: 'Today', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const
const runCmd = (command: string, args = '') => ({ command, args, origin: { kind: 'sdk' as const }, presentation: { isFullscreen: false, columns: 80 } })
const CALS = '{"calendars":[{"id":"a@x","summary":"Work"},{"id":"b","summary":"Family"}]}'
const FAMILY = JSON.stringify({ events: [{ id: 'e9', summary: 'School pickup', ...T('2026-11-16', '13:00', '13:30') }] })
const USAGE = { startedAt: at('2026-11-16T08:00:00'), context: { tokens: 84_000, window: 200_000, percent: 42 }, rateLimits: [{ kind: 'five_hour', percentUsed: 48 }], cost: { usd: 2.7 } }

function stub(on: Parameters<TestBody>[1], opts: { calendar: boolean; store?: Record<string, unknown> }) {
  const store = new Map<string, unknown>(Object.entries(opts.store ?? {}))
  const calls: string[] = []
  const opened: string[] = []
  on('clock.now', () => ({ value: at('2026-11-16T10:40:00') }))
  on('session.id', () => ({ value: 'me' }))
  on('session.usage', () => ({ value: USAGE }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)

    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('process.run', (_, e) => {
    opened.push(e.argv.join(' '))

    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('tool.list', () => ({ value: opts.calendar ? [{ name: 'mcp__cal__list_calendars', description: '', mcp: true }, { name: 'mcp__cal__list_events', description: '', mcp: true }] : [] }))
  on('mcp.call', (_, e) => {
    const cal = (e.args as { calendarId?: string }).calendarId
    calls.push(`${e.tool}:${cal ?? ''}`)
    const text = e.tool === 'list_calendars' ? CALS : cal === 'b' ? FAMILY : EVENTS

    return { value: { content: [{ type: 'text', text }], isError: false } }
  })

  return { store, calls, opened }
}

test('the Today pane shows the day’s meetings with Join buttons, hides a calendar in setup, and moves to tomorrow', async ($, on) => {
  const { calls, opened } = stub(on, { calendar: true, store: { 'today-shown': ['a@x', 'b'] } })
  await $.command.run(runCmd('today'))
  expect(calls).toEqual(['list_calendars:', 'list_events:a@x', 'list_events:b'])

  const ui = await $.ui.mount({ ...TODAY_PANE, surface: 'desktop' })
  const cards = async () => (await ui.findAll({ type: 'Svg' })).length - 2
  // e1, e2, e6 (Work) and e9 (Family); the all-day e3 is a line of text.
  expect(await cards()).toBe(4)
  expect((await ui.find({ text: /Holiday/ }))?.text).toContain('Holiday')
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('SPENT TODAY')
  await ui.press({ key: 'today-ev-a@x-e2' })
  expect(opened).toEqual(['open https://us02web.zoom.us/j/123?pwd=x'])

  // ⚙, then drop Family.
  await ui.press({ key: 'today-setup' })
  await ui.press({ key: 'today-pick-1' })
  await ui.press({ key: 'today-setup-done' })
  expect(await cards()).toBe(3)

  await ui.press({ key: 'today-next' })
  await ui.press({ key: 'today-ev-a@x-e7' })
  expect(opened.at(-1)).toBe('open https://teams.microsoft.com/l/meetup-join/1')
  await ui.unmount()

  const term = await $.ui.mount({ ...TODAY_PANE, surface: 'terminal' })
  expect((await term.find({ text: /Tomorrow/ }))?.text).toContain('Tomorrow')
  await term.unmount()
})

test('without a calendar connector the pane says how to connect one, and usage still shows', async ($, on) => {
  stub(on, { calendar: false })
  await $.command.run(runCmd('today'))
  const ui = await $.ui.mount({ ...TODAY_PANE, surface: 'desktop' })
  expect((await ui.find({ text: /Connect Google Calendar/ }))?.text).toContain('Connect Google Calendar')
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('48%')
  await ui.unmount()
})

test('each session records its cost, and today adds up every session', async ($, on) => {
  const { store } = stub(on, { calendar: false, store: { 'cost:other': { last: 1.5, days: { '2026-11-16': 1.5 } } } })
  on('turn.complete', (_, e) => ({ text: e.answer }))
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, reason: 'answer', turnId: 't1' } as never)
  expect(store.get('cost:me')).toEqual({ last: 2.7, days: { '2026-11-16': 2.7 } })

  await $.command.run(runCmd('today'))
  const ui = await $.ui.mount({ ...TODAY_PANE, surface: 'desktop' })
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('$4.20')
  await ui.unmount()
})
