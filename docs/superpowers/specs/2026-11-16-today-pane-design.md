# Today: usage and calendar in one pane

## Why

A better Claude desktop setup that's easy to share with a friend: the themes
(Aurora and the rest), plus one pane that shows at a glance what Claude is
costing and how close the plan limits are, and the day's meetings with
one-click join links. A friend installs the shared themes-for-claude mod with
one line.

## Goals

- **A Today pane** (`/today`) for the Claude desktop app, in the Pomodoro
  widget style, following the theme:
  - **Usage card:**
    - Spent today and this week, across every session on the Mac, and how many
      sessions.
    - The context window used.
    - Every plan limit (5-hour, weekly, weekly per model) as a bar, with its
      reset time.
    - A ring for the limit closest to full.
    - A toggle between **All sessions** and **This session** (the token
      breakdown).
  - **Calendar:** all of the person's Google calendars. Each gets a theme
    colour and a toggle to show or hide it.
    - A week strip with dots for how busy each day is. Tapping a day, ‹ › and
      Today move through the days.
    - The day's events as cards: time, a colour bar for the calendar, title and
      calendar name.
    - A **Join** link (Meet, Zoom, Teams, Webex) and **Open in Calendar**.
    - Badges such as "in 20 min"; past events are dimmed.
    - A footer line: "+N tomorrow · next free 12:00–15:30".
- `/tokens` keeps working and opens the same pane.
- A short message to send a friend: install, connect Google Calendar, then
  `/look aurora` and `/today`.

## Non-goals

- Creating or editing events, or sending invites (the pane only reads).
- Non-Google calendars. Outlook and iCloud have no connector here.
- Usage from other machines or from claude.ai chats. This pane sees Claude Code
  sessions on this Mac only.

## Anti-goals

- Any token cost. The calendar is read as JSON, with no AI model.
- A shared install that quietly spends someone's tokens. Needs you stays off
  for a new install until `/needs` is opened once.

## Approach

There's one sensible way: extend the mod people already install.
- Two separate panes would split the "one glance" this is for.
- A month grid doesn't fit a sidebar, so the calendar is a week strip plus a
  day agenda.

## Design

- **Usage data:**
  - `$.session.usage()` gives context, `rateLimits` and `cost`.
  - After each turn, a session writes its cost into the store under
    `cost-days` as `{ day: { sessionId: usd } }`, keeping 14 days. The pane
    adds those up for today and the last 7 days.
- **Calendar data:**
  - `list_calendars`, then `list_events` per shown calendar for the 7 days on
    the strip, refreshed every 5 minutes and on ↻.
  - Join links come from `hangoutLink`, `conferenceData.entryPoints` (video),
    then a URL in the location or description. Only Meet, Zoom, Teams and
    Webex hosts are accepted. **Open in Calendar** uses `htmlLink`.
  - Times come from each event's own offset. All-day events sit at the top as
    a thin row.
- **Settings:** "Open the Today pane at start" (default on).
- **Needs you:** it checks only once `/needs` has been opened on this Mac,
  stored as `needs-enabled`. A Mac that already has a result counts
  as opened.
- **Version 1.5.0.** It ships after the Needs you branch is merged.

## Left to the builder

- Colours per calendar, picked from accent, special, warning, success and
  danger in order.
- How the day buttons sit under the week strip: a row of 7 small buttons.
- How busy the dots say a day is (1 to 3 dots).
