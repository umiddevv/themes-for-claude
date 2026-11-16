# Themes for Claude

A mod for Claude Code that restyles the desktop and mobile apps and adds a few
desk tools beside the chat:

- **A Today pane**: what Claude cost today and this week across all your
  sessions, your context window and plan limits with reset times, and your
  Google calendars as a week strip and a day of meeting cards with **Join**
  links (Meet, Zoom, Teams, Webex).
- **Themes you switch in one command.** Five come with it: Aurora night (with an
  animated aurora behind the chat), Glyph sea (a whale, a manta, a jellyfish and
  fish made of code characters swimming behind the chat), Paper, Forest moss and
  Sandstone desert. Each one follows your Mac's light and dark mode.
- **A Pomodoro timer** in a side pane, in the colors of your theme: a widget card
  with a ring, one big Start / Pause, skip, reset, length presets, a chime you
  can mute and a countdown in the status line.
- **Tags** for your focus sessions: tap `#work`, `#study`, `#code`, `#read` or
  your own. The tag shows on the timer card and each finished session counts
  toward it.
- **Today's stats**: focus time and sessions today, time per tag, and a bar for
  each day of the week.
- **Needs you**: one pane that looks through your connected apps (Gmail, Slack,
  Google Calendar, Upwork) and your other Claude sessions, and shows only what
  needs you, ranked 🔴 now or 🟠 today, in your theme's colors.
- **A token usage pane**: context window, tokens in and out, cost and rate limits.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install themes-for-claude --marketplace umiddevv/themes-for-claude
```

Answer `y` to add the marketplace, then pick a scope (user is the usual one).

From a shell:

```bash
claude plugin install themes-for-claude --marketplace umiddevv/themes-for-claude
```

In the Claude desktop app, where `/plugin` doesn't run: click **+** next to the
prompt box, then **Plugins**, **Add marketplace** with `umiddevv/themes-for-claude`,
then **Add plugin**. New sessions start with it.

## Use it

| Type | What it does |
| --- | --- |
| `/look` | Lists the themes; the one in use is marked ● |
| `/look forest` | Switches to a theme (by id or name) and remembers it |
| `/look next` | Goes to the next theme in the list |
| `/pomodoro` | Opens the Pomodoro pane |
| `/pomodoro tag design` | Tags your sessions `#design` (creates the tag if it's new) |
| `/pomodoro tag remove design` | Deletes a tag |
| `/pomodoro 50 10 20` | Sets focus, short break and long break minutes |
| `/pomodoro sound off` | Mutes the chime (`sound on` brings it back) |
| `/pomodoro style illustrated` | Switches the card to the illustrated style (`style widget` goes back) |
| `/today` | Opens the Today pane: usage, limits and your calendar |
| `/needs` | Opens the Needs you pane (and turns it on) |
| `/needs check` | Looks through your apps now |
| `/tokens` | Opens the token usage pane |

In the Pomodoro pane: **▶ Start / ⏸ Pause** (`s`), **⏭** skips to the next
phase (`n`), **↺** resets (`r`), **25/5** cycles 25/5, 50/10 and 15/3 minutes
(`p`), **🔔** mutes the chime (`m`). Under the buttons, tap a tag to tag your
sessions with it (tap it again to clear it); **✎** lets you add tags (up to 8)
and remove them. Your tags, stats and sound choice are kept between sessions.

### Today

The top card shows what Claude cost today and this week, added up across every
Claude Code session on this Mac, how full the context window is, and each plan
limit (5-hour, weekly, weekly per model) with when it resets. `/tokens` opens
the token breakdown for the session you're in.

Below it, your Google calendars: a week strip with a dot per meeting, then the
day's meetings as cards. The next one gets an "in 20 min" badge and ones that
are over fade out. **Join** beside a card opens its meeting (Meet, Zoom, Teams
or Webex); **↗** opens an event without a meeting in Google Calendar. **‹ ›**
move through the days. It refreshes every 5 minutes (**↻** refreshes now).

The first time, it asks which calendars to show: your own ones are picked,
holidays and shared family calendars aren't. Pick your work ones and press
**Done**; **⚙** brings the choice back.

It needs the **Google Calendar** connector: click **+** next to the prompt,
then **Connectors**. The calendar is read as data, with no AI model, so this
pane costs no tokens. It reads only; it never changes your calendar.

### Needs you

Needs you is off on a new install: open `/needs` once to turn it on.

While Claude is open, the pane checks your apps every 15 minutes (**↻ Check now**
checks at once). A small, cheap Claude model sorts what it finds:

- 🔴 **Now**: a real person waiting on you (a direct email, a DM or @mention, a
  client message), something due today, or a meeting within 30 minutes.
- 🟠 **Today**: questions, review requests, invites waiting for an answer, and
  Claude sessions waiting for your approval or your answer.
- **Hidden**: newsletters, promos, automated notifications and threads you
  already answered. The pane says how many it hid.

It shows at most 7 items. **↗ Open** opens one in its app, **✓ Done** clears
it and **⏰ 1h** snoozes it for an hour. **⚙** takes the names of people whose
messages always come first. One session checks per round and every session
shares the result, so more open sessions don't cost more. A new 🔴 item sends
one desktop notification.

It reads only the apps connected to Claude: add Gmail and Slack under
**Connectors** in the Claude app. An app that isn't connected is skipped, and
one that can't be read is named under the list. The ranking model reads what
those apps return, the same as when you ask Claude about your mail.

### Settings

The plugin's settings have a **Theme** picker, **Open the Today pane at
start**, **Open the Pomodoro pane at start**, **Open the Needs you pane at
start** and the **Needs you check interval** in minutes. `/look` and the picker work together: the last one you changed wins.

Themes draw in the desktop and mobile apps. The terminal has no themes, but the
Pomodoro and tokens panes work there as text.

## Make your own theme

Every theme is one small file in [`themes/`](themes). To add one:

1. Copy a theme file, for example `themes/forest.ts` to `themes/ocean.ts`.
2. Change its `id` (what you type after `/look`), `name` and colors.
3. Add it to the list in [`themes/index.ts`](themes/index.ts):

   ```ts
   import ocean from './ocean'

   export const THEMES: Theme[] = [aurora, paper, forest, sandstone, ocean]
   ```

4. Optional: add `"ocean"` to the `options` of `theme` in
   [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json) so the settings
   picker lists it too. `/look ocean` works without this.

A theme file looks like this (all colors are six-digit hex):

```ts
const ocean: Theme = {
  id: 'ocean',
  name: 'Ocean',
  colors: { accent: '#1f7a9c', danger: '#c0392b', success: '#2e8b57', warning: '#c98a1a', special: '#6a5acd' },
  light: { page: '#e3eef3', card: '#eaf3f7', panel: '#f4f9fb', text: '#0e1f27', textSoft: '#2f4650', textMuted: '#4a6170' },
  dark: { page: '#0b1418', card: '#101c22', panel: '#15242b', menu: '#1a2b33', text: '#e4f0f4', textSoft: '#b6cad2', textMuted: '#8ea5af' },
  background: { gradient: ['surface-0', 'surface-2'] },
}
```

Tips that keep a theme readable:

- **Surfaces**: `page` is the darkest, then `card`, `panel`, `menu`, a few
  percent lighter each. Tint them all with the theme's hue.
- **Text**: keep `text` strong against every surface, and `textMuted` readable
  on `page`. If a color can't be used, `/look` says what to change and keeps
  the old theme. If the contrast is too low for the desktop app to paint it, a
  message names the pair of colors to fix.
- **Meaning**: keep `danger` red, `success` green and `warning` amber, tuned to
  the theme.
- **Pomodoro**: the timer follows the theme. Focus uses `accent`, the short break
  `success`, the long break `special`, and the card uses the theme's surfaces
  and text. To pick exact ring colors, add
  `pomodoro: { focus: '#e8392b', short: '#3b82f6', long: '#8b5cf6' }` (any of the three).
- **Background** (optional): `{ color }`, `{ gradient: [...], angle }` or a
  moving `{ scene }`. A color can be hex or a name like `surface-0` that follows
  light and dark. See [`themes/scenes/aurora.ts`](themes/scenes/aurora.ts) and [`themes/scenes/glyph-sea.ts`](themes/scenes/glyph-sea.ts) for a
  moving scene: plain SVG with CSS animation, no scripts.
- Leave out `light` or `dark` to make a dark-only or light-only theme.

If you installed from GitHub, edit your own copy (fork the repository, change
it, and install from your fork), or load your local folder while you work on it:

```bash
claude --plugin-dir /path/to/themes-for-claude
```

Edits reload when you save.

## Folder map

```
themes/            the themes: one file each, plus index.ts (the list)
themes/scenes/     moving SVG backgrounds
hooks/             the mod itself (theme engine, Today, Pomodoro, stats, Needs you, tokens)
tests/             tests: claude plugin test .
.claude-plugin/    plugin.json (name, version, settings) and marketplace.json
```

## Develop

```bash
claude plugin validate .
claude plugin test .
```

## License

MIT, see [LICENSE](LICENSE).
