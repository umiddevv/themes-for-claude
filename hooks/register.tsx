import type { Register } from 'claude-code'

import { startClock } from './clock'
import { registerNeeds, startNeeds } from './needs'
import { openPomodoro, registerPomodoro, startPomodoro } from './pomodoro'
import { registerThemes, startThemes } from './themes'
import { registerToday, startToday } from './today'
import { registerUsage } from './usage'

// Themes for Claude: themes (/look), a Pomodoro timer with tags (/pomodoro),
// a Needs you pane (/needs), a Today pane with usage and calendar (/today)
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
    // The clock first: it learns the Mac's time zone, which Today and Needs you use.
    await startClock($)
    await startNeeds($, options)
    await startToday($, options)

    return next(e)
  })

  registerThemes(on)
  registerUsage(on)
  registerPomodoro(on)
  registerNeeds(on)
  registerToday(on)
}
