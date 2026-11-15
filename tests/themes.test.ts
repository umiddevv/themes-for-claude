import { describe, expect, test } from 'claude-code/testing'

import { CLASSIC, pomoPalette } from '../hooks/pomo-theme'
import { buildTheme, chooseTheme, findTheme } from '../hooks/themes'
import { THEMES } from '../themes'

const PANE = {
  plugin: 'themes-for-claude',
  component: 'Pane',
  requestId: 'pomodoro-pane',
  props: { title: 'Pomodoro', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

describe('Pomodoro colors follow the theme', () => {
  test('focus, short and long come from accent, success and special, unless the theme names them', async () => {
    const forest = findTheme('forest')
    expect(forest).toBeDefined()
    if (forest === undefined) return
    const pal = pomoPalette(forest)
    expect(pal.light.card).toBe(forest.light?.panel)
    expect(pal.dark.card).toBe(forest.dark?.page)
    expect(pal.phase.focus).not.toEqual(CLASSIC.phase.focus)
    expect(pomoPalette(undefined)).toEqual(CLASSIC)

    const named = pomoPalette({ ...forest, pomodoro: { focus: '#e8392b' } })
    expect(named.phase.focus).not.toEqual(pal.phase.focus)
    expect(named.phase.short).toEqual(pal.phase.short)
  })
})

test('/look redraws the open Pomodoro card in the new colors', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'theme' } }))

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const card = async () => String((await ui.find({ type: 'Svg' }))?.props.source ?? '')
  const hot = (id: string) => pomoPalette(findTheme(id)).phase.focus[0]

  expect(await card()).toContain(hot(THEMES[0]?.id ?? ''))

  await $.command.run({ command: 'look', args: 'sandstone', origin: { kind: 'sdk' }, presentation: { isFullscreen: false, columns: 80 } })
  expect(await card()).toContain(hot('sandstone'))
  expect(await card()).not.toContain(hot(THEMES[0]?.id ?? ''))
  await ui.unmount()
})

const run = (args: string) => ({
  command: 'look',
  args,
  origin: { kind: 'sdk' as const },
  presentation: { isFullscreen: false, columns: 80 },
})

describe('theme files', () => {
  test('every theme builds, and Desktop paints it', async () => {
    const ids = new Set<string>()

    for (const t of THEMES) {
      expect(/^[a-z0-9-]+$/.test(t.id)).toBe(true)
      expect(ids.has(t.id)).toBe(false)
      ids.add(t.id)

      const built = buildTheme(t)
      expect('error' in built ? built.error : 'ok').toBe('ok')
      expect('unpainted' in built ? built.unpainted : undefined).toBe(undefined)
    }
  })

  test('a broken theme file reports its problem instead of throwing', async () => {
    const first = THEMES[0]
    expect(first).toBeDefined()
    if (first === undefined) return
    const broken = { ...first, colors: { ...first.colors, accent: 'teal' as `#${string}` } }
    expect('error' in buildTheme(broken)).toBe(true)
  })

  test('the settings picker wins only when it changed', async () => {
    expect(chooseTheme(undefined, undefined).id).toBe(THEMES[0]?.id)
    expect(chooseTheme('paper', undefined)).toEqual({ id: 'paper', configSeen: 'paper' })
    expect(chooseTheme('paper', { id: 'forest', configSeen: 'paper' }).id).toBe('forest')
    expect(chooseTheme('sandstone', { id: 'forest', configSeen: 'paper' }).id).toBe('sandstone')
    expect(chooseTheme(undefined, { id: 'gone' }).id).toBe(THEMES[0]?.id)
    expect(findTheme('Forest Moss')?.id).toBe('forest')
  })
})

test('/look lists, switches, cycles and remembers', async ($, on) => {
  const stored: Record<string, unknown> = {}
  const looks: unknown[] = []
  on('store.get', (_, e) => ({ value: stored[e.key] }))
  on('store.set', (_, e) => {
    stored[e.key] = e.value

    return { value: undefined }
  })
  on('theme.set', (_, e) => {
    looks.push(e)

    return { value: { isDrawn: true, requestId: 'theme' } }
  })

  const list = JSON.stringify(await $.command.run(run('')))
  for (const t of THEMES) expect(list).toContain(t.id)

  expect(JSON.stringify(await $.command.run(run('forest')))).toContain('Forest moss')
  expect(stored.theme).toEqual({ id: 'forest' })
  expect(looks.length).toBe(1)

  expect(JSON.stringify(await $.command.run(run('next')))).toContain(THEMES[3]?.name ?? '')
  const unknown = (await $.command.run(run('nope'))) as { text?: string }
  expect(unknown.text ?? '').toContain('No theme "nope"')
  expect(looks.length).toBe(2)
})
