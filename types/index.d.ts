export type TokenCounts = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export type Totals = TokenCounts & {
  turns: number
  subagentTurns: number
  lastModel?: string
  lastTurn?: TokenCounts
}

export type Phase = 'focus' | 'short' | 'long'

export type Pomo = {
  phase: Phase
  isRunning: boolean
  /** When the running phase ends, in $.clock.now() milliseconds. */
  endsAt: number
  /** Time left while paused. */
  remainingMs: number
  /** Focus sessions finished in the current set of four. */
  cycle: number
  /** Focus sessions finished in all. */
  completed: number
  /** Minutes for focus, short break and long break. */
  minutes: { focus: number; short: number; long: number }
}

/** A task list from 1.0 and 1.1, read once to carry the current task over. */
export type Task = {
  id: string
  text: string
  isDone: boolean
  pomodoros: number
}

export type TaskList = {
  items: Task[]
  activeId?: string
}

/** What you are working on: one line, and the focus sessions it has had. */
export type Focus = {
  text: string
  pomodoros: number
}

/** Focus minutes and sessions per local day (YYYY-MM-DD), the last 30 days kept. */
export type Stats = {
  days: Record<string, { minutes: number; sessions: number }>
}

declare module 'claude-code' {
  interface PluginState {
    'themes-for-claude': {
      totals: Shaped<Totals>
      pomodoro: Shaped<Pomo>
      /** What you are working on, mirrored to $.store so it outlives the session. */
      pomodoroFocus: Shaped<Focus>
      /** Shown as a field while you change the focus line. */
      focusEditing: boolean
      /** Daily focus stats, mirrored to $.store. */
      pomodoroStats: Shaped<Stats>
      /** Whether a phase ending plays the chime, mirrored to $.store. */
      pomodoroSound: boolean
      /** Bumped every second while a timer runs, so the pane redraws. */
      pomodoroTick: number
      /** Which card the Pomodoro pane draws on desktop and mobile. */
      pomodoroStyle: 'widget' | 'illustrated'
      /** The id of the theme in use; drawings that follow the theme read it. */
      themeId: string
    }
  }
}
