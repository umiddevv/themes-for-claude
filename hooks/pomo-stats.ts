import { CLASSIC, mix } from './pomo-theme'
import type { PomoMode, PomoPalette } from './pomo-theme'
import type { DayBar } from './stats-core'
import { formatMinutes } from './stats-core'

// The stats card under the timer: today's focus time and sessions, and seven
// bars for the week, in the theme's colors.

const W = 320
const H = 104

const vars = (m: PomoMode) => `--card:${m.card};--edge:${m.edge};--ink:${m.ink};--soft:${m.soft};--bar:${mix(m.card, m.ink, 0.18)}`

export function statsCard(bars: DayBar[], todaySessions: number, palette: PomoPalette = CLASSIC): string {
  const today = bars.find(b => b.isToday)?.minutes ?? 0
  const week = bars.reduce((sum, b) => sum + b.minutes, 0)
  const max = Math.max(25, ...bars.map(b => b.minutes))
  const hot = palette.phase.focus[0]
  const x0 = 176
  const step = 19
  const base = 74
  const tall = 50
  const rects = bars
    .map((b, i) => {
      const h = b.minutes === 0 ? 3 : Math.max(5, (b.minutes / max) * tall)
      const x = x0 + i * step

      return `<rect x="${x}" y="${(base - h).toFixed(1)}" width="11" height="${h.toFixed(1)}" rx="3" class="${b.isToday ? 'bar on' : 'bar'}"/>` +
        `<text x="${x + 5.5}" y="${base + 16}" text-anchor="middle" class="day${b.isToday ? ' on' : ''}">${b.letter}</text>`
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<style>
svg{${vars(palette.light)}}
@media (prefers-color-scheme: dark){svg{${vars(palette.dark)}}}
.card{fill:var(--card);stroke:var(--edge);stroke-width:1.5}
.k{font:600 10px -apple-system,'SF Pro Text','Helvetica Neue',sans-serif;letter-spacing:1.4px;fill:var(--soft)}
.big{font:600 28px 'SF Pro Rounded','SF Pro Display',-apple-system,'Helvetica Neue',sans-serif;fill:var(--ink);font-variant-numeric:tabular-nums}
.sub{font:500 12px -apple-system,'SF Pro Text','Helvetica Neue',sans-serif;fill:var(--soft)}
.bar{fill:var(--bar)}.bar.on{fill:${hot}}
.day{font:500 10px -apple-system,'SF Pro Text','Helvetica Neue',sans-serif;fill:var(--soft)}.day.on{fill:var(--ink);font-weight:700}
</style>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="26" class="card"/>
<text x="24" y="30" class="k">TODAY</text>
<text x="24" y="62" class="big">${formatMinutes(today)}</text>
<text x="24" y="84" class="sub">${todaySessions} ${todaySessions === 1 ? 'session' : 'sessions'} · week ${formatMinutes(week)}</text>
${rects}
</svg>`
}
