# Needs you: one sidebar pane for what needs your attention

## Why

Work is spread across Gmail, Slack, Calendar, Upwork and several Claude
sessions. The person wants one glance in the sidebar that says what needs them
now, so nothing important is missed, in the same polished widget style as the
Pomodoro pane.

## Goals

- A **Needs you** pane in the themes-for-claude mod, styled like the Pomodoro
  widget and following the active theme.
- It pulls from every connected source, keeps only what needs the person and
  ranks it.
- It stays a glance: at most 7 items, each one easy to clear.

## Non-goals

- Replying or sending from the pane. **Open** takes the person to the app.
- Phone push, cloud sessions, or sources that aren't connected.

## Anti-goals (failure even if it works)

- A noisy second inbox: newsletters, promos and bot notifications showing up.
- Token cost that grows with the number of open sessions.

## Approach (chosen: 1 of 3)

1. **Auto-check inside the mod (chosen).** While any session is open, check
   every 15 minutes, plus a ↻ button. A small Claude model ranks the results.
   One shared result serves all sessions.
2. A scheduled Claude task writing a list for the pane. Smarter per item, but
   far more tokens and slower. Not chosen.
3. Check on demand only. Cheapest, but it can't warn you mid-work. Not chosen.

## Importance rules (default)

- 🔴 **Now:** a real person is waiting on you (a direct email, a DM or
  @mention, an Upwork client message), something due today, or a meeting
  within 30 minutes.
- 🟠 **Today:** questions, review requests, invites waiting for an answer, and
  Claude sessions waiting for approval.
- **Hidden:** newsletters, promos, automated notifications, and threads you
  already answered. The pane shows a count of hidden items.

## Design

- **Sources**, each skipped when not connected:
  - Google Calendar: events in the next 2 hours and invites without an answer.
  - Gmail: unread inbox mail from the last day, without promotions or social.
  - Slack: DMs and @mentions from the last day.
  - Upwork: unread messages.
  - Claude sessions: each session's mod writes its own state (`waiting for
    you`, `working`, `idle`, plus its title) to the shared store, and the pane
    reads all of them.
- **Ranking:** one call to a small, cheap model with the rules above. It
  returns `{ id, source, title, why, level, link }` for each item. The call is
  made only when something changed since the last check.
- **Shared across sessions:** the result and a 15-minute claim live in the
  mod's store, so only one session checks per round. Done and Snooze 1h are
  also kept there, so they apply in every session.
- **UI** (see `preview/needs-you-mock.png`):
  - A summary card the size of the Pomodoro card. It has a ring split
    red/amber, the total count, "2 now · 3 today", and "checked 3 min ago".
  - A row of controls: **↻ Check now**, **All**, **🔴 Now**, **⚙**. The ⚙ holds
    VIP names and the check interval.
  - Item cards: an app tile, an urgency dot, the title, "App · why it
    matters", and the age.
  - The selected item shows **↗ Open**, **✓ Done** and **⏰ 1h**.
  - The terminal shows the same list as text.
- **Alerts:** a new 🔴 item sends one desktop notification.
- `/needs` opens the pane and `/needs check` checks now. A setting decides
  whether to open the pane at start.

## Left to the builder

- How an item gets selected: a tap on an interactive card, or a small › button.
- How **Open** reaches the app's link.
- The exact search query for each source's MCP tool.
- How a session detects "waiting for you" (a permission prompt, or a turn that
  ends with a question).
