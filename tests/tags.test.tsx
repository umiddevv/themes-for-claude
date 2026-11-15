import { describe, expect, test } from 'claude-code/testing'

import { localDay } from '../hooks/clock'
import { statsCard } from '../hooks/pomo-stats'
import {
  DEFAULT_TAGS,
  NO_STATS,
  addSession,
  addTag,
  chooseTag,
  cleanTag,
  formatMinutes,
  lastWeek,
  parseStats,
  parseTags,
  removeTag,
  sparkline,
  tagBreakdown,
} from '../hooks/stats-core'
import { escapeXml } from '../hooks/text'

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

describe('tag logic', () => {
  test('tags are cleaned, chosen, toggled off, added and removed', async () => {
    expect(cleanTag('  #Deep Work! ')).toBe('deep-work')
    expect(cleanTag('###')).toBe('')

    let t = chooseTag(DEFAULT_TAGS, 'code')
    expect(t.current).toBe('code')
    expect(chooseTag(t, 'code').current).toBe(undefined)

    t = chooseTag(t, 'Design')
    expect(t.tags.at(-1)).toBe('design')
    expect(t.current).toBe('design')

    expect(addTag(t, 'design')).toEqual(t)
    expect(addTag(t, 'admin').tags).toContain('admin')
    expect(removeTag(t, 'design')).toEqual({ tags: DEFAULT_TAGS.tags })

    for (let i = 0; i < 12; i++) t = addTag(t, `t${i}`)
    expect(t.tags.length).toBe(8)

    expect(parseTags({ tags: ['Work', 'work', 3, '#Read'], current: 'read' })).toEqual({ tags: ['work', 'read'], current: 'read' })
    expect(parseTags({ tags: ['a'], current: 'gone' })).toEqual({ tags: ['a'] })
    expect(parseTags('junk')).toBe(undefined)
  })

  test('daily stats add up per tag, keep 30 days and draw a week', async () => {
    let s = addSession(NO_STATS, '2026-11-15', 25, 'code')
    s = addSession(s, '2026-11-15', 25, 'code')
    s = addSession(s, '2026-11-15', 50, 'study')
    s = addSession(s, '2026-11-15', 25)
    s = addSession(s, '2026-11-13', 50)
    expect(s.days['2026-11-15']).toEqual({ minutes: 125, sessions: 4, byTag: { code: 50, study: 50 } })
    expect(tagBreakdown(s, '2026-11-15').map(b => b.tag)).toEqual(['code', 'study'])
    expect(parseStats(s)).toEqual(s)

    const week = lastWeek(s, '2026-11-15')
    expect(week.map(b => b.letter).join('')).toBe('MTWTFSS')
    expect(sparkline(week)).toBe('····▄·█')

    for (let d = 1; d <= 40; d++) s = addSession(s, `2026-10-${String(d % 31 || 31).padStart(2, '0')}`, 5)
    expect(Object.keys(s.days).length).toBeLessThan(31)

    expect(formatMinutes(75)).toBe('1h 15m')
    expect(localDay(Date.UTC(2026, 10, 15, 22, 0), 300)).toBe('2026-11-16')
    expect(statsCard(week, 4, undefined, 'code 50m · study 50m')).toContain('code 50m · study 50m')
    expect(escapeXml('a <b>')).toBe('a &lt;b&gt;')
  })
})

test('tapping a tag chooses it, shows it on the card, and tapping again clears it', async ($, on) => {
  const saved: Record<string, unknown> = {}
  on('clock.now', () => ({ value: 1_000_000 }))
  on('store.set', (_, e) => {
    saved[e.key] = e.value

    return { value: undefined }
  })

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    for (const tag of DEFAULT_TAGS.tags) {
      expect((await ui.find({ type: 'Button', text: `#${tag}` }))?.text).toBe(`#${tag}`)
    }
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const card = async () => String((await ui.find({ type: 'Svg' }))?.props.source ?? '')

  await ui.press({ key: 'tag-code' })
  expect((await ui.find({ type: 'Button', text: '#code' }))?.props.variant).toBe('primary')
  expect((await ui.find({ type: 'Button', text: '#work' }))?.props.variant).toBe('secondary')
  expect(await card()).toContain('#code')
  expect(saved['pomodoro-tags']).toEqual({ tags: DEFAULT_TAGS.tags, current: 'code' })

  await ui.press({ key: 'tag-code' })
  expect(await card()).not.toContain('#code')
  await ui.unmount()
})

test('✎ adds and removes tags', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('store.set', () => ({ value: undefined }))

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'tags-edit' })

  const input = await ui.find({ type: 'Input' })
  await ui.input({ key: input?.key ?? '', text: 'Deep Work' })
  expect((await ui.find({ type: 'Button', text: '× deep-work' }))?.text).toBe('× deep-work')

  await ui.press({ key: 'tag-remove-read' })
  expect(await ui.find({ type: 'Button', text: '× read' })).toBe(undefined)

  await ui.press({ key: 'tags-done' })
  expect((await ui.find({ type: 'Button', text: '#deep-work' }))?.text).toBe('#deep-work')
  expect(await ui.find({ type: 'Button', text: '#read' })).toBe(undefined)
  await ui.unmount()
})

test('/pomodoro tag picks or creates a tag, tag remove deletes it, sound switches the chime', async ($, on) => {
  const saved: Record<string, unknown> = {}
  on('clock.now', () => ({ value: 1_000_000 }))
  on('store.set', (_, e) => {
    saved[e.key] = e.value

    return { value: undefined }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))

  expect(JSON.stringify(await $.command.run(run('tag Design')))).toContain('#design')
  expect(saved['pomodoro-tags']).toEqual({ tags: [...DEFAULT_TAGS.tags, 'design'], current: 'design' })
  // Naming the chosen tag again keeps it chosen.
  await $.command.run(run('tag design'))
  expect((saved['pomodoro-tags'] as { current?: string }).current).toBe('design')

  await $.command.run(run('tag remove design'))
  expect(saved['pomodoro-tags']).toEqual({ tags: DEFAULT_TAGS.tags })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'pomo-sound' })
  expect((await ui.find({ type: 'Button', text: '🔕' }))?.text).toBe('🔕')
  expect(saved['pomodoro-sound']).toBe(false)
  await ui.unmount()

  await $.command.run(run('sound on'))
  expect(saved['pomodoro-sound']).toBe(true)
})
