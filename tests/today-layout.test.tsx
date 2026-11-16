import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { isOwnCalendar } from '../hooks/today-core'

// The Today pane after its first real use: calendars picked once in a setup,
// cards that open their meeting when tapped, and no Session details button.

const at = (local: string) => Date.parse(`${local}+05:00`)
const T = (day: string, from: string, to: string) => ({ start: { dateTime: `${day}T${from}:00+05:00` }, end: { dateTime: `${day}T${to}:00+05:00` } })
const TODAY_PANE = {
  plugin: 'themes-for-claude',
  component: 'Pane',
  requestId: 'today-pane',
  props: { title: 'Today', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const
const runCmd = (command: string, args = '') => ({ command, args, origin: { kind: 'sdk' as const }, presentation: { isFullscreen: false, columns: 80 } })

const CALS = JSON.stringify({
  calendars: [
    { id: 'me@gmail.com', summary: 'Main' },
    { id: 'en.usa#holiday@group.v.calendar.google.com', summary: 'Holidays' },
    { id: 'family123@group.calendar.google.com', summary: 'Family' },
    { id: 'me@work.com', summary: 'me@work.com' },
  ],
})
const EVENTS: Record<string, string> = {
  'me@gmail.com': JSON.stringify({ events: [{ id: 'p1', summary: 'Gym', ...T('2026-11-16', '07:00', '08:00') }] }),
  'me@work.com': JSON.stringify({
    events: [
      { id: 'w1', summary: 'Client call', ...T('2026-11-16', '11:00', '12:00'), hangoutLink: 'https://meet.google.com/aaa-bbbb-ccc', htmlLink: 'https://www.google.com/calendar/event?eid=w1' },
      { id: 'w2', ...T('2026-11-16', '13:00', '18:00'), htmlLink: 'https://www.google.com/calendar/event?eid=w2' },
    ],
  }),
}

function stub(on: Parameters<TestBody>[1], seed: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(seed))
  const opened: string[][] = []
  on('clock.now', () => ({ value: at('2026-11-16T10:40:00') }))
  on('session.id', () => ({ value: 'me' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1, window: 200_000 }, rateLimits: [{ kind: 'five_hour', percentUsed: 40 }, { kind: 'seven_day', percentUsed: 23 }] } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)

    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('tool.list', () => ({ value: [{ name: 'mcp__cal__list_calendars', description: '', mcp: true }, { name: 'mcp__cal__list_events', description: '', mcp: true }] }))
  on('mcp.call', (_, e) => {
    const cal = (e.args as { calendarId?: string }).calendarId ?? ''
    const text = e.tool === 'list_calendars' ? CALS : (EVENTS[cal] ?? '{"events":[]}')

    return { value: { content: [{ type: 'text', text }], isError: false } }
  })
  on('process.run', (_, e) => {
    opened.push([...e.argv])

    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })

  return { store, opened }
}

test('your own calendars are picked by default; holidays and shared family ones are not', async () => {
  expect(isOwnCalendar('me@gmail.com')).toBe(true)
  expect(isOwnCalendar('me@work.com')).toBe(true)
  expect(isOwnCalendar('en.usa#holiday@group.v.calendar.google.com')).toBe(false)
  expect(isOwnCalendar('family123@group.calendar.google.com')).toBe(false)
})

test('the first time, the pane asks which calendars to show; Done saves them and the chips go away', async ($, on) => {
  const { store } = stub(on)
  await $.command.run(runCmd('today'))
  const ui = await $.ui.mount({ ...TODAY_PANE, surface: 'desktop' })
  expect((await ui.find({ text: /Which calendars/ }))?.text).toContain('Which calendars')

  // Work only: drop Main.
  await ui.press({ key: 'today-pick-0' })
  await ui.press({ key: 'today-setup-done' })
  expect(store.get('today-shown')).toEqual(['me@work.com'])
  expect(await ui.find({ text: /Which calendars/ })).toBe(undefined)
  expect(await ui.find({ key: 'today-pick-0' })).toBe(undefined)

  // ⚙ brings the choice back.
  await ui.press({ key: 'today-setup' })
  expect((await ui.find({ text: /Which calendars/ }))?.text).toContain('Which calendars')
  await ui.unmount()
})

test('tapping a meeting opens its meeting link; one without a meeting opens it in Calendar; no title reads Busy', async ($, on) => {
  const { opened } = stub(on, { 'today-shown': ['me@work.com'] })
  await $.command.run(runCmd('today'))
  const ui = await $.ui.mount({ ...TODAY_PANE, surface: 'desktop' })

  await ui.press({ key: 'today-ev-me@work.com-w1' })
  expect(opened).toEqual([['open', 'https://meet.google.com/aaa-bbbb-ccc']])
  await ui.press({ key: 'today-ev-me@work.com-w2' })
  expect(opened[1]).toEqual(['open', 'https://www.google.com/calendar/event?eid=w2'])

  const cards = (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.source))
  expect(cards.some(c => c.includes('Busy'))).toBe(true)
  expect(await ui.find({ type: 'Link' })).toBe(undefined)
  expect(await ui.find({ key: 'today-details' })).toBe(undefined)
  expect((await ui.find({ key: 'today-refresh' }))?.props.label).toBe('↻')
  await ui.unmount()
})

test('a meeting row has a Join button; an event without a meeting has ↗', async ($, on) => {
  stub(on, { 'today-shown': ['me@work.com'] })
  await $.command.run(runCmd('today'))
  const ui = await $.ui.mount({ ...TODAY_PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'today-ev-me@work.com-w1' }))?.props.label).toBe('Join')
  expect((await ui.find({ key: 'today-ev-me@work.com-w2' }))?.props.label).toBe('↗')
  const card = (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.source)).find(c => c.includes('Client call'))
  expect(card).toContain('in 20 min')
  await ui.unmount()
})
