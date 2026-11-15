import type { Focus, Stats } from '../types'

// Pure logic for the focus line and the daily stats.

export const NO_FOCUS: Focus = { text: '', pomodoros: 0 }
export const FOCUS_SHAPE = 'focus-1'
export const FOCUS_STORE_KEY = 'pomodoro-focus'

export const NO_STATS: Stats = { days: {} }
export const STATS_SHAPE = 'stats-1'
export const STATS_STORE_KEY = 'pomodoro-stats'
export const SOUND_STORE_KEY = 'pomodoro-sound'

const KEEP_DAYS = 30
const MAX_TEXT = 120

/** Sets the focus line. Editing it keeps its 🍅 count; new work starts at zero. */
export function setFocus(f: Focus, text: string, isEdit = false): Focus {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT)

  if (clean === '') return f

  return { text: clean, pomodoros: isEdit ? f.pomodoros : 0 }
}

export function creditFocus(f: Focus): Focus {
  return f.text === '' ? f : { ...f, pomodoros: f.pomodoros + 1 }
}

export function parseFocus(value: unknown): Focus | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const v = value as Partial<Focus>

  return typeof v.text === 'string' && typeof v.pomodoros === 'number' ? { text: v.text, pomodoros: v.pomodoros } : undefined
}

/** Adds one finished focus session of `minutes` to `day`, keeping the last 30 days. */
export function addSession(s: Stats, day: string, minutes: number): Stats {
  const today = s.days[day] ?? { minutes: 0, sessions: 0 }
  const days = { ...s.days, [day]: { minutes: today.minutes + minutes, sessions: today.sessions + 1 } }
  const keep = Object.keys(days).sort().slice(-KEEP_DAYS)

  return { days: Object.fromEntries(keep.map(k => [k, days[k] ?? { minutes: 0, sessions: 0 }])) }
}

export function parseStats(value: unknown): Stats | undefined {
  if (typeof value !== 'object' || value === null || typeof (value as Stats).days !== 'object' || (value as Stats).days === null) {
    return undefined
  }
  const days: Stats['days'] = {}

  for (const [k, v] of Object.entries((value as Stats).days)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v?.minutes === 'number' && typeof v?.sessions === 'number') {
      days[k] = { minutes: v.minutes, sessions: v.sessions }
    }
  }

  return { days }
}

export type DayBar = { day: string; letter: string; minutes: number; isToday: boolean }

/** The seven days ending `today` (YYYY-MM-DD), oldest first. */
export function lastWeek(s: Stats, today: string): DayBar[] {
  const end = Date.parse(`${today}T12:00:00Z`)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(end - (6 - i) * 86_400_000)
    const day = d.toISOString().slice(0, 10)

    return { day, letter: 'SMTWTFS'[d.getUTCDay()] ?? '', minutes: s.days[day]?.minutes ?? 0, isToday: day === today }
  })
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60

  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** A text sparkline for the terminal. */
export function sparkline(bars: DayBar[]): string {
  const max = Math.max(1, ...bars.map(b => b.minutes))

  return bars.map(b => (b.minutes === 0 ? '·' : '▁▂▃▄▅▆▇█'[Math.min(7, Math.round((b.minutes / max) * 7))] ?? '█')).join('')
}
