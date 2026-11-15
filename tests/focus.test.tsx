import { describe, expect, test } from 'claude-code/testing'

import { localDay } from '../hooks/clock'
import {
  NO_FOCUS,
  NO_STATS,
  addSession,
  creditFocus,
  formatMinutes,
  lastWeek,
  parseFocus,
  parseStats,
  setFocus,
  sparkline,
} from '../hooks/stats-core'
import { activeTask, escapeXml, parseStored } from '../hooks/tasks-core'

const PANE = {
  plugin: 'themes-for-claude',
  component: 'Pane',
  requestId: 'pomodoro-pane',
  props: { title: 'Pomodoro', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const run = (args: string) => ({
  command: 'pomodoro',
  args,
  origin: { kind: 'sdk' as const },
  presentation: { isFullscreen: false, columns: 80 },
})

describe('focus line and stats logic', () => {
  test('setting, editing and crediting the focus line', async () => {
    let f = setFocus(NO_FOCUS, '  Write   the report ')
    expect(f).toEqual({ text: 'Write the report', pomodoros: 0 })
    f = creditFocus(creditFocus(f))
    expect(setFocus(f, 'Write the final report', true).pomodoros).toBe(2)
    expect(setFocus(f, 'Reply to emails').pomodoros).toBe(0)
    expect(setFocus(f, '   ')).toEqual(f)
    expect(creditFocus(NO_FOCUS)).toEqual(NO_FOCUS)
    expect(parseFocus({ text: 'x', pomodoros: 1 })).toEqual({ text: 'x', pomodoros: 1 })
    expect(parseFocus('junk')).toBe(undefined)
  })

  test('daily stats add up, keep 30 days and draw a week', async () => {
    let s = addSession(NO_STATS, '2026-11-15', 25)
    s = addSession(s, '2026-11-15', 25)
    s = addSession(s, '2026-11-13', 50)
    expect(s.days['2026-11-15']).toEqual({ minutes: 50, sessions: 2 })

    const week = lastWeek(s, '2026-11-15')
    expect(week.map(b => b.day)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'])
    expect(week.map(b => b.letter).join('')).toBe('MTWTFSS')
    expect(week.at(-1)?.isToday).toBe(true)
    expect(sparkline(week)).toBe('····█·█')

    for (let d = 1; d <= 40; d++) s = addSession(s, `2026-10-${String(d % 31 || 31).padStart(2, '0')}`, 5)
    expect(Object.keys(s.days).length).toBeLessThan(31)

    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(75)).toBe('1h 15m')
    expect(formatMinutes(120)).toBe('2h')
    expect(parseStats({ days: { '2026-11-15': { minutes: 5, sessions: 1 }, bad: 3 } })).toEqual({ days: { '2026-11-15': { minutes: 5, sessions: 1 } } })
    expect(localDay(Date.UTC(2026, 10, 15, 22, 0), 300)).toBe('2026-11-16')
  })

  test('the old task list carries its current task over', async () => {
    const old = parseStored({ items: [{ id: 'a', text: 'Old task', isDone: false, pomodoros: 3 }], activeId: 'a' })
    expect(old === undefined ? undefined : activeTask(old)?.text).toBe('Old task')
    expect(escapeXml('a <b> & "c"')).toBe('a &lt;b&gt; &amp; &quot;c&quot;')
  })
})

test('the focus line is set, shown on the card, edited and finished', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('store.set', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const input = await ui.find({ type: 'Input' })
    expect(input?.key).toBe('focus-input')
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.input({ key: 'focus-input', text: 'Write the <big> report' })
  expect((await ui.find({ type: 'Text', text: /^▸ / }))?.text).toBe('▸ Write the <big> report')
  expect(String((await ui.find({ type: 'Svg' }))?.props.source ?? '')).toContain('Write the &lt;big&gt; report')

  await ui.press({ key: 'focus-edit' })
  expect((await ui.find({ type: 'Input' }))?.key).toBe('focus-input-edit')
  await ui.input({ key: 'focus-input-edit', text: 'Write the short report' })
  expect((await ui.find({ type: 'Text', text: /^▸ / }))?.text).toBe('▸ Write the short report')

  await ui.press({ key: 'focus-done' })
  expect((await ui.find({ type: 'Input' }))?.key).toBe('focus-input')
  await ui.unmount()
})

test('/pomodoro focus sets the line; the sound button and /pomodoro sound switch the chime', async ($, on) => {
  const saved: Record<string, unknown> = {}
  on('clock.now', () => ({ value: 1_000_000 }))
  on('store.set', (_, e) => {
    saved[e.key] = e.value

    return { value: undefined }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))

  await $.command.run(run('focus Plan the week'))
  expect(saved['pomodoro-focus']).toEqual({ text: 'Plan the week', pomodoros: 0 })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(String((await ui.find({ type: 'Svg' }))?.props.source ?? '')).toContain('Plan the week')
  expect((await ui.find({ type: 'Button', text: '🔔' }))?.text).toBe('🔔')
  await ui.press({ key: 'pomo-sound' })
  expect((await ui.find({ type: 'Button', text: '🔕' }))?.text).toBe('🔕')
  expect(saved['pomodoro-sound']).toBe(false)
  await ui.unmount()

  expect(JSON.stringify(await $.command.run(run('sound on')))).toContain('on')
  expect(saved['pomodoro-sound']).toBe(true)
})
