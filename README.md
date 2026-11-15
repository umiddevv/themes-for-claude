# Themes for Claude

A mod for Claude Code that restyles the desktop and mobile apps and adds a few
desk tools beside the chat:

- **Themes you switch in one command.** Four come with it: Aurora night (with an
  animated aurora behind the chat), Paper, Forest moss and Sandstone desert.
  Each one follows your Mac's light and dark mode.
- **A Pomodoro timer** in a side pane: a widget card with a ring, start / pause,
  break and focus, three length presets, a chime and a countdown in the status line.
- **A task list** under the timer. Each finished focus session adds a 🍅 to the
  task you are on, and your tasks are kept between sessions.
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
| `/pomodoro task Write the report` | Adds a task |
| `/pomodoro 50 10 20` | Sets focus, short break and long break minutes |
| `/pomodoro style illustrated` | Switches the card to the illustrated style (`style widget` goes back) |
| `/tokens` | Opens the token usage pane |

In the Pomodoro pane: **▶ Start / ⏸ Pause** (`s`), **Break / Focus** (`n`),
**⚙** cycles 25/5/15, 50/10/20 and 15/3/10 minutes (`p`), **↺** resets (`r`).
Click a task to make it the current one, ☐ to tick it off, × to remove it.

### Settings

The plugin's settings have a **Theme** picker and **Open the Pomodoro pane at
start**. `/look` and the picker work together: the last one you changed wins.

Themes draw in the desktop and mobile apps. The terminal has no themes, but the
Pomodoro, tasks and tokens panes work there as text.

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
- **Background** (optional): `{ color }`, `{ gradient: [...], angle }` or a
  moving `{ scene }`. A color can be hex or a name like `surface-0` that follows
  light and dark. See [`themes/scenes/aurora.ts`](themes/scenes/aurora.ts) for a
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
hooks/             the mod itself (theme engine, Pomodoro, tasks, tokens)
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
