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

/** One thing that needs the person, as the ranking model returned it. */
export type NeedItem = {
  id: string
  source: string
  title: string
  why: string
  level: 'now' | 'today' | 'hidden'
  link?: string
  /** When it happened, in milliseconds, when known. */
  at?: number
}

/** The last check, shared by every session through $.store. */
export type NeedsResult = {
  items: NeedItem[]
  checkedAt: number
  hash: string
  /** Apps that could not be read this round, by name (Gmail, Slack, ...). */
  failed: string[]
  /** Why each failed app could not be read, for debugging. */
  failedWhy?: Record<string, string>
  /** The apps found connected this round, by name; empty means none is connected. */
  sources?: string[]
  error?: string
}

/** What one Claude session reports about itself, under `live:<id>` in $.store. */
export type LiveSession = {
  id: string
  title: string
  state: 'working' | 'waiting' | 'idle'
  at: number
  note?: string
}

/** Item id to the time it hides until: 0 means done (hidden for good). */
export type Dismissed = Record<string, number>

/** A Google calendar, as the Today pane lists it. */
export type TodayCal = { id: string; name: string }

/** One event, as the Today pane keeps it. */
export type TodayEv = {
  id: string
  calId: string
  title: string
  start: number
  end: number
  isAllDay: boolean
  days?: [string, string]
  join?: { url: string; label: string }
  open?: string
  isDeclined: boolean
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
      /** The last Needs you check, mirrored from $.store. */
      needsResult: Shaped<NeedsResult>
      /** Done and snoozed items, mirrored to $.store. */
      needsDismissed: Shaped<Dismissed>
      /** Which items the Needs you pane shows. */
      needsFilter: 'all' | 'now'
      /** Bumped every minute and on a filter press, so ages and snoozes redraw. */
      needsTick: number
      /** Every session's own report, read from $.store each minute. */
      needsLive: Shaped<LiveSession[]>
      /** Names whose messages always rank high, mirrored to $.store. */
      needsVips: Shaped<string[]>
      /** Whether the VIP field shows. */
      needsEditing: boolean
      /** The Today pane's calendars, events and the first day they were fetched from. */
      todayCals: Shaped<TodayCal[]>
      todayEvents: Shaped<TodayEv[]>
      todayFrom: string
      /** Calendar ids the Today pane shows, picked in its setup and mirrored to $.store. */
      todayShown: Shaped<string[]>
      /** Whether the calendars were picked (else the setup shows). */
      todayIsSet: boolean
      /** Whether the calendar setup is open again (⚙). */
      todaySetup: boolean
      /** The day the Today pane shows (YYYY-MM-DD), or '' for today. */
      todayDay: string
      /** '' when the calendar loaded, else 'loading', 'none' (no connector) or the error. */
      todayStatus: string
      /** A calendar that couldn't be read this round, shown under the list; '' for none. */
      todayNote: string
      /** Spend per day per session, mirrored from $.store. */
      todayCost: Shaped<Record<string, Record<string, number>>>
      /** Bumped every minute, so badges and the clock redraw. */
      todayTick: number
    }
  }
}
