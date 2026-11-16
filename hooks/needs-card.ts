import type { NeedItem } from '../types'
import { ago, until } from './needs-core'
import { CLASSIC, mix } from './pomo-theme'
import type { PomoMode, PomoPalette } from './pomo-theme'
import { escapeXml, shorten } from './text'

// The Needs you pane's cards, in the Pomodoro widget's shape and type: a
// summary card with a ring split by urgency, and one card per item. Pure SVG
// + CSS, light and dark, in the theme's colors.

const W = 312
const SANS = "-apple-system,'SF Pro Text','Helvetica Neue',sans-serif"
const ROUND = "'SF Pro Rounded','SF Pro Display',-apple-system,'Helvetica Neue',sans-serif"

const vars = (m: PomoMode) =>
  `--card:${m.card};--edge:${m.edge};--track:${m.track};--ink:${m.ink};--soft:${m.soft};--tile:${mix(m.card, m.ink, 0.07)}`

function style(palette: PomoPalette, extra = ''): string {
  return `<style>
svg{${vars(palette.light)}}
@media (prefers-color-scheme: dark){svg{${vars(palette.dark)}}}
.card{fill:var(--card);stroke:var(--edge);stroke-width:1.5}
.ink{fill:var(--ink)}.soft{fill:var(--soft)}
text{font-family:${SANS}}
${extra}
</style>`
}

export function summaryCard(c: { now: number; today: number; note: string }, palette: PomoPalette = CLASSIC): string {
  const total = c.now + c.today
  const cx = 78
  const cy = 78
  const r = 52
  const circ = 2 * Math.PI * r
  const nowLen = total === 0 ? 0 : (c.now / total) * circ
  const ring = (color: string, len: number) =>
    len <= 0
      ? ''
      : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${Math.max(0.1, len - (len >= circ ? 8 : 0)).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`
  const label = total === 0 ? 'ALL CLEAR' : 'NEEDS YOU'

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 156" width="${W}" height="156">
${style(palette, `.count{font:600 46px ${ROUND};font-variant-numeric:tabular-nums}.label{font-size:12px;font-weight:600;letter-spacing:1.2px}.big{font-size:15px;font-weight:600}.note{font-size:11.5px}`)}
<rect x="1" y="1" width="${W - 2}" height="154" rx="40" class="card"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--track)" stroke-width="12"/>
${ring(palette.alert.today, c.today > 0 ? circ : 0)}
${ring(palette.alert.now, nowLen)}
<text x="${cx}" y="94" text-anchor="middle" class="count ink">${total}</text>
<text x="150" y="52" class="label soft">${label}</text>
<circle cx="156" cy="76" r="5" fill="${palette.alert.now}"/><text x="168" y="81" class="big ink">${c.now} now</text>
<circle cx="156" cy="100" r="5" fill="${palette.alert.today}"/><text x="168" y="105" class="big ink">${c.today} today</text>
<text x="150" y="128" class="note soft">${escapeXml(shorten(c.note, 26))}</text>
</svg>`
}

const ICON: Record<string, string> = { gmail: '✉️', slack: '💬', calendar: '📅', upwork: '💼', claude: '✦' }

export function itemCard(i: NeedItem, now: number, palette: PomoPalette = CLASSIC, isSelected = false): string {
  const icon = ICON[i.source.toLowerCase()] ?? '•'
  const dot = i.level === 'now' ? palette.alert.now : palette.alert.today
  const age = i.at === undefined ? '' : i.at > now ? until(i.at - now) : ago(now - i.at).replace(' ago', '').replace('just now', 'now')
  const edge = isSelected ? `stroke:${palette.accent};stroke-width:2` : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 70" width="${W}" height="70">
${style(palette, `.title{font-size:14px;font-weight:600}.why{font-size:12px}.age{font-size:11.5px}.icon{font-size:21px}`)}
<rect x="1" y="1" width="${W - 2}" height="68" rx="20" class="card" style="${edge}"/>
<rect x="12" y="13" width="44" height="44" rx="13" fill="var(--tile)"/>
<text x="34" y="43" text-anchor="middle" class="icon" fill="${palette.accent}">${icon}</text>
<circle cx="52" cy="17" r="5.5" fill="${dot}" stroke="var(--card)" stroke-width="2"/>
<text x="68" y="30" class="title ink">${escapeXml(shorten(i.title, 27))}</text>
<text x="68" y="50" class="why soft">${escapeXml(shorten(`${i.source} · ${i.why}`, 40))}</text>
<text x="${W - 14}" y="30" text-anchor="end" class="age soft">${age}</text>
</svg>`
}
