import type { Phase, Pomo } from '../types'
import { SET, durationMs, mmss, remaining } from './pomo-core'
import { escapeXml, shorten } from './tasks-core'

// The widget-style Pomodoro card: a rounded square, a gradient ring of the
// time left, an emoji, the time and a label. Pure SVG + CSS, light and dark.

const S = 320
const C = S / 2
const R = 116

const ICON: Record<Phase, string> = { focus: '🍅', short: '☕', long: '🌙' }
const LABEL: Record<Phase, string> = { focus: 'FOCUS', short: 'RELAX', long: 'LONG REST' }
const GRADIENT: Record<Phase, [string, string]> = {
  focus: ['#ff8a1f', '#d9302a'],
  short: ['#47a8ff', '#1f5fd1'],
  long: ['#b48cff', '#6a45d8'],
}

export function pomoWidget(p: Pomo, now: number, task?: string): string {
  const taskLine =
    task === undefined || p.phase !== 'focus'
      ? ''
      : `<text x="${C}" y="240" text-anchor="middle" class="task">${escapeXml(shorten(task, 22))}</text>`
  const dotsY = taskLine === '' ? 252 : 262
  const total = durationMs(p)
  const left = remaining(p, now)
  const rest = Math.max(0, Math.min(1, left / Math.max(1, total)))
  const circ = 2 * Math.PI * R
  const [hot, deep] = GRADIENT[p.phase]
  // The ring is the time left: it runs clockwise from where the time has got to, round to 12.
  const headA = (1 - rest) * Math.PI * 2
  const headX = C + Math.sin(headA) * R
  const headY = C - Math.cos(headA) * R
  const state = p.isRunning ? LABEL[p.phase] : left < total ? 'PAUSED' : LABEL[p.phase]
  const dots = Array.from({ length: SET }, (_, i) =>
    `<circle cx="${C - 21 + i * 14}" cy="${dotsY}" r="3.5" class="${i < p.cycle ? 'dot on' : 'dot'}"/>`,
  ).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
<style>
svg{--card:#ffffff;--edge:#e6e6ea;--track:#ececf0;--ink:#111114;--soft:#8a8a93;--dot:#c9c9d0}
@media (prefers-color-scheme: dark){svg{--card:#050506;--edge:#1c1c20;--track:#242428;--ink:#ffffff;--soft:#9a9aa3;--dot:#3a3a40}}
.card{fill:var(--card);stroke:var(--edge);stroke-width:1.5}
.track{fill:none;stroke:var(--track);stroke-width:16}
.arc{fill:none;stroke:url(#g);stroke-width:16;stroke-linecap:round}
.head{fill:${hot}}
.time{font:600 66px 'SF Pro Rounded','SF Pro Display',-apple-system,'Helvetica Neue',sans-serif;fill:var(--ink);font-variant-numeric:tabular-nums;letter-spacing:-1px}
.label{font:500 15px -apple-system,'SF Pro Text','Helvetica Neue',sans-serif;fill:var(--soft);letter-spacing:1.2px}
.icon{font-size:38px}
.task{font:500 14px -apple-system,'SF Pro Text','Helvetica Neue',sans-serif;fill:var(--ink);opacity:.82}
.dot{fill:var(--dot)}.dot.on{fill:${hot}}
</style>
<defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${hot}"/><stop offset="1" stop-color="${deep}"/></linearGradient></defs>
<rect x="1" y="1" width="${S - 2}" height="${S - 2}" rx="64" class="card"/>
<circle cx="${C}" cy="${C}" r="${R}" class="track"/>
${rest > 0.002 ? `<circle cx="${C}" cy="${C}" r="${R}" class="arc" stroke-dasharray="${(rest * circ).toFixed(1)} ${circ.toFixed(1)}" stroke-dashoffset="${(-(1 - rest) * circ).toFixed(1)}" transform="rotate(-90 ${C} ${C})"/>` : ''}
${rest > 0.002 && rest < 0.998 ? `<circle cx="${headX.toFixed(1)}" cy="${headY.toFixed(1)}" r="8" class="head"/>` : ''}
<text x="${C}" y="108" text-anchor="middle" class="icon">${ICON[p.phase]}</text>
<text x="${C}" y="186" text-anchor="middle" class="time">${mmss(left)}</text>
<text x="${C}" y="216" text-anchor="middle" class="label">${state}</text>
${taskLine}
${dots}
</svg>`
}
