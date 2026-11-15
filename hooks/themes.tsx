import { atom, update } from 'claude-code'
import type { EngineInterface, On, PluginOptions, ThemeBackdrop, ThemeColor, ThemeSetArgs } from 'claude-code'

import { THEMES } from '../themes'
import type { Theme, ThemeMode } from '../themes/types'
import { makeColors } from './make-colors.js'

// Turns the theme files in ../themes into looks, picks one at start, and
// answers /look. You should not need to edit this file to add a theme.

const STORE_KEY = 'theme'
const DEFAULT = THEMES[0] as Theme

/** What $.store keeps: the theme in use, and the settings value last seen. */
export type SavedTheme = { id: string; configSeen?: string }

let currentId = DEFAULT.id

// The theme in use, for drawings that follow it (the Pomodoro cards): writing it redraws them.
const themeAtom = atom({ plugin: 'themes-for-claude', key: 'themeId' } as const, DEFAULT.id)

export function findTheme(id: string): Theme | undefined {
  const want = id.trim().toLowerCase()

  return THEMES.find(t => t.id === want || t.name.toLowerCase() === want)
}

function anchors(m: ThemeMode) {
  return {
    'surface-0': m.page,
    'text-primary': m.text,
    ...(m.card === undefined ? {} : { 'surface-1': m.card }),
    ...(m.panel === undefined ? {} : { 'surface-2': m.panel }),
    ...(m.menu === undefined ? {} : { 'surface-3': m.menu }),
    ...(m.textSoft === undefined ? {} : { 'text-secondary': m.textSoft }),
    ...(m.textMuted === undefined ? {} : { 'text-muted': m.textMuted }),
  }
}

function backdropOf(t: Theme): ThemeBackdrop | undefined {
  const bg = t.background

  if (bg === undefined) return undefined
  if ('scene' in bg) return { scene: t.id, ...(bg.glass === undefined ? {} : { glass: bg.glass }) }
  if ('gradient' in bg) {
    return { gradient: { stops: bg.gradient as ThemeColor[], ...(bg.angle === undefined ? {} : { angle: bg.angle }) } }
  }

  return { color: bg.color as ThemeColor }
}

export type BuiltTheme = { look: ThemeSetArgs; unpainted?: string } | { error: string }

/** A theme file as the app takes it, or what is wrong with it. */
export function buildTheme(t: Theme): BuiltTheme {
  try {
    const only = t.light !== undefined && t.dark === undefined ? 'light' : t.dark !== undefined && t.light === undefined ? 'dark' : undefined
    const { theme, problems } = makeColors({
      label: t.name,
      roles: { accent: t.colors.accent, danger: t.colors.danger, success: t.colors.success, warning: t.colors.warning, pro: t.colors.special },
      ...(t.light === undefined ? {} : { light: { gray: { anchors: anchors(t.light) } } }),
      ...(t.dark === undefined ? {} : { dark: { gray: { anchors: anchors(t.dark) } } }),
      ...(only === undefined ? {} : { only }),
    })
    const backdrop = backdropOf(t)
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    return { look: { colors: theme, ...(backdrop === undefined ? {} : { backdrop }) }, ...(unpainted === undefined ? {} : { unpainted }) }
  } catch (err) {
    return { error: `${t.name}: ${err instanceof Error ? err.message : String(err)}` }
  }
}

/** The settings picker wins when the person changed it; otherwise the last /look choice. */
export function chooseTheme(configTheme: string | undefined, saved: SavedTheme | undefined): SavedTheme {
  if (configTheme !== undefined && configTheme !== saved?.configSeen && findTheme(configTheme) !== undefined) {
    return { id: configTheme, configSeen: configTheme }
  }
  const id = saved?.id !== undefined && findTheme(saved.id) !== undefined ? saved.id : (configTheme ?? DEFAULT.id)

  return { id: findTheme(id)?.id ?? DEFAULT.id, ...(configTheme === undefined ? {} : { configSeen: configTheme }) }
}

function parseSaved(value: unknown): SavedTheme | undefined {
  if (typeof value !== 'object' || value === null || typeof (value as SavedTheme).id !== 'string') return undefined
  const v = value as SavedTheme

  return { id: v.id, ...(typeof v.configSeen === 'string' ? { configSeen: v.configSeen } : {}) }
}

/** Sets the theme; resolves an error line when the theme file has a problem. */
async function applyTheme($: EngineInterface, t: Theme): Promise<string | undefined> {
  const built = buildTheme(t)

  if ('error' in built) return built.error
  if (built.unpainted !== undefined) $.ui.toast(`${t.name}: ${built.unpainted}`)

  const set = await $.theme.set(built.look)
  currentId = t.id
  await update($, themeAtom, () => t.id)

  if (!set.isDrawn) $.ui.log(`${t.name}: ${set.reason}`)

  return undefined
}

async function saveChoice($: EngineInterface, id: string): Promise<void> {
  const saved = parseSaved(await $.store.get(STORE_KEY).catch(() => undefined))
  await $.store.set(STORE_KEY, { ...saved, id }).catch(() => undefined)
}

export async function startThemes($: EngineInterface, options: PluginOptions): Promise<void> {
  const configTheme = typeof options.theme === 'string' && options.theme !== '' ? options.theme : undefined
  const choice = chooseTheme(configTheme, parseSaved(await $.store.get(STORE_KEY).catch(() => undefined)))
  const error = await applyTheme($, findTheme(choice.id) ?? DEFAULT)

  if (error !== undefined) {
    $.ui.toast(`Theme problem, using ${DEFAULT.name}: ${error}`)
    await applyTheme($, DEFAULT)
  }
  await $.store.set(STORE_KEY, choice).catch(() => undefined)
  await $.command.register({ name: 'look', description: 'Switch theme: /look lists them, /look <name> or /look next switches' })
}

function listText(): string {
  const rows = THEMES.map(t => `${t.id === currentId ? '●' : '○'} ${t.id.padEnd(12)} ${t.name}`)

  return `Themes:\n${rows.join('\n')}\n\nSwitch with /look <name>, or /look next.`
}

export function registerThemes(on: On): void {
  on('command.run', { command: 'look' }, async ($, e) => {
    const arg = e.args.trim()

    if (arg === '' || arg === 'list') {
      return { text: listText() }
    }
    const index = THEMES.findIndex(t => t.id === currentId)
    const target = arg === 'next' ? THEMES[(index + 1) % THEMES.length] : findTheme(arg)

    if (target === undefined) {
      return { text: `No theme "${arg}". ${listText()}` }
    }
    const error = await applyTheme($, target)

    if (error !== undefined) {
      return { text: `That theme file has a problem, so nothing changed:\n${error}` }
    }
    await saveChoice($, target.id)

    return { text: `Theme: ${target.name}` }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    const t = typeof e.props.scene === 'string' ? findTheme(e.props.scene) : undefined
    const bg = t?.background

    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || t === undefined || bg === undefined || !('scene' in bg)) {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)

    return <Svg source={bg.scene} alt={`${t.name} background`} isInteractive />
  })
}
