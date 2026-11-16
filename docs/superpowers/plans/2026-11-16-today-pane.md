# Today Pane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a Today pane (`/today`) in themes-for-claude. Usage, cost and limits
are on top, and the person's Google calendars below, with join links.

**Architecture:**
- Pure logic lives in `hooks/today-core.ts`, SVG cards in `hooks/today-card.ts`,
  and the pane, commands and data loading in `hooks/today.tsx`.
- The calendar is read through the Calendar MCP server's `list_calendars` and
  `list_events`, parsed as JSON, with no model.
- Each session writes its cost per day to `$.store`, so cost can be added up
  across sessions.

**Tech Stack:** a Claude Code function-hook mod (TSX), `claude plugin test`, tsc.

**Spec:** `docs/superpowers/specs/2026-11-16-today-pane-design.md`

## Global Constraints

- Pane id `today-pane`, title `Today`. Commands: `/today`, and `/tokens`,
  which opens the same pane in "This session" mode.
- The old `tokens-pane` drawing is removed. Its tests move to the Today pane.
- The calendar refreshes every 5 minutes and on ↻. Events are fetched for 7
  days from the start of the strip's week.
- Join links are accepted only on `meet.google.com`, `*.zoom.us`,
  `teams.microsoft.com`, `teams.live.com` and `*.webex.com`, over https.
  "Open in Calendar" uses `htmlLink`, and only on `www.google.com` or
  `calendar.google.com`.
- Cost is stored as `cost-days`: `{ [YYYY-MM-DD]: { [sessionId]: usd } }`,
  with 14 days kept.
- Calendar colours are taken in order from the theme's accent, special,
  warning, success and danger.
- Needs you checks only when the store has `needs-enabled: true`, or already
  has a `needs-result`.
- The usual engine rules apply:
  - `$` is passed only to named or imported functions.
  - Atoms are declared in the file that reads them.
  - There is one unmatched hook per event per module; `turn.complete` lives in
    usage.tsx.

## Review Focus

1. Calendar connector missing → the calendar part says "Connect Google
   Calendar to see your meetings", and usage still shows.
2. A declined or cancelled event, or an all-day event → declined and cancelled
   ones are hidden, and all-day ones show as a thin row, not a timed card.
3. An event with a join URL on a foreign host in its description → no Join
   link.
4. A day with no events → "Nothing on this day", plus the next event's day.
5. A new day → today's cost starts at $0, and the week still counts the last 7
   days.

---

### Task 1: `hooks/today-core.ts`

**Produces:**
- `Cal = { id, name }`
- `Ev = { id, calId, title, start, end, isAllDay, join?: { url, label }, open?, isDeclined }`
- `parseCalendars(text): Cal[]`
- `parseEvents(text, calId): Ev[]`. Skips `status: 'cancelled'`. Marks
  declined when `attendees[].self && responseStatus === 'declined'`.
- `joinLink(raw): { url, label } | undefined`
  - Looks at `hangoutLink`, then the video `conferenceData.entryPoints[].uri`,
    then the first URL in `location` and then `description` that is on an
    allowed host.
  - The label is `Meet`, `Zoom`, `Teams` or `Webex`.
- `dayOf(ms, offset)` reuses `localDay` from clock.ts.
- `eventsOn(evs, day, hidden: string[], offset): Ev[]`: sorted all-day first,
  then by start, without declined events or hidden calendars.
- `weekDays(today: string, startDay?: string): string[]` (7 days, Monday
  first).
- `busy(evs, day, hidden, offset): 0|1|2|3`
- `badge(ev, now): 'now' | 'in N min' | 'done' | ''`. Badges are `in N min`
  under 60 min, `now` while it runs, and `done` once it's over.
- `nextFree(evs, day, now, offset): string`. The first gap of 30 min or more
  between now (or 09:00) and 19:00, written as `HH:MM–HH:MM`, or `''`.
- `addCost(days, day, sessionId, usd)`: keeps 14 days.
- `spent(days, today): { today, week, sessions }`. `sessions` counts the
  sessions that spent anything today.

- [ ] **Step 1: Write the failing tests** in `tests/today.test.tsx` (`describe('today core')`).
  Use real-shaped JSON taken from the connector's actual output:
  - a timed event with `+05:00` offsets
  - an all-day event (`start.date`)
  - a cancelled event
  - a declined event
  - a Zoom URL in `location`
  - an `evil.example` URL in `description`

  Then assert each function's behaviour as above.
- [ ] **Step 2:** Run `claude plugin test .`. Expected: FAIL (the module is missing).
- [ ] **Step 3:** Implement it.
- [ ] **Step 4:** Expected: PASS. All existing tests still pass.
- [ ] **Step 5:** Commit `feat: today core`.

### Task 2: `hooks/today-card.ts`

**Produces** SVG strings like the mockup (`preview/today-mock.html`), in the
theme palette (`PomoPalette` plus `alert` and `accent`):
- `usageCard({ today, week, sessions, contextPct?, limits: {name, pct, resets}[] }, palette)`.
  It shows a ring for the highest limit, `SPENT TODAY`, the amounts and the
  limit bars. The card's height grows with the number of limits.
- `weekStrip(days: {label, num, dots, colors: string[]}[], selected: number, palette)`
- `eventCard(ev, badge, color, calName, palette)`. A card with a badge gets a
  title shortened to 18 characters, otherwise 24.

- [ ] **Step 1: Failing test:**
  - The usage card contains `$4.20`, `SPENT TODAY` and `48%`.
  - The strip contains `17` and the accent colour on the selected day.
  - The event card escapes `<`, shows `in 20 min` and uses the calendar
    colour.
- [ ] **Steps 2–5:** red, implement, green, commit `feat: today cards`.

### Task 3: `hooks/today.tsx` (pane, commands, cost)

**Behaviour:**
- **Atoms:** `todayMode` ('all'|'session'), `todayDay` (YYYY-MM-DD or ''),
  `todayHidden` (string[], stored), `todayCals`, `todayEvents`,
  `todayCalError`, `todayTick`, `themeId`, `totals`.
- **`loadCalendar($)`:**
  1. Find the calendar server with `findSources` (kind `calendar`).
  2. Call `list_calendars`, then `list_events` for each calendar not hidden,
     with `startTime` at local midnight of the strip's first day (no Z),
     `endTime` 7 days later, `pageSize` 100 and `orderBy` startTime.
  3. Use a 30 s timeout. A failure sets `todayCalError`.
- **`startToday($, options)`:** registers `today`, loads the calendar, sets
  `$.clock.every(300_000)`, and opens the pane if `options.openToday !== false`.
- **`recordCost($)`:** called from usage.tsx's `turn.complete`. It reads
  `$.session.usage().cost.usd` and writes `addCost` under `cost-days`.
- **Render:**
  - **Desktop:**
    - `usageCard`.
    - The buttons `today-refresh` ↻, `today-mode-session` and
      `today-mode-all`.
    - In session mode, Text rows with the session totals, as the old tokens
      pane had: Input, Output, Cache read, Cache write, Total, Cost and Turns
      (`2 + 1 subagent`), the context `84.0k of 200k tokens`, and the last
      turn's model.
    - `weekStrip`, then a row of 7 day buttons (`today-day-<n>`) and
      `today-prev`, `today-today`, `today-next`.
    - Calendar toggles `today-cal-<i>`.
    - Event cards, each followed by `Link` Join (`↗ Join Meet`) and `Link`
      `↗ Open in Calendar`.
    - All-day events as a Text row.
    - A footer Text with `+N tomorrow · next free …`.
  - **Terminal:** the same, as text.
- **`/tokens`** sets mode `session` and opens the pane. **`/today`** opens it.
- **Remove** the old `tokens-pane` render from usage.tsx, keeping the totals
  atom and the `turn.complete` hook. Move `tests/usage.test.tsx` to mount
  `today-pane` after `/tokens`.

- [ ] **Step 1: Failing tests:**
  - `/today` with stand-ins for `tool.list` (a calendar server) and `mcp.call`
    (calendars and events JSON):
    - The desktop pane shows 2 event cards and a Join Link with an `https://zoom.us/…` href.
    - Pressing `today-cal-1` hides that calendar's event.
    - Pressing `today-next` moves to tomorrow.
  - With no calendar server, the pane says "Connect Google Calendar".
  - Two sessions' costs add up: write `cost-days` for one, record the other.
    Spent today equals the sum.
  - The usage tests now go through `/tokens`.
- [ ] **Steps 2–5:** red, implement, green, validate and tsc, commit
  `feat: Today pane`.

### Task 4: Needs you opt-in, settings, docs

- `needsTick` checks only when `needs-enabled` is true or `needs-result`
  exists. `/needs` (any form) sets `needs-enabled: true`. Test: with an empty
  store, a tick makes no `mcp.call`. After `/needs`, it does.
- In plugin.json:
  - add userConfig `openToday` (boolean, default true);
  - set `openNeeds` to default false;
  - bump the version to 1.5.0;
  - add keywords `calendar` and `usage`.
- README: a "Today" section, plus how to share it with a friend.
- Write `docs/share-with-a-friend.md` as the message to send a friend.
- [ ] Red, then green, then commit `feat: Needs you opt-in, Today settings and docs (1.5.0)`.
