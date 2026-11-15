import type { Color } from 'claude-code'

import type { Phase, Pomo } from '../types'

export const SET = 4
const MINUTES = { focus: 25, short: 5, long: 15 }

export const INITIAL: Pomo = {
  phase: 'focus',
  isRunning: false,
  endsAt: 0,
  remainingMs: MINUTES.focus * 60_000,
  cycle: 0,
  completed: 0,
  minutes: MINUTES,
}

// Change the tag when Pomo's fields change: it declines what an older version stored.
export const POMO_SHAPE = 'pomodoro-1'

export const PHASE_NAME: Record<Phase, string> = { focus: 'Focus', short: 'Short break', long: 'Long break' }
export const PHASE_COLOR: Record<Phase, Color> = { focus: 'claude', short: 'success', long: 'suggestion' }
export const PHASE_ICON: Record<Phase, string> = { focus: '🍅', short: '☕', long: '🌙' }

export const durationMs = (p: Pomo, phase: Phase = p.phase) => p.minutes[phase] * 60_000

export const remaining = (p: Pomo, now: number) => (p.isRunning ? Math.max(0, p.endsAt - now) : p.remainingMs)

export const start = (p: Pomo, now: number): Pomo =>
  p.isRunning ? p : { ...p, isRunning: true, endsAt: now + p.remainingMs }

export const pause = (p: Pomo, now: number): Pomo =>
  p.isRunning ? { ...p, isRunning: false, remainingMs: remaining(p, now) } : p

export const reset = (p: Pomo): Pomo => ({ ...p, isRunning: false, remainingMs: durationMs(p) })

/** Moves to the next phase. `finished` counts a focus session as done; a skip does not. */
export function advance(p: Pomo, finished: boolean): Pomo {
  if (p.phase === 'focus') {
    const cycle = finished ? p.cycle + 1 : p.cycle
    const next: Phase = finished && cycle >= SET ? 'long' : 'short'

    return {
      ...p,
      phase: next,
      isRunning: false,
      remainingMs: durationMs(p, next),
      cycle: next === 'long' ? SET : cycle,
      completed: finished ? p.completed + 1 : p.completed,
    }
  }

  return {
    ...p,
    phase: 'focus',
    isRunning: false,
    remainingMs: durationMs(p, 'focus'),
    cycle: p.phase === 'long' ? 0 : p.cycle,
  }
}

/** The ⚙ button cycles through these lengths. */
export const PRESETS: readonly Pomo['minutes'][] = [
  { focus: 25, short: 5, long: 15 },
  { focus: 50, short: 10, long: 20 },
  { focus: 15, short: 3, long: 10 },
]

export function nextPreset(m: Pomo['minutes']): Pomo['minutes'] {
  const i = PRESETS.findIndex(x => x.focus === m.focus && x.short === m.short && x.long === m.long)

  return PRESETS[(i + 1) % PRESETS.length] ?? MINUTES
}

/** `/pomodoro 50 10 20` sets focus, short and long minutes. */
export function parseMinutes(args: string): Pomo['minutes'] | undefined {
  const nums = args.trim().split(/[\s/,]+/).filter(Boolean).map(Number)

  if (nums.length === 0 || nums.some(n => !Number.isFinite(n) || n <= 0 || n > 240)) {
    return undefined
  }

  return {
    focus: nums[0] ?? MINUTES.focus,
    short: nums[1] ?? MINUTES.short,
    long: nums[2] ?? MINUTES.long,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

export function mmss(ms: number): string {
  const s = Math.ceil(ms / 1000)

  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}

/** The status line's countdown while a timer runs. */
export function pomoStatus(p: Pomo, now: number): string | undefined {
  return p.isRunning ? `${PHASE_ICON[p.phase]} ${mmss(remaining(p, now))}` : undefined
}
