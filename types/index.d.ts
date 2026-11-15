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

export type Task = {
  id: string
  text: string
  isDone: boolean
  /** Focus sessions finished while this was the current task. */
  pomodoros: number
}

export type TaskList = {
  items: Task[]
  /** The task the timer is working on. */
  activeId?: string
}

declare module 'claude-code' {
  interface PluginState {
    'themes-for-claude': {
      totals: Shaped<Totals>
      pomodoro: Shaped<Pomo>
      /** The Pomodoro task list, mirrored to $.store so it outlives the session. */
      pomodoroTasks: Shaped<TaskList>
      /** Bumped every second while a timer runs, so the pane redraws. */
      pomodoroTick: number
      /** Which card the Pomodoro pane draws on desktop and mobile. */
      pomodoroStyle: 'widget' | 'illustrated'
    }
  }
}
