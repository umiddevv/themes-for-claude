import type { Theme } from './types'

// Warm cream paper by day, lamp-lit paper by night. No animation.
const paper: Theme = {
  id: 'paper',
  name: 'Paper',
  colors: {
    accent: '#2f5d8c',
    danger: '#b3392f',
    success: '#4e7d3a',
    warning: '#a86f14',
    special: '#6d4f94',
  },
  light: {
    page: '#efe6d3',
    card: '#f4ecdc',
    panel: '#faf5e9',
    text: '#2a241d',
    textSoft: '#544a3d',
    textMuted: '#6a5f50',
  },
  dark: {
    page: '#1f1a15',
    card: '#28221b',
    panel: '#312a22',
    menu: '#3a3229',
    text: '#f0e7d7',
    textSoft: '#cfc4b2',
    textMuted: '#aca08d',
  },
}

export default paper
