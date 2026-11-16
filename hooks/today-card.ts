import { formatTime } from './clock'
import { CLASSIC, mix } from './pomo-theme'
import type { PomoMode, PomoPalette } from './pomo-theme'
import { escapeXml, shorten } from './text'
import type { Ev } from './today-core'

// The Today pane's cards, in the Pomodoro widget's shape and type: usage and
// limits, the week strip and one card per event. Pure SVG + CSS, light and
// dark, in the theme's colors.

const W = 312
const SANS = "-apple-system,'SF Pro Text','Helvetica Neue',sans-serif"
const ROUND = "'SF Pro Rounded','SF Pro Display',-apple-system,'Helvetica Neue',sans-serif"

const vars = (m: PomoMode) => `--card:${m.card};--edge:${m.edge};--track:${m.track};--ink:${m.ink};--soft:${m.soft}`

function head(palette: PomoPalette, extra: string): string {
  return `<style>
svg{${vars(palette.light)}}
@media (prefers-color-scheme: dark){svg{${vars(palette.dark)}}}
.card{fill:var(--card);stroke:var(--edge);stroke-width:1.5}
.ink{fill:var(--ink)}.soft{fill:var(--soft)}
text{font-family:${SANS}}
${extra}
</style>`
}

const money = (usd: number) => `$${usd.toFixed(2)}`

export type Limit = { name: string; pct: number; resets: string }

function limitColor(pct: number, palette: PomoPalette): string {
  return pct >= 80 ? palette.alert.now : pct >= 60 ? palette.alert.today : palette.accent
}

/** A short name for the ring: `5 HOUR`, `WEEKLY`, `OPUS`. */
function ringName(name: string): string {
  const part = name.includes('·') ? (name.split('·').pop() ?? name) : name.replace(/ limit$/i, '')

  return part.trim().replace(/-/g, ' ').toUpperCase()
}

export function usageCard(
  u: { today: number; week: number; sessions: number; contextPct?: number; limits: Limit[] },
  palette: PomoPalette = CLASSIC,
): string {
  const top = [...u.limits].sort((a, b) => b.pct - a.pct)[0]
  const H = Math.max(140, 160 + u.limits.length * 30)
  const cx = 70
  const r = 46
  const circ = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, top?.pct ?? u.contextPct ?? 0))
  const ringLabel = top === undefined ? 'CONTEXT' : ringName(top.name)
  const bars = u.limits
    .map((l, i) => {
      const y = 150 + i * 30
      const p = Math.max(0, Math.min(100, l.pct))

      return `<text x="20" y="${y}" class="lim ink">${escapeXml(l.name)}</text>
<text x="${W - 20}" y="${y}" text-anchor="end" class="lim2 soft">${Math.round(p)}%${l.resets === '' ? '' : ` · resets ${escapeXml(l.resets)}`}</text>
<rect x="20" y="${y + 6}" width="${W - 40}" height="6" rx="3" fill="var(--track)"/>
<rect x="20" y="${y + 6}" width="${(((W - 40) * p) / 100).toFixed(1)}" height="6" rx="3" fill="${limitColor(p, palette)}"/>`
    })
    .join('\n')
  const lines = [`7 days ${money(u.week)} · ${u.sessions} session${u.sessions === 1 ? "" : "s"}`, u.contextPct === undefined ? '' : `context ${Math.round(u.contextPct)}% full`]

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
${head(palette, `.big{font:600 32px ${ROUND}}.pct{font:600 26px ${ROUND}}.label{font-size:11px;font-weight:600;letter-spacing:1.1px}.small{font-size:9.5px;letter-spacing:.8px}.line{font-size:12px}.lim{font-size:12px}.lim2{font-size:11.5px}`)}
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="36" class="card"/>
<circle cx="${cx}" cy="72" r="${r}" fill="none" stroke="var(--track)" stroke-width="11"/>
${pct > 0 ? `<circle cx="${cx}" cy="72" r="${r}" fill="none" stroke="${limitColor(pct, palette)}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${((pct / 100) * circ).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 ${cx} 72)"/>` : ''}
<text x="${cx}" y="80" text-anchor="middle" class="pct ink">${Math.round(pct)}%</text>
<text x="${cx}" y="98" text-anchor="middle" class="small soft">${escapeXml(shorten(ringLabel, 10))}</text>
<text x="136" y="40" class="label soft">SPENT TODAY</text>
<text x="136" y="74" class="big ink">${money(u.today)}</text>
<text x="136" y="96" class="line soft">${escapeXml(lines[0] ?? '')}</text>
<text x="136" y="114" class="line soft">${escapeXml(lines[1] ?? '')}</text>
${bars}
</svg>`
}

export function weekStrip(days: { label: string; num: number; dots: number; colors: string[] }[], selected: number, palette: PomoPalette = CLASSIC): string {
  const dw = (W - 24) / Math.max(1, days.length)
  const cells = days
    .map((d, i) => {
      const x = 12 + i * dw
      const on = i === selected
      const n = Math.min(3, d.dots)
      const dots = Array.from({ length: n }, (_, k) => `<circle cx="${(x + dw / 2 - (n - 1) * 4 + k * 8).toFixed(1)}" cy="66" r="2.5" fill="${on ? '#ffffff' : (d.colors[k] ?? palette.accent)}"/>`).join('')

      return `${on ? `<rect x="${(x + 3).toFixed(1)}" y="10" width="${(dw - 6).toFixed(1)}" height="66" rx="15" fill="${palette.accent}"/>` : ''}
<text x="${(x + dw / 2).toFixed(1)}" y="32" text-anchor="middle" class="d" fill="${on ? '#ffffff' : 'var(--soft)'}">${escapeXml(d.label)}</text>
<text x="${(x + dw / 2).toFixed(1)}" y="54" text-anchor="middle" class="n" fill="${on ? '#ffffff' : 'var(--ink)'}">${d.num}</text>${dots}`
    })
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 86" width="${W}" height="86">
${head(palette, `.d{font-size:11px}.n{font:600 18px ${ROUND}}`)}
<rect x="1" y="1" width="${W - 2}" height="84" rx="24" class="card"/>
${cells}
</svg>`
}

export function eventCard(ev: Ev, badge: string, color: string, calName: string, palette: PomoPalette = CLASSIC, offset?: number, width = W): string {
  const w = width
  // Characters that fit: the title has the width beside the time; the line under it shares it with the pill.
  const chars = Math.floor((w - 98) / 7.6)
  const isSoon = badge.startsWith('in ') || badge === 'now'
  const isDone = badge === 'done'
  const edge = isSoon ? `stroke:${palette.accent};stroke-width:2` : ''
  const fade = isDone ? ' opacity="0.5"' : ''
  const where = `${calName}${ev.join === undefined ? '' : ` · ${ev.join.label}`}`
  const pill =
    isSoon
      ? `<rect x="${w - 84}" y="34" width="70" height="20" rx="10" fill="${palette.accent}"/><text x="${w - 49}" y="48" text-anchor="middle" class="pill">${escapeXml(badge)}</text>`
      : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 66" width="${w}" height="66">
${head(palette, `.t{font:600 14px ${ROUND}}.e{font-size:11.5px}.title{font-size:14px;font-weight:600}.sub{font-size:12px}.pill{font-size:11px;font-weight:600;fill:#ffffff}`)}
<rect x="1" y="1" width="${w - 2}" height="64" rx="18" class="card" style="${edge}"${fade}/>
<g${fade}>
<text x="18" y="29" class="t ink">${formatTime(ev.start, offset)}</text>
<text x="18" y="47" class="e soft">${formatTime(ev.end, offset)}</text>
<rect x="68" y="14" width="4" height="38" rx="2" fill="${color}"/>
<text x="84" y="29" class="title ink">${escapeXml(shorten(ev.title, chars))}</text>
<text x="84" y="47" class="sub soft">${escapeXml(shorten(where, isSoon ? chars - 9 : chars + 4))}</text>
</g>
${pill}
</svg>`
}

/** A theme's colors for calendars, in order. */
export function calColors(palette: PomoPalette, special: string, success: string): string[] {
  return [palette.accent, special, palette.alert.today, success, palette.alert.now, mix(palette.accent, special, 0.5)]
}
