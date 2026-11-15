import type { Theme } from './types'

// Muted green-gray surfaces, a mossy accent and warm amber highlights.
const forest: Theme = {
  id: 'forest',
  name: 'Forest moss',
  colors: {
    accent: '#4f8a5b',
    danger: '#b94a3e',
    success: '#5d9b4a',
    warning: '#c08a2e',
    special: '#7a6aa8',
  },
  light: {
    page: '#e4eae1',
    card: '#ebf0e8',
    panel: '#f4f7f2',
    text: '#1a231b',
    textSoft: '#3d4a3e',
    textMuted: '#536055',
  },
  dark: {
    page: '#131915',
    card: '#19211b',
    panel: '#1f2921',
    menu: '#253027',
    text: '#e5ede3',
    textSoft: '#c0cbbe',
    textMuted: '#99a696',
  },
  background: { gradient: ['surface-0', 'surface-2'], angle: 180 },
}

export default forest
