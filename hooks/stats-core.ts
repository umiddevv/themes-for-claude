import type { Stats, Tags } from '../types'

// Pure logic for session tags and the daily stats.

export const DEFAULT_TAGS: Tags = { tags: ['work', 'study', 'code', 'read'] }
export const TAGS_SHAPE = 'tags-1'
export const TAGS_STORE_KEY = 'pomodoro-tags'

export const NO_STATS: Stats = { days: {} }
export const STATS_SHAPE = 'stats-1'
export const STATS_STORE_KEY = 'pomodoro-stats'
export const SOUND_STORE_KEY = 'pomodoro-sound'

const KEEP_DAYS = 30
const MAX_TAGS = 8

/** A tag as typed, made plain: lowercase letters, digits and dashes, 16 at most; '' when nothing is left. */
export function cleanTag(text: string): string {
  return text
    .trim()
    .replace(/^#/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .slice(0, 16)
}

/** Chooses a tag, adding it when it is new; choosing the chosen one clears the choice. */
export function chooseTag(t: Tags, text: string): Tags {
  const tag = cleanTag(text)

  if (tag === '') return t
  if (t.current === tag) return { tags: t.tags }
  const tags = t.tags.includes(tag) ? t.tags : [...t.tags, tag].slice(-MAX_TAGS)

  return { tags, current: tag }
}

/** Adds a tag without choosing it. */
export function addTag(t: Tags, text: string): Tags {
  const tag = cleanTag(text)

  return tag === '' || t.tags.includes(tag) ? t : { ...t, tags: [...t.tags, tag].slice(-MAX_TAGS) }
}

export function removeTag(t: Tags, text: string): Tags {
  const tag = cleanTag(text)
  const tags = t.tags.filter(x => x !== tag)

  return t.current === tag ? { tags } : { ...t, tags }
}

export function parseTags(value: unknown): Tags | undefined {
  if (typeof value !== 'object' || value === null || !Array.isArray((value as Tags).tags)) return undefined
  const v = value as { tags: unknown[]; current?: unknown }
  const tags = [...new Set(v.tags.filter((x): x is string => typeof x === 'string').map(cleanTag).filter(x => x !== ''))].slice(0, MAX_TAGS)
  const current = typeof v.current === 'string' && tags.includes(v.current) ? v.current : undefined

  return current === undefined ? { tags } : { tags, current }
}

/** Adds one finished focus session of `minutes` (under `tag`, if any) to `day`, keeping the last 30 days. */
export function addSession(s: Stats, day: string, minutes: number, tag?: string): Stats {
  const today = s.days[day] ?? { minutes: 0, sessions: 0 }
  const byTag = tag === undefined ? today.byTag : { ...today.byTag, [tag]: (today.byTag?.[tag] ?? 0) + minutes }
  const entry = { minutes: today.minutes + minutes, sessions: today.sessions + 1, ...(byTag === undefined ? {} : { byTag }) }
  const days = { ...s.days, [day]: entry }
  const keep = Object.keys(days).sort().slice(-KEEP_DAYS)

  return { days: Object.fromEntries(keep.map(k => [k, days[k] ?? { minutes: 0, sessions: 0 }])) }
}

/** Today's minutes per tag, largest first. */
export function tagBreakdown(s: Stats, day: string): { tag: string; minutes: number }[] {
  return Object.entries(s.days[day]?.byTag ?? {})
    .map(([tag, minutes]) => ({ tag, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
}

export function parseStats(value: unknown): Stats | undefined {
  if (typeof value !== 'object' || value === null || typeof (value as Stats).days !== 'object' || (value as Stats).days === null) {
    return undefined
  }
  const days: Stats['days'] = {}

  for (const [k, v] of Object.entries((value as Stats).days)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v?.minutes === 'number' && typeof v?.sessions === 'number') {
      const byTag = Object.fromEntries(
        Object.entries(typeof v.byTag === 'object' && v.byTag !== null ? v.byTag : {}).filter(
          (e): e is [string, number] => typeof e[1] === 'number',
        ),
      )
      days[k] = { minutes: v.minutes, sessions: v.sessions, ...(Object.keys(byTag).length > 0 ? { byTag } : {}) }
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
