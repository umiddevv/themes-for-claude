import type { Register } from 'claude-code'

import { startClock } from './clock'
import { openPomodoro, registerPomodoro, startPomodoro } from './pomodoro'
import { registerThemes, startThemes } from './themes'
import { registerUsage } from './usage'

// Themes for Claude: themes (/look), a Pomodoro timer with tasks (/pomodoro)
// and a token usage pane (/tokens). Themes live in ../themes.

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    await startThemes($, options)

    await $.command.register({ name: 'tokens', description: 'Open the token usage pane' })
    await $.command.register({
      name: 'pomodoro',
      description: 'Open the Pomodoro timer and tasks; /pomodoro task <text> adds a task, /pomodoro 50 10 20 sets minutes',
    })
    await startPomodoro($)

    if (options.openPomodoro !== false) {
      void openPomodoro($)
    }
    await startClock($)

    return next(e)
  })

  registerThemes(on)
  registerUsage(on)
  registerPomodoro(on)
}
