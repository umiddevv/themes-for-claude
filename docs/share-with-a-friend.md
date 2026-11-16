# Share it with a friend

Send this to someone who uses the Claude desktop app.

---

Hey! I set up a mod for the Claude desktop app with nicer themes and a **Today**
pane in the sidebar: what Claude cost you today and this week, your plan
limits and when they reset, and your Google calendar with one-click Join links.
It takes 2 minutes:

1. In the Claude app, open a Code session. Click **+** next to the prompt box,
   then **Plugins** → **Add marketplace**, and enter:
   `umiddevv/themes-for-claude`
   Then **Add plugin** → **themes-for-claude**.
2. Click **+** again → **Connectors**, and connect **Google Calendar**. That's
   what fills the calendar part. The first time, the pane asks which calendars
   to show: pick your work ones and press Done (⚙ changes it later).
3. Start a new session. The Today pane opens by itself. Then try:
   - `/look aurora` for the Aurora night theme (`/look` lists all of them:
     Paper, Forest moss, Sandstone desert, Glyph sea)
   - `/today` to open the Today pane again
   - `/pomodoro` for a focus timer

The calendar part only reads your calendar and uses no AI, so it costs no
tokens. Updates: `/plugin update themes-for-claude@themes-for-claude` in a
terminal session, or remove and add the plugin again in the app.

---

Optional extras to mention: **Needs you** (`/needs`) looks through Gmail,
Slack, Calendar and Upwork every 15 minutes and ranks what needs you. It's off
until opened, because it uses a small AI model and so a few tokens each check.
