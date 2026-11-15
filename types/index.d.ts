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

/** The tags you can tag a focus session with, and the one chosen now. */
export type Tags = {
  tags: string[]
  current?: string
}

/** Focus minutes and sessions per local day (YYYY-MM-DD), the last 30 days kept. */
export type Stats = {
  days: Record<string, { minutes: number; sessions: number; byTag?: Record<string, number> }>
}

declare module 'claude-code' {
  interface PluginState {
    'themes-for-claude': {
      totals: Shaped<Totals>
      pomodoro: Shaped<Pomo>
      /** The tags and the chosen one, mirrored to $.store so they outlive the session. */
      pomodoroTags: Shaped<Tags>
      /** Whether the tag row shows the add field and remove buttons. */
      tagsEditing: boolean
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
