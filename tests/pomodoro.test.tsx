import { describe, expect, test } from 'claude-code/testing'

import { INITIAL, advance, mmss, parseMinutes, pause, remaining, reset, start } from '../hooks/pomo-core'

const PANE = {
  plugin: 'themes-for-claude',
  component: 'Pane',
  requestId: 'pomodoro-pane',
  props: {
    title: 'Pomodoro',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

describe('timer logic', () => {
  test('start, pause and resume keep the time left', async () => {
    const running = start(INITIAL, 1_000)
    expect(remaining(running, 61_000)).toBe(24 * 60_000)

    const paused = pause(running, 61_000)
    expect(paused.isRunning).toBe(false)
    expect(remaining(paused, 999_999)).toBe(24 * 60_000)
    expect(remaining(start(paused, 100_000), 100_000)).toBe(24 * 60_000)
    expect(reset(paused).remainingMs).toBe(25 * 60_000)
  })

  test('four focus sessions lead to a long break, then a new set', async () => {
    let p = INITIAL
    for (let i = 0; i < 3; i++) {
      p = advance(p, true)
      expect(p.phase).toBe('short')
      p = advance(p, true)
      expect(p.phase).toBe('focus')
    }
    p = advance(p, true)
    expect(p.phase).toBe('long')
    expect(p.completed).toBe(4)
    expect(p.remainingMs).toBe(15 * 60_000)
    p = advance(p, true)
    expect(p.phase).toBe('focus')
    expect(p.cycle).toBe(0)
  })

  test('skipping focus does not count it', async () => {
    const p = advance(INITIAL, false)
    expect(p.phase).toBe('short')
    expect(p.completed).toBe(0)
  })

  test('formatting and minute arguments', async () => {
    expect(mmss(25 * 60_000)).toBe('25:00')
    expect(mmss(61_500)).toBe('01:02')
    expect(parseMinutes('50 10 20')).toEqual({ focus: 50, short: 10, long: 20 })
    expect(parseMinutes('45')).toEqual({ focus: 45, short: 5, long: 15 })
    expect(parseMinutes('abc')).toBe(undefined)
  })
})

test('the terminal shows the text timer; Start pauses into Resume', async ($, on) => {
  let now = 1_000_000
  on('clock.now', () => ({ value: now }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Svg' })).toBe(undefined)
  expect((await ui.find({ type: 'Text', text: '25:00' }))?.text).toBe('25:00')

  await ui.press({ key: 'pomo-toggle' })
  now += 90_000
  await ui.press({ key: 'pomo-toggle' })

  expect((await ui.find({ type: 'Text', text: '23:30' }))?.text).toBe('23:30')
  expect((await ui.find({ type: 'Button', text: 'Resume' }))?.text).toBe('Resume')

  await ui.press({ key: 'pomo-skip' })
  expect((await ui.find({ type: 'Text', text: /SHORT BREAK/ }))?.text).toContain('SHORT BREAK')
  await ui.unmount()
})

test('desktop and mobile draw the widget card by default', async ($, on) => {
  let now = 1_000_000
  on('clock.now', () => ({ value: now }))
  on('ui.toast', () => ({ value: undefined }))

  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const card = async () => String((await ui.find({ type: 'Svg' }))?.props.source ?? '')

    expect(await card()).toContain('25:00')
    expect(await card()).toContain('🍅')
    expect((await ui.find({ type: 'Button', text: '▶ Start' }))?.text).toBe('▶ Start')
    expect((await ui.find({ type: 'Button', text: 'Break' }))?.text).toBe('Break')
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const card = async () => String((await ui.find({ type: 'Svg' }))?.props.source ?? '')

  await ui.press({ key: 'pomo-toggle' })
  now += 60_000
  expect((await ui.find({ type: 'Button', text: '⏸ Pause' }))?.text).toBe('⏸ Pause')
  await ui.press({ key: 'pomo-toggle' })
  expect(await card()).toContain('24:00')
  expect(await card()).toContain('PAUSED')
  expect(await card()).toContain('class="arc"')

  await ui.press({ key: 'pomo-skip' })
  expect(await card()).toContain('RELAX')
  expect(await card()).toContain('☕')
  expect((await ui.find({ type: 'Button', text: 'Focus' }))?.text).toBe('Focus')

  await ui.press({ key: 'pomo-preset' })
  expect((await ui.find({ type: 'Text', text: /50\/10\/20/ }))?.text).toContain('50/10/20')
  expect((await card()).length).toBeLessThan(131_072)
  await ui.unmount()
})

test('/pomodoro style illustrated switches to the illustrated card', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('ui.open', () => ({ value: { isPlaced: true } }))

  const ran = await $.command.run({
    command: 'pomodoro',
    args: 'style illustrated',
    origin: { kind: 'sdk' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  expect(JSON.stringify(ran)).toContain('illustrated')

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const source = String((await ui.find({ type: 'Svg' }))?.props.source ?? '')
  expect(source).toContain('PRESS START')
  expect(source).toContain('class="script"')
  expect((await ui.find({ type: 'Button', text: 'Start' }))?.text).toBe('Start')
  await ui.unmount()
})
