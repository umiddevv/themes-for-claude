import { describe, expect, test } from 'claude-code/testing'

import { formatTime, parseOffset } from '../hooks/clock'
import { compact } from '../hooks/usage'

const PANE = {
  plugin: 'themes-for-claude',
  component: 'Pane',
  requestId: 'tokens-pane',
  props: {
    title: 'Token usage',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const USAGE = {
  startedAt: 0,
  context: { tokens: 84_000, window: 200_000, percent: 42 },
  rateLimits: [{ kind: 'five_hour', percentUsed: 30 }],
  cost: { usd: 1.234 },
}

describe('helpers', () => {
  test('time and number formatting', async () => {
    expect(parseOffset('+0500\n')).toBe(300)
    expect(parseOffset('-0330')).toBe(-210)
    expect(formatTime(Date.UTC(2026, 10, 15, 9, 7), 300)).toBe('14:07')
    expect(compact(950)).toBe('950')
    expect(compact(12_345)).toBe('12.3k')
    expect(compact(2_500_000)).toBe('2.5M')
  })
})

test('the pane sums finished turns and shows context and cost', async ($, on) => {
  on('session.usage', () => ({ value: USAGE }))
  on('turn.complete', (_, e) => ({ text: e.answer, usage: e.usage }))

  const usage = {
    input_tokens: 1_000,
    output_tokens: 500,
    cache_read_input_tokens: 10_000,
    cache_creation_input_tokens: 2_000,
    model: 'claude-opus-5-5',
  }
  const base = { answer: 'hi', durationMs: 10, isAborted: false, reason: 'answer' } as const

  await $.turn.complete({ ...base, turnId: 't1', usage })
  await $.turn.complete({ ...base, turnId: 't2', usage })
  await $.turn.complete({ ...base, turnId: 't3', agentId: 'a1', usage })

  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect((await ui.find({ type: 'Text', text: '3.0k' }))?.text).toBe('3.0k')
    expect((await ui.find({ type: 'Text', text: /subagent/ }))?.text).toBe('2 + 1 subagent')
    expect((await ui.find({ type: 'Text', text: /of 200k tokens/ }))?.text).toBe('84.0k of 200k tokens')
    expect((await ui.find({ type: 'Text', text: /^\$/ }))?.text).toBe('$1.23')
    expect((await ui.find({ type: 'Text', text: '5-hour limit' }))?.text).toBe('5-hour limit')
    await ui.unmount()
  }
})

test('an empty session says counts start later', async ($, on) => {
  on('session.usage', () => ({ value: { ...USAGE, rateLimits: [] } }))

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await ui.find({ type: 'Text', text: /Counts start/ }))?.text).toBe('Counts start with the next finished turn.')
  await ui.unmount()
})
