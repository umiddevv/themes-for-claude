// The shape of a theme file. Every color is six-digit hex, like '#2f5d8c'.

type Hex = `#${string}`

/** The grays of one mode. `page` is the darkest surface, then `card`, `panel`, `menu`. */
export type ThemeMode = {
  /** The window background. Required. */
  page: Hex
  /** Cards and message bubbles: as light as the page or a little lighter. */
  card?: Hex
  /** Side panels and the prompt box. */
  panel?: Hex
  /** Menus and popovers (dark mode; in light mode leave it out). */
  menu?: Hex
  /** Main text. Required. Keep it 7:1 or better against every surface. */
  text: Hex
  /** Secondary text. */
  textSoft?: Hex
  /** Hints and timestamps. */
  textMuted?: Hex
}

/** What sits behind the conversation. Leave it out for the app's own. */
export type ThemeBackground =
  /** A still color: hex, or a palette name such as 'surface-0' that follows light/dark. */
  | { color: string }
  /** A still gradient, top to bottom unless `angle` (degrees) says otherwise. */
  | { gradient: string[]; angle?: number }
  /** A moving SVG scene (see themes/scenes/aurora.ts). `glass` frosts the panels over it. */
  | { scene: string; glass?: { blur?: number; opacity?: number } | false }

export type Theme = {
  /** What you type after /look: lowercase letters, digits and dashes. */
  id: string
  /** The name people see. */
  name: string
  /** One color each; the app keeps the hue and tunes the lightness. */
  colors: {
    /** Buttons, links, focus rings, code keywords. */
    accent: Hex
    /** Errors. Keep it a red. */
    danger: Hex
    /** Success and code strings. Keep it a green. */
    success: Hex
    /** Warnings. Keep it an amber. */
    warning: Hex
    /** Special highlights and code literals. */
    special: Hex
  }
  /** Give both modes for a theme that follows the Mac; give one for a light-only or dark-only theme. */
  light?: ThemeMode
  dark?: ThemeMode
  background?: ThemeBackground
}
