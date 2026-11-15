import scene from './scenes/glyph-sea'
import type { Theme } from './types'

// A deep sea of code characters: a whale, a manta, a jellyfish and a school of
// fish made of glyphs drift behind the chat while glyph bubbles rise. Ink on
// pale water by day.
const glyphSea: Theme = {
  id: 'glyph-sea',
  name: 'Glyph sea',
  colors: {
    accent: '#3fb6b0',
    danger: '#e5534b',
    success: '#57ab5a',
    warning: '#c69026',
    special: '#a371f7',
  },
  light: {
    page: '#e6edef',
    card: '#edf2f4',
    panel: '#f5f8f9',
    text: '#0f1a1f',
    textSoft: '#33464f',
    textMuted: '#4b5f69',
  },
  dark: {
    page: '#080c11',
    card: '#0d131a',
    panel: '#111921',
    menu: '#151e27',
    text: '#e3edf1',
    textSoft: '#b3c3cb',
    textMuted: '#8c9ea8',
  },
  // Light frosting, so the creatures stay visible behind the panels.
  background: { scene, glass: { blur: 4, opacity: 0.55 } },
  // The ring takes the scene's coral spark for focus.
  pomodoro: { focus: '#ff6b5e' },
}

export default glyphSea
