import type { Theme } from './types'

// Terracotta and sand by day, a dusk-purple desert night after dark.
const sandstone: Theme = {
  id: 'sandstone',
  name: 'Sandstone desert',
  colors: {
    accent: '#c4622d',
    danger: '#b8342f',
    success: '#5f8a3a',
    warning: '#c98a1a',
    special: '#7d5aa6',
  },
  light: {
    page: '#eddfcc',
    card: '#f3e7d7',
    panel: '#f9f2e8',
    text: '#2b1f17',
    textSoft: '#57443a',
    textMuted: '#6c584b',
  },
  dark: {
    page: '#1d1625',
    card: '#241c2e',
    panel: '#2b2237',
    menu: '#32283f',
    text: '#f1e6dc',
    textSoft: '#cdbfb6',
    textMuted: '#a99a93',
  },
  background: { gradient: ['surface-0', 'surface-1', 'surface-2'], angle: 160 },
}

export default sandstone
