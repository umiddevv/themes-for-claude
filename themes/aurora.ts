import scene from './scenes/aurora'
import type { Theme } from './types'

// Icy blue by day, deep polar night after dark, with a slow aurora behind the chat.
const aurora: Theme = {
  id: 'aurora',
  name: 'Aurora night',
  colors: {
    accent: '#23a998',
    danger: '#d9475b',
    success: '#4fae6e',
    warning: '#d6962c',
    special: '#8a6fe0',
  },
  light: {
    page: '#e3ecf5',
    card: '#ebf2f9',
    panel: '#f5f9fc',
    text: '#0f1d2c',
    textSoft: '#304357',
    textMuted: '#4a5d72',
  },
  dark: {
    page: '#0a111e',
    card: '#0f1828',
    panel: '#141f32',
    menu: '#18243a',
    text: '#e8f0fa',
    textSoft: '#b9c7da',
    textMuted: '#91a3bb',
  },
  background: { scene, glass: { blur: 22, opacity: 0.7 } },
}

export default aurora
