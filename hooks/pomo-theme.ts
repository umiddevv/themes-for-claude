import type { Theme, ThemeMode } from '../themes/types'
import type { Phase } from '../types'

// The Pomodoro cards' colors, worked out from the active theme: focus from the
// accent, short break from success, long break from special, and the card's
// surface and text from the theme's own grays. A theme file can name exact
// phase colors in `pomodoro`.

export type PomoMode = { card: string; edge: string; track: string; ink: string; soft: string; dot: string }
export type PomoPalette = { light: PomoMode; dark: PomoMode; phase: Record<Phase, [hot: string, deep: string]> }

const HEX = /^#[0-9a-f]{6}$/i

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

/** `a` moved toward `b` by `t` (0 to 1). */
export function mix(a: string, b: string, t: number): string {
  if (!HEX.test(a) || !HEX.test(b)) return HEX.test(a) ? a : b
  const x = rgb(a)
  const y = rgb(b)

  return `#${x.map((v, i) => Math.round(v + ((y[i] ?? v) - v) * t).toString(16).padStart(2, '0')).join('')}`
}

/** The built-in look, for when no theme is known. */
export const CLASSIC: PomoPalette = {
  light: { card: '#ffffff', edge: '#e6e6ea', track: '#ececf0', ink: '#111114', soft: '#8a8a93', dot: '#c9c9d0' },
  dark: { card: '#050506', edge: '#1c1c20', track: '#242428', ink: '#ffffff', soft: '#9a9aa3', dot: '#3a3a40' },
  phase: { focus: ['#ff8a1f', '#d9302a'], short: ['#47a8ff', '#1f5fd1'], long: ['#b48cff', '#6a45d8'] },
}

function mode(m: ThemeMode, isDark: boolean): PomoMode {
  const card = isDark ? m.page : (m.panel ?? m.card ?? m.page)
  const ink = m.text

  return {
    card,
    edge: mix(card, ink, isDark ? 0.1 : 0.1),
    track: mix(card, ink, isDark ? 0.14 : 0.09),
    ink,
    soft: m.textMuted ?? m.textSoft ?? mix(ink, card, 0.45),
    dot: mix(card, ink, 0.25),
  }
}

const ramp = (c: string): [string, string] => [mix(c, '#ffffff', 0.14), mix(c, '#000000', 0.18)]

export function pomoPalette(t: Theme | undefined): PomoPalette {
  const light = t?.light ?? t?.dark
  const dark = t?.dark ?? t?.light

  if (t === undefined || light === undefined || dark === undefined) return CLASSIC

  return {
    light: mode(light, false),
    dark: mode(dark, true),
    phase: {
      focus: ramp(t.pomodoro?.focus ?? t.colors.accent),
      short: ramp(t.pomodoro?.short ?? t.colors.success),
      long: ramp(t.pomodoro?.long ?? t.colors.special),
    },
  }
}
