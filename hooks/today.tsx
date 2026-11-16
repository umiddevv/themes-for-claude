import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, Timer } from 'claude-code'

import { THEMES } from '../themes'
import type { TodayCal, TodayEv } from '../types'
import { formatTime, localDay, localOffset } from './clock'
import { mcpText } from './mcp-text'
import { findSources } from './needs-core'
import { pomoPalette } from './pomo-theme'
import { findTheme } from './themes'
import { calColors, eventCard, usageCard, weekStrip } from './today-card'
import { addDays, badge, busy, costDays, dayStart, eventsOn, isOwnCalendar, limitLabel, nextCost, nextFree, parseCalendars, parseEvents, resetText, spent, weekDays } from './today-core'
import type { CostDays, CostState } from './today-core'

// The Today pane: what Claude cost today and this week across sessions, the
// plan limits, and the person's Google calendars with join links. The
// calendar is read as JSON from the Calendar connector: no model, no tokens.

export const TODAY_PANE = 'today-pane'
const TITLE = 'Today'
const MAX_CALS = 6
const REFRESH_MS = 5 * 60_000
/** Event cards leave room for their Join button. */
const CARD_W = 256

const calsAtom = atom({ plugin: 'themes-for-claude', key: 'todayCals' } as const, [] as TodayCal[], { shape: 'today-cals-1' })
const eventsAtom = atom({ plugin: 'themes-for-claude', key: 'todayEvents' } as const, [] as TodayEv[], { shape: 'today-events-1' })
const fromAtom = atom({ plugin: 'themes-for-claude', key: 'todayFrom' } as const, '')
const shownAtom = atom({ plugin: 'themes-for-claude', key: 'todayShown' } as const, [] as string[], { shape: 'today-shown-1' })
const isSetAtom = atom({ plugin: 'themes-for-claude', key: 'todayIsSet' } as const, false)
const setupAtom = atom({ plugin: 'themes-for-claude', key: 'todaySetup' } as const, false)
const dayAtom = atom({ plugin: 'themes-for-claude', key: 'todayDay' } as const, '')
const statusAtom = atom({ plugin: 'themes-for-claude', key: 'todayStatus' } as const, 'loading')
const noteAtom = atom({ plugin: 'themes-for-claude', key: 'todayNote' } as const, '')
const costAtom = atom({ plugin: 'themes-for-claude', key: 'todayCost' } as const, {} as CostDays, { shape: 'today-cost-1' })
const tickAtom = atom({ plugin: 'themes-for-claude', key: 'todayTick' } as const, 0)
const themeAtom = atom({ plugin: 'themes-for-claude', key: 'themeId' } as const, THEMES[0]?.id ?? '')

let timers: Timer[] = []
let isLoading = false
/** A load asked for while one ran: done right after, so a week change is never dropped. */
let pendingDay: string | undefined

/** Reads the shown calendars' events for the week holding `day` (default: the day on screen), plus one day. */
export async function loadCalendar($: EngineInterface, day?: string): Promise<void> {
  if (isLoading) {
    pendingDay = day ?? ''

    return
  }
  isLoading = true

  try {
    const today = localDay(await $.clock.now(), localOffset())
    const from = weekDays(day || (await read($, dayAtom)) || today)[0] ?? today
    const server = findSources((await $.tool.list()).filter(t => t.mcp).map(t => t.name)).find(s => s.kind === 'calendar')?.server

    if (server === undefined) {
      await update($, statusAtom, () => 'none')

      return
    }
    const cals = parseCalendars(await mcpText($, server, 'list_calendars', {}))
    if (cals === undefined) throw new Error('the connector gave an answer that is not a calendar list')
    const shown = await shownFor($, cals)
    const previous = (await read($, fromAtom)) === from ? await read($, eventsAtom) : []
    const events: TodayEv[] = []
    const failed: string[] = []

    for (const c of cals.filter(c => shown.includes(c.id)).slice(0, MAX_CALS)) {
      try {
        const text = await mcpText($, server, 'list_events', { calendarId: c.id, startTime: `${from}T00:00:00`, endTime: `${addDays(from, 8)}T00:00:00`, pageSize: 250, orderBy: 'startTime' })
        events.push(...parseEvents(text, c.id))
      } catch {
        // Keep what this calendar showed before, and say it couldn't be read.
        failed.push(c.name)
        events.push(...previous.filter(ev => ev.calId === c.id))
      }
    }
    await update($, calsAtom, () => cals)
    await update($, eventsAtom, () => events)
    await update($, fromAtom, () => from)
    await update($, statusAtom, () => '')
    await update($, noteAtom, () => (failed.length === 0 ? '' : `Couldn't read ${failed.join(', ')} just now.`))
  } catch (err) {
    const why = `Couldn't read the calendar: ${err instanceof Error ? err.message : String(err)}`

    // With something on screen already, keep it and say so; else show the reason.
    if ((await read($, eventsAtom)).length > 0) await update($, noteAtom, () => why)
    else await update($, statusAtom, () => why)
  } finally {
    isLoading = false
    const next = pendingDay
    pendingDay = undefined
    if (next !== undefined) await loadCalendar($, next || undefined)
  }
}

/** The calendars to show: the ones picked in setup, or until then the person's own (no holidays, no shared family ones). */
async function shownFor($: EngineInterface, cals: TodayCal[]): Promise<string[]> {
  if (await read($, isSetAtom)) return read($, shownAtom)
  const own = cals.filter(c => isOwnCalendar(c.id)).map(c => c.id)
  await update($, shownAtom, () => own)

  return own
}

async function loadSaved($: EngineInterface): Promise<void> {
  const shown = await $.store.get('today-shown')

  if (Array.isArray(shown)) {
    await update($, shownAtom, () => shown.filter((h): h is string => typeof h === 'string'))
    await update($, isSetAtom, () => true)
  }
  const entries: Record<string, unknown> = {}

  for (const key of (await $.store.keys()).filter(k => k.startsWith('cost:'))) entries[key] = await $.store.get(key)
  const days = costDays(entries)
  await update($, costAtom, () => days)
}

/** After a turn: this session's running cost, recorded under its own key. Called from usage.tsx's turn.complete hook. */
export async function recordCost($: EngineInterface): Promise<void> {
  const usage = await $.session.usage().catch(() => undefined)
  const usd = usage?.cost?.usd
  if (usage === undefined || usd === undefined) return
  const offset = localOffset()
  const day = localDay(await $.clock.now(), offset)
  const key = `cost:${await $.session.id()}`
  const state = nextCost((await $.store.get(key)) as CostState | undefined, usd, usage.startedAt, day, dayStart(day, offset))

  await $.store.set(key, state)
  await loadSaved($)
}

async function isOpen($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes()).some(p => p.id === TODAY_PANE)
}

/** Every minute: spend from other sessions and fresh badges, while the pane is open. */
async function minuteTick($: EngineInterface): Promise<void> {
  if (!(await isOpen($))) return
  await loadSaved($)
  await update($, tickAtom, n => n + 1)
}

/** Every 5 minutes: the calendar, while the pane is open. */
async function calendarTick($: EngineInterface): Promise<void> {
  if (await isOpen($)) await loadCalendar($)
}

export async function openToday($: EngineInterface) {
  return $.ui.open({ id: TODAY_PANE, title: TITLE })
}

export async function startToday($: EngineInterface, options: Record<string, unknown>): Promise<void> {
  await $.command.register({ name: 'today', description: 'Open the Today pane: what Claude cost, your limits and your calendar' })
  await loadSaved($)
  for (const t of timers) t.cancel()
  timers = [$.clock.every(60_000, () => void minuteTick($)), $.clock.every(REFRESH_MS, () => void calendarTick($))]

  if (options.openToday !== false) {
    void loadCalendar($)
    void openToday($)
  }
}

async function goTo($: EngineInterface, day: string): Promise<void> {
  const today = localDay(await $.clock.now())
  await update($, dayAtom, () => (day === today ? '' : day))
  const from = await read($, fromAtom)

  if (from === '' || day < from || day >= addDays(from, 7)) await loadCalendar($, day)
}

/** In setup: picks or unpicks a calendar. */
async function pickCal($: EngineInterface, id: string): Promise<void> {
  await update($, shownAtom, h => (h.includes(id) ? h.filter(x => x !== id) : [...h, id]))
}

/** Saves the picked calendars and reads them. */
async function finishSetup($: EngineInterface): Promise<void> {
  await $.store.set('today-shown', await read($, shownAtom))
  await update($, isSetAtom, () => true)
  await update($, setupAtom, () => false)
  await loadCalendar($)
}

/** Opens a meeting or event link in the browser (links were checked when the event was read). */
async function openLink($: EngineInterface, url: string): Promise<void> {
  if (url.startsWith('https://')) await $.process.run(['open', url], { timeoutMs: 5000 })
}

const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function registerToday(on: On): void {
  on('command.run', { command: 'today' }, async $ => {
    await loadSaved($)
    await loadCalendar($)
    await openToday($)

    return { text: 'Today pane opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: TODAY_PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text, Button } = elements
    const Svg = e.surface !== 'terminal' && 'Svg' in elements ? elements.Svg : undefined
    const theme = findTheme(await read($, themeAtom))
    const palette = pomoPalette(theme)
    const colors = calColors(palette, theme?.colors.special ?? '#8b5cf6', theme?.colors.success ?? '#3b82f6')
    await read($, tickAtom)
    const now = await $.clock.now()
    const offset = localOffset()
    const today = localDay(now, offset)
    const day = (await read($, dayAtom)) || today
    const cals = await read($, calsAtom)
    const events = await read($, eventsAtom)
    const shown = await read($, shownAtom)
    const isSetUp = await read($, isSetAtom)
    const isInSetup = await read($, setupAtom)
    const hidden = cals.filter(c => !shown.includes(c.id)).map(c => c.id)
    const status = await read($, statusAtom)
    const note = await read($, noteAtom)
    const from = await read($, fromAtom)
    const cost = spent(await read($, costAtom), today)
    const usage = await $.session.usage().catch(() => undefined)
    const ctx = usage?.context
    const contextPct = ctx === undefined ? undefined : (ctx.percent ?? ((ctx.tokens ?? 0) / Math.max(1, ctx.window)) * 100)
    const limits = (usage?.rateLimits ?? []).map(l => ({ name: limitLabel(l.kind), pct: l.percentUsed, resets: resetText(l.resetsAt, now, offset) }))
    const colorOf = (calId: string) => colors[Math.max(0, cals.findIndex(c => c.id === calId)) % colors.length] ?? palette.accent
    const nameOf = (calId: string) => cals.find(c => c.id === calId)?.name ?? ''

    const week = weekDays(day)
    const isLoaded = from !== '' && day >= from && day < addDays(from, 8)
    const dayEvents = isLoaded ? eventsOn(events, day, hidden, offset) : []
    const startOfDay = dayStart(day, offset)
    // All-day events, and blocks that began on an earlier day, are a line of text.
    const allDay = dayEvents.filter(ev => ev.isAllDay || ev.start < startOfDay)
    const timed = dayEvents.filter(ev => !ev.isAllDay && ev.start >= startOfDay)
    const lineOf = (ev: TodayEv) =>
      ev.isAllDay ? `All day · ${ev.title}` : `${ev.title} · until ${localDay(ev.end, offset) === day ? '' : `${SHORT[(new Date(`${localDay(ev.end, offset)}T00:00:00Z`).getUTCDay() + 6) % 7]} `}${formatTime(ev.end, offset)}`
    const tomorrow = eventsOn(events, addDays(today, 1), hidden, offset).length
    const free = day === today ? nextFree(events.filter(ev => !hidden.includes(ev.calId) && !ev.isDeclined), today, now, offset) : ''
    const footer = [day === today && tomorrow > 0 ? `+${tomorrow} tomorrow` : '', free === '' ? '' : `next free ${free}`].filter(t => t !== '').join(' · ')
    const dayTitle = day === today ? 'Today' : `${SHORT[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7]} ${Number(day.slice(8))}`
    const calNote = status === 'none' ? 'Connect Google Calendar to see your meetings: + next to the prompt, then Connectors.' : status === 'loading' ? 'Loading your calendar…' : status

    const usageAlt = `Spent today $${cost.today.toFixed(2)}, last 7 days $${cost.week.toFixed(2)}. ${limits.map(l => `${l.name} ${Math.round(l.pct)}%`).join(', ')}`
    const nav = (
      <Box flexDirection="row" gap={1} justifyContent="center" alignItems="center" flexWrap="wrap">
        <Button key="today-prev" label="‹" plain onPress={() => void goTo($, addDays(day, -1))} />
        <Button key="today-today" label={dayTitle} variant={day === today ? 'primary' : 'secondary'} onPress={() => void goTo($, today)} />
        <Button key="today-next" label="›" plain onPress={() => void goTo($, addDays(day, 1))} />
        <Button key="today-refresh" label="↻" plain dimColor onPress={() => void loadCalendar($)} />
        <Button key="today-setup" label="⚙" plain dimColor onPress={() => void update($, setupAtom, v => !v)} />
      </Box>
    )
    const showSetup = status === '' && cals.length > 0 && (!isSetUp || isInSetup)
    const setup = (
      <Box flexDirection="column" gap={1} alignItems="center">
        <Text dimColor>Which calendars should Today show? Pick your work ones.</Text>
        <Box flexDirection="row" gap={1} justifyContent="center" flexWrap="wrap">
          {cals.map((c, i) => (
            <Button key={`today-pick-${i}`} label={`${shown.includes(c.id) ? '●' : '○'} ${c.name}`} variant={shown.includes(c.id) ? 'primary' : 'secondary'} onPress={() => void pickCal($, c.id)} />
          ))}
        </Box>
        <Button key="today-setup-done" label="Done" variant="primary" onPress={() => void finishSetup($)} />
      </Box>
    )
    const linkOf = (ev: TodayEv) => ev.join?.url ?? ev.open
    const empty = status !== '' ? '' : !isLoaded ? 'Loading this week…' : dayEvents.length === 0 ? 'Nothing on this day.' : ''

    // ---- Desktop, mobile and the editor: picture cards ----
    if (Svg !== undefined) {
      return (
        <Box flexDirection="column" gap={1} alignItems="center">
          <Svg source={usageCard({ today: cost.today, week: cost.week, sessions: cost.sessions, contextPct, limits }, palette)} alt={usageAlt} />
          {status !== '' ? (
            <Text dimColor>{calNote}</Text>
          ) : (
            <Box flexDirection="column" gap={1} alignItems="center">
              <Svg
                source={weekStrip(
                  week.map((d, i) => ({ label: SHORT[i] ?? '', num: Number(d.slice(8)), dots: busy(events, d, hidden, offset), colors: eventsOn(events, d, hidden, offset).map(ev => colorOf(ev.calId)) })),
                  week.indexOf(day),
                  palette,
                )}
                alt={`Week of ${week[0]}`}
              />
              {nav}
              {showSetup && setup}
              {allDay.map(ev => (
                <Text key={`today-allday-${ev.calId}-${ev.id}`} dimColor>{`${lineOf(ev)} · ${nameOf(ev.calId)}`}</Text>
              ))}
              {empty !== '' && <Text dimColor>{empty}</Text>}
              {timed.map(ev => {
                const url = linkOf(ev)

                // The card and, beside it, one tap: Join for a meeting, ↗ for the event in Calendar.
                return (
                  <Box key={`today-row-${ev.calId}-${ev.id}`} flexDirection="row" alignItems="center" gap={1}>
                    <Svg source={eventCard(ev, badge(ev, now), colorOf(ev.calId), nameOf(ev.calId), palette, offset, CARD_W)} alt={`${formatTime(ev.start, offset)} ${ev.title}, ${nameOf(ev.calId)}`} />
                    {url !== undefined && (
                      <Button key={`today-ev-${ev.calId}-${ev.id}`} label={ev.join === undefined ? '↗' : 'Join'} variant={ev.join === undefined ? 'secondary' : 'primary'} onPress={() => void openLink($, url)} />
                    )}
                  </Box>
                )
              })}
              {footer !== '' && <Text dimColor>{footer}</Text>}
              {note !== '' && <Text dimColor>{note}</Text>}
            </Box>
          )}
        </Box>
      )
    }

    // ---- The terminal: text ----
    return (
      <Box flexDirection="column" gap={1} paddingX={1}>
        <Text weight="semibold">{`Spent today $${cost.today.toFixed(2)} · 7 days $${cost.week.toFixed(2)}`}</Text>
        {limits.map(l => (
          <Text key={`today-lim-${l.name}`} dimColor>{`${l.name} ${Math.round(l.pct)}%${l.resets === '' ? '' : ` · resets ${l.resets}`}`}</Text>
        ))}
        {status !== '' ? <Text dimColor>{calNote}</Text> : nav}
        {showSetup && setup}
        {allDay.map(ev => (
          <Text key={`today-allday-${ev.calId}-${ev.id}`} dimColor>{lineOf(ev)}</Text>
        ))}
        {empty !== '' && <Text dimColor>{empty}</Text>}
        {timed.map(ev => {
          const text = `${formatTime(ev.start, offset)}–${formatTime(ev.end, offset)}  ${ev.title}${badge(ev, now) === '' ? '' : `  (${badge(ev, now)})`}${ev.join === undefined ? '' : `  · join ${ev.join.label}`}`
          const url = linkOf(ev)

          return url === undefined ? <Text key={`today-ev-${ev.calId}-${ev.id}`}>{text}</Text> : <Button key={`today-ev-${ev.calId}-${ev.id}`} label={text} plain onPress={() => void openLink($, url)} />
        })}
        {footer !== '' && <Text dimColor>{footer}</Text>}
        {note !== '' && <Text dimColor>{note}</Text>}
      </Box>
    )
  })
}
