import type { TodayCal, TodayEv } from '../types'
import { formatTime, localDay } from './clock'

// The Today pane's plain logic: reading the Google Calendar connector's JSON,
// picking safe links, laying out a day and a week, and adding up what Claude
// cost across sessions.

export type Cal = TodayCal
export type Ev = TodayEv
export type CostDays = Record<string, Record<string, number>>

const JOIN_HOSTS: [RegExp, string][] = [
  [/^meet\.google\.com$/, 'Meet'],
  [/^([a-z0-9-]+\.)*zoom\.us$/, 'Zoom'],
  [/^teams\.(microsoft|live)\.com$/, 'Teams'],
  [/^([a-z0-9-]+\.)*webex\.com$/, 'Webex'],
]
const OPEN_HOSTS = /^(www|calendar)\.google\.com$/

function hostOf(url: string): string | undefined {
  try {
    const u = new URL(url)

    return u.protocol === 'https:' ? u.hostname : undefined
  } catch {
    return undefined
  }
}

/** A URL as written in free text: HTML escapes decoded, trailing punctuation dropped. */
function cleanUrl(url: string): string {
  return url.replace(/&amp;/g, '&').replace(/[.,;:!?]+$/, '')
}

function asJoin(raw: unknown): { url: string; label: string } | undefined {
  if (typeof raw !== 'string') return undefined
  const url = cleanUrl(raw)
  const host = hostOf(url)
  const hit = host === undefined ? undefined : JOIN_HOSTS.find(([re]) => re.test(host))

  return hit === undefined ? undefined : { url, label: hit[1] }
}

const URLS = /https:\/\/[^\s"'<>)\]]+/g

/** The meeting link: Meet's own, then the conference's video entry, then a meeting URL in the location or description. */
export function joinLink(raw: Record<string, unknown>): { url: string; label: string } | undefined {
  const conf = raw.conferenceData as { entryPoints?: { entryPointType?: string; uri?: string }[] } | undefined
  const video = conf?.entryPoints?.find(p => p.entryPointType === 'video')?.uri
  const texts = [raw.location, raw.description].filter((t): t is string => typeof t === 'string')

  return asJoin(raw.hangoutLink) ?? asJoin(video) ?? texts.flatMap(t => t.match(URLS) ?? []).map(asJoin).find(j => j !== undefined)
}

function json(text: string): Record<string, unknown> | undefined {
  try {
    const v: unknown = JSON.parse(text)

    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

/** The calendars, or undefined when the answer is not the connector's JSON. */
/** A calendar of the person's own (an account), not a holiday, birthday or shared group calendar. */
export function isOwnCalendar(id: string): boolean {
  return !id.includes('#') && !id.includes('@group.') && !id.endsWith('calendar.google.com')
}

export function parseCalendars(text: string): Cal[] | undefined {
  const list = json(text)?.calendars

  if (!Array.isArray(list)) return undefined

  return list
    .filter((c): c is { id: string; summary?: string } => typeof c === 'object' && c !== null && typeof (c as { id?: unknown }).id === 'string')
    .map(c => ({ id: c.id, name: typeof c.summary === 'string' && c.summary !== '' ? c.summary : c.id }))
}

type When = { dateTime?: string; date?: string }

/** The events; throws when the answer is not the connector's JSON. */
export function parseEvents(text: string, calId: string): Ev[] {
  const list = json(text)?.events
  if (!Array.isArray(list)) throw new Error(`unexpected answer: ${text.slice(0, 60)}`)
  const out: Ev[] = []

  for (const raw of list as Record<string, unknown>[]) {
    if (typeof raw !== 'object' || raw === null || raw.status === 'cancelled' || typeof raw.id !== 'string') continue
    const start = raw.start as When | undefined
    const end = raw.end as When | undefined
    const isAllDay = typeof start?.date === 'string'
    const s = isAllDay ? Date.parse(`${start?.date}T00:00:00Z`) : Date.parse(start?.dateTime ?? '')
    const e = isAllDay ? Date.parse(`${end?.date ?? start?.date}T00:00:00Z`) : Date.parse(end?.dateTime ?? '')
    if (!Number.isFinite(s)) continue
    const attendees = Array.isArray(raw.attendees) ? (raw.attendees as { self?: boolean; responseStatus?: string }[]) : []
    const open = typeof raw.htmlLink === 'string' && OPEN_HOSTS.test(hostOf(raw.htmlLink) ?? '') ? raw.htmlLink : undefined
    const join = joinLink(raw)

    out.push({
      id: raw.id,
      calId,
      title: typeof raw.summary === 'string' && raw.summary !== '' ? raw.summary : 'Busy',
      start: s,
      end: Number.isFinite(e) ? e : s,
      isAllDay,
      ...(isAllDay ? { days: [String(start?.date), String(end?.date ?? start?.date)] as [string, string] } : {}),
      ...(join === undefined ? {} : { join }),
      ...(open === undefined ? {} : { open }),
      isDeclined: attendees.some(a => a.self === true && a.responseStatus === 'declined'),
    })
  }

  return out
}

/** Local midnight starting `day`, in milliseconds. */
export function dayStart(day: string, offset?: number): number {
  const utc = Date.parse(`${day}T00:00:00Z`)

  return utc - (offset ?? -new Date(utc).getTimezoneOffset()) * 60_000
}

/** Whether an event falls on the local day: all-day by date, timed by overlap, so multi-day blocks show on each day. */
function isOn(ev: Ev, day: string, offset?: number): boolean {
  if (ev.isAllDay && ev.days !== undefined) return ev.days[0] <= day && day < ev.days[1]
  const from = dayStart(day, offset)
  const to = from + 86_400_000

  return ev.end > ev.start ? ev.start < to && ev.end > from : ev.start >= from && ev.start < to
}

/** One day's events: all-day first, then by start; without declined ones, hidden calendars, or the same meeting twice. */
export function eventsOn(evs: Ev[], day: string, hidden: string[], offset?: number): Ev[] {
  const seen = new Set<string>()

  return evs
    .filter(e => !e.isDeclined && !hidden.includes(e.calId) && isOn(e, day, offset))
    .filter(e => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => Number(b.isAllDay) - Number(a.isAllDay) || a.start - b.start)
}

/** How busy a day looks on the strip: 0 to 3 dots. */
export function busy(evs: Ev[], day: string, hidden: string[], offset?: number): 0 | 1 | 2 | 3 {
  return Math.min(3, eventsOn(evs, day, hidden, offset).length) as 0 | 1 | 2 | 3
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** The 7 days of the week holding `day`, Monday first. */
export function weekDays(day: string): string[] {
  const dow = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7

  return Array.from({ length: 7 }, (_, i) => addDays(day, i - dow))
}

export { addDays }

/** `in 20 min` under an hour before, `now` while it runs, `done` after. */
export function badge(ev: Ev, now: number): string {
  if (ev.isAllDay) return ''
  if (now >= ev.end) return 'done'
  if (now >= ev.start) return 'now'
  const mins = Math.ceil((ev.start - now) / 60_000)

  return mins <= 60 ? `in ${mins} min` : ''
}

/** The first gap of 30 minutes or more between now (or 09:00) and 19:00 on `day`. */
export function nextFree(evs: Ev[], day: string, now: number, offset?: number): string {
  const shift = (offset ?? -new Date(now).getTimezoneOffset()) * 60_000
  const midnight = Date.parse(`${day}T00:00:00Z`) - shift
  let from = Math.max(now, midnight + 9 * 3_600_000)
  const until = midnight + 19 * 3_600_000
  const busyTimes = eventsOn(evs, day, [], offset).filter(e => !e.isAllDay)

  for (const e of [...busyTimes, { start: until, end: until }]) {
    if (e.end <= from) continue
    if (Math.min(e.start, until) - from >= 30 * 60_000) return `${formatTime(from, offset)}–${formatTime(Math.min(e.start, until), offset)}`
    from = Math.max(from, e.end)
    if (from >= until) break
  }

  return ''
}

/** One session's spend: its last running total and what it added on each day. */
export type CostState = { last: number; days: Record<string, number> }

/**
 * The next state after a session reports its running total. A session first
 * seen after it started before today (resumed, or open when the mod arrived)
 * counts $0 until it spends more; after that each report adds its growth.
 */
export function nextCost(state: CostState | undefined, total: number, startedAt: number, day: string, midnight: number): CostState {
  if (state === undefined) {
    return { last: total, days: startedAt < midnight ? {} : { [day]: total } }
  }
  const delta = total >= state.last ? total - state.last : total
  const days = { ...state.days, [day]: (state.days[day] ?? 0) + delta }
  const keep = Object.keys(days).sort().slice(-14)

  return { last: total, days: Object.fromEntries(keep.map(d => [d, days[d] ?? 0])) }
}

/** Every session's spend by day, from the store's `cost:<session>` entries. */
export function costDays(entries: Record<string, unknown>): CostDays {
  const out: CostDays = {}

  for (const [key, v] of Object.entries(entries)) {
    if (!key.startsWith('cost:') || typeof v !== 'object' || v === null) continue
    const days = (v as { days?: unknown }).days
    if (typeof days !== 'object' || days === null) continue

    for (const [d, usd] of Object.entries(days as Record<string, unknown>)) {
      if (typeof usd === 'number') out[d] = { ...(out[d] ?? {}), [key.slice(5)]: usd }
    }
  }

  return out
}

const round = (n: number) => Math.round(n * 100) / 100

/** Spent today and in the 7 days to today, and how many sessions spent anything today. */
export function spent(days: CostDays, today: string): { today: number; week: number; sessions: number } {
  const sum = (d: string) => Object.values(days[d] ?? {}).reduce((a, b) => a + b, 0)
  const week = Array.from({ length: 7 }, (_, i) => sum(addDays(today, -i))).reduce((a, b) => a + b, 0)

  return { today: round(sum(today)), week: round(week), sessions: Object.values(days[today] ?? {}).filter(v => v > 0).length }
}

/** A plan limit's name, as people say it. */
export function limitLabel(kind: string): string {
  if (kind === 'five_hour') return '5-hour limit'
  if (kind === 'seven_day') return 'Weekly limit'
  if (kind === 'spend_limit') return 'Spend limit'
  const m = /^seven_day_(\w+)$/.exec(kind)
  if (m !== null) return `Weekly · ${(m[1] ?? '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())}`

  return kind.replace(/_/g, ' ')
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** When a limit resets: the time if it's today, else the weekday. */
export function resetText(resetsAt: string | undefined, now: number, offset?: number): string {
  const at = resetsAt === undefined ? NaN : Date.parse(resetsAt)
  if (!Number.isFinite(at)) return ''

  return localDay(at, offset) === localDay(now, offset) ? formatTime(at, offset) : (WEEKDAY[new Date(`${localDay(at, offset)}T00:00:00Z`).getUTCDay()] ?? '')
}
