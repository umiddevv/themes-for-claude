import type { Phase, Pomo } from '../types'
import { SET, durationMs, mmss, remaining } from './pomo-core'
import { mix } from './pomo-theme'
import type { PomoMode, PomoPalette } from './pomo-theme'

// The illustrated Pomodoro card: ring dial, big countdown, a handwritten line
// and a small original illustration per phase. Pure SVG + CSS: no script, no
// fetched fonts (Mac system fonts with fallbacks), light and dark palettes.

const W = 340
const H = 500
const CX = 170
const CY = 190
const R = 112

type Palette = Record<
  | 'bg' | 'ink' | 'soft' | 'deco' | 'track' | 'tick' | 'accent' | 'script'
  | 'hill1' | 'hill2' | 'tree' | 'trunk' | 'sun' | 'leaf'
  | 'cushion' | 'cushion2' | 'cat' | 'catDark' | 'nose' | 'yarn' | 'star' | 'moon',
  string
>

const base = {
  light: { ink: '#1d1a22', soft: '#7b7280', tick: '#d9cfd3', trunk: '#8a5a44', leaf: '#4f9a5c', nose: '#e9839a', star: '#f5c94a', moon: '#ffe8a8' },
  dark: { ink: '#f4eff2', soft: '#a99fae', tick: '#4a4150', trunk: '#6d4636', leaf: '#5fb06c', nose: '#e9839a', star: '#f5d36b', moon: '#ffe8a8' },
}

const PALETTES: Record<Phase, { light: Palette; dark: Palette }> = {
  focus: {
    light: { ...base.light, bg: '#fff5f0', deco: '#f2c9bb', track: '#f6ddd4', accent: '#e8735a', script: '#c4553f', hill1: '#f0a98f', hill2: '#f7cdbc', tree: '#7cbf86', sun: '#ef6f55', cushion: '#f6b8c4', cushion2: '#fbd3db', cat: '#c97b4a', catDark: '#9b5634', yarn: '#f2c14e' },
    dark: { ...base.dark, bg: '#2a1f24', deco: '#5a3a3c', track: '#3d2c31', accent: '#ff8a6e', script: '#ffb39f', hill1: '#7a4a44', hill2: '#55363a', tree: '#3f7d55', sun: '#ff7a5f', cushion: '#8a4a5c', cushion2: '#a85d70', cat: '#c97b4a', catDark: '#8e4f30', yarn: '#e8b844' },
  },
  short: {
    light: { ...base.light, bg: '#effaf5', deco: '#bfe6d5', track: '#d4efe3', accent: '#34a37f', script: '#23825f', hill1: '#9fd8bf', hill2: '#c6eadb', tree: '#5fae7f', sun: '#f2b44e', cushion: '#f6b8c4', cushion2: '#fbd3db', cat: '#a7a9a1', catDark: '#7d7f78', yarn: '#3b3f6b' },
    dark: { ...base.dark, bg: '#18282a', deco: '#2f4d48', track: '#24403b', accent: '#4fd1a5', script: '#8fe6c5', hill1: '#2f5a4d', hill2: '#244539', tree: '#3d8a63', sun: '#f2b44e', cushion: '#8a4a5c', cushion2: '#a85d70', cat: '#b4b6ad', catDark: '#85877f', yarn: '#8d93d8' },
  },
  long: {
    light: { ...base.light, bg: '#f3f0ff', deco: '#d6cdfa', track: '#e3dcfb', accent: '#7b5fe0', script: '#5e45c2', hill1: '#b9a9f0', hill2: '#d8cff8', tree: '#7c6bc9', sun: '#f2b44e', cushion: '#f6b8c4', cushion2: '#fbd3db', cat: '#a7a9a1', catDark: '#7d7f78', yarn: '#e8735a' },
    dark: { ...base.dark, bg: '#1d1a33', deco: '#3a3366', track: '#2c2750', accent: '#a48bff', script: '#c8b8ff', hill1: '#3b3170', hill2: '#2b2556', tree: '#5a4aa8', sun: '#f2b44e', cushion: '#5a3f78', cushion2: '#6f4f92', cat: '#b4b6ad', catDark: '#85877f', yarn: '#ff8a6e' },
  },
}

const LINES: Record<Phase, string[]> = {
  focus: ['You can do it', 'One thing at a time', 'Deep work, calm mind', "You've got this", 'Small steps, big things'],
  short: ['Breathe, stretch, sip', 'Rest is part of the work', 'Little pause, big gain', 'Look away, blink slow'],
  long: ['You are doing great', 'Well earned, rest now', 'Four down. Shine on', 'Go take a real break'],
}

const LABEL: Record<Phase, string> = { focus: 'FOCUS', short: 'SHORT BREAK', long: 'LONG BREAK' }

function css(p: Palette): string {
  return Object.entries(p)
    .map(([k, v]) => `--${k}:${v}`)
    .join(';')
}

function ticks(): string {
  let out = ''
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2
    const long = i % 5 === 0
    const r1 = R - (long ? 22 : 18)
    const r2 = R - 13
    const x1 = CX + Math.sin(a) * r1
    const y1 = CY - Math.cos(a) * r1
    const x2 = CX + Math.sin(a) * r2
    const y2 = CY - Math.cos(a) * r2
    out += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="tick${long ? ' tl' : ''}"/>`
  }

  return out
}
const TICKS = ticks()

function cat(x: number, y: number, s: number): string {
  return `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M60 8 C 85 22, 60 44, 10 36" class="tail"/>
  <ellipse cx="0" cy="0" rx="62" ry="30" class="cat"/>
  <path d="M10 -26 q7 13 0 26 M28 -24 q7 12 0 22 M-8 -28 q6 12 0 24" class="stripe"/>
  <circle cx="-45" cy="-8" r="25" class="cat"/>
  <polygon points="-64,-22 -60,-48 -46,-30" class="cat"/>
  <polygon points="-40,-31 -26,-49 -24,-24" class="cat"/>
  <polygon points="-60,-27 -58,-41 -50,-31" class="inner"/>
  <polygon points="-36,-31 -28,-42 -28,-28" class="inner"/>
  <path d="M-58 -6 q5 4 10 0 M-42 -6 q5 4 10 0" class="eye"/>
  <circle cx="-45" cy="1" r="1.8" class="nose"/>
  <path d="M-70 0 h-14 M-70 4 l-13 4 M-20 0 h14 M-20 4 l13 4" class="whisker"/>
  <ellipse cx="-30" cy="22" rx="12" ry="6" class="cat"/>
</g>`
}

function star(x: number, y: number, s: number): string {
  return `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -6 L1.5 -1.5 L6 0 L1.5 1.5 L0 6 L-1.5 1.5 L-6 0 L-1.5 -1.5Z" class="star"/>`
}

function scene(phase: Phase): string {
  if (phase === 'focus') {
    return `<g>
  <circle cx="252" cy="402" r="26" class="sun"/>
  <path d="M252 377 q-8 -8 -16 -2 q8 2 10 6 q-6 -8 6 -12 q2 6 0 8 q8 -8 14 -2 q-6 0 -8 4 z" class="leafF"/>
  <path d="M0 438 C 60 398, 130 400, 190 428 S 300 398, 340 418 L340 500 L0 500Z" class="hill2"/>
  <rect x="57" y="408" width="5" height="20" class="trunk"/><circle cx="59.5" cy="404" r="15" class="tree"/>
  <rect x="93" y="414" width="4" height="16" class="trunk"/><circle cx="95" cy="410" r="11" class="tree"/>
  <polygon points="292,428 302,396 312,428" class="tree"/><polygon points="308,430 316,406 324,430" class="tree"/>
  <path d="M0 470 C 80 440, 170 455, 230 470 S 310 452, 340 462 L340 500 L0 500Z" class="hill1"/>
</g>`
  }
  if (phase === 'short') {
    return `<g>
  <ellipse cx="150" cy="474" rx="104" ry="22" class="cushion"/>
  <ellipse cx="150" cy="468" rx="92" ry="16" class="cushion2"/>
  ${cat(158, 446, 1)}
  <circle cx="268" cy="468" r="17" class="yarn"/>
  <path d="M254 460 q14 -8 28 4 M253 470 q15 -10 30 2 M258 480 q12 -10 24 -4" class="yarnline"/>
  <path d="M283 474 C 300 488, 318 470, 336 490" class="yarnthread"/>
  <text x="62" y="404" class="zzz">z</text><text x="76" y="392" class="zzz small">z</text>
</g>`
  }

  return `<g>
  <mask id="moonCut"><rect width="${W}" height="${H}" fill="#fff"/><circle cx="268" cy="384" r="22" fill="#000"/></mask>
  <circle cx="256" cy="392" r="24" class="moon" mask="url(#moonCut)"/>
  ${star(60, 380, 1)}${star(110, 404, 0.7)}${star(200, 372, 0.8)}${star(310, 420, 0.6)}${star(30, 420, 0.5)}
  <path d="M0 444 C 70 410, 140 414, 200 438 S 300 414, 340 428 L340 500 L0 500Z" class="hill2"/>
  <path d="M0 474 C 90 446, 170 458, 236 474 S 312 458, 340 466 L340 500 L0 500Z" class="hill1"/>
  ${cat(176, 456, 0.6)}
</g>`
}

/** The phase's art palette, tinted with the theme's phase color and grays. */
function themed(base: Palette, hot: string, deep: string, m: PomoMode, isDark: boolean): Palette {
  const bg = isDark ? mix(m.card, hot, 0.08) : mix('#ffffff', hot, 0.07)

  return {
    ...base,
    bg,
    ink: m.ink,
    soft: m.soft,
    deco: mix(bg, hot, 0.3),
    track: mix(bg, hot, isDark ? 0.18 : 0.16),
    tick: mix(bg, m.ink, isDark ? 0.2 : 0.16),
    accent: isDark ? mix(hot, '#ffffff', 0.1) : hot,
    script: isDark ? mix(hot, '#ffffff', 0.35) : deep,
    hill1: mix(bg, hot, isDark ? 0.42 : 0.5),
    hill2: mix(bg, hot, isDark ? 0.25 : 0.28),
  }
}

export function pomoArt(p: Pomo, now: number, palette?: PomoPalette): string {
  const total = durationMs(p)
  const left = remaining(p, now)
  const frac = Math.max(0, Math.min(1, (total - left) / Math.max(1, total)))
  const circ = 2 * Math.PI * R
  const tipA = frac * Math.PI * 2
  const tipX = CX + Math.sin(tipA) * R
  const tipY = CY - Math.cos(tipA) * R
  const own = PALETTES[p.phase]
  const tint = palette?.phase[p.phase]
  const pal =
    palette === undefined || tint === undefined
      ? own
      : { light: themed(own.light, tint[0], tint[1], palette.light, false), dark: themed(own.dark, tint[0], tint[1], palette.dark, true) }
  const lines = LINES[p.phase]
  const line = lines[p.completed % lines.length] ?? lines[0] ?? ''
  const session = p.phase === 'focus' ? `  ·  SESSION ${Math.min(p.cycle + 1, SET)} OF ${SET}` : ''
  const state = p.isRunning
    ? p.phase === 'focus' ? 'UNTIL YOUR BREAK' : 'UNTIL FOCUS'
    : left < total ? 'PAUSED' : 'PRESS START'
  const dots = Array.from({ length: SET }, (_, i) =>
    `<circle cx="${CX - 27 + i * 18}" cy="268" r="4.5" class="${i < p.cycle ? 'dot on' : 'dot'}"/>`,
  ).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<style>
svg{${css(pal.light)}}
@media (prefers-color-scheme: dark){svg{${css(pal.dark)}}}
.bg{fill:var(--bg)}
.deco{fill:none;stroke:var(--deco);stroke-width:1.5}
.label{font:600 11px -apple-system,'SF Pro Text','Helvetica Neue',sans-serif;letter-spacing:2.2px;fill:var(--accent)}
.track{fill:none;stroke:var(--track);stroke-width:10}
.tick{stroke:var(--tick);stroke-width:1.4;stroke-linecap:round}
.tl{stroke-width:2.4}
.arc{fill:none;stroke:var(--accent);stroke-width:10;stroke-linecap:round}
.tip{fill:var(--accent);stroke:var(--bg);stroke-width:3}
.time{font:700 78px 'DIN Condensed','Avenir Next Condensed','Impact','Arial Narrow',sans-serif;fill:var(--ink);letter-spacing:1px}
.state{font:600 10px -apple-system,'SF Pro Text','Helvetica Neue',sans-serif;letter-spacing:2px;fill:var(--soft)}
.dot{fill:none;stroke:var(--accent);stroke-width:1.5}
.dot.on{fill:var(--accent)}
.script{font:32px 'Snell Roundhand','Savoye LET','Apple Chancery','Segoe Script',cursive;fill:var(--script)}
.hill1{fill:var(--hill1)}.hill2{fill:var(--hill2)}.tree{fill:var(--tree)}.trunk{fill:var(--trunk)}
.sun{fill:var(--sun)}.leafF{fill:var(--leaf)}
.cushion{fill:var(--cushion)}.cushion2{fill:var(--cushion2)}
.cat{fill:var(--cat)}.inner{fill:var(--nose);opacity:.55}.stripe{fill:none;stroke:var(--catDark);stroke-width:3;stroke-linecap:round}
.tail{fill:none;stroke:var(--cat);stroke-width:12;stroke-linecap:round}
.eye{fill:none;stroke:var(--ink);stroke-width:1.8;stroke-linecap:round}
.nose{fill:var(--nose)}.whisker{stroke:var(--catDark);stroke-width:1;stroke-linecap:round}
.yarn{fill:var(--yarn)}.yarnline{fill:none;stroke:var(--bg);stroke-width:1.4;opacity:.7}
.yarnthread{fill:none;stroke:var(--yarn);stroke-width:1.6}
.zzz{font:italic 600 18px -apple-system,'Helvetica Neue',sans-serif;fill:var(--soft)}.small{font-size:13px}
.star{fill:var(--star)}.moon{fill:var(--moon)}
</style>
<defs><clipPath id="card"><rect width="${W}" height="${H}" rx="28"/></clipPath></defs>
<g clip-path="url(#card)">
<rect width="${W}" height="${H}" class="bg"/>
<path d="M-10 92 C 40 20, 110 130, 175 64 S 300 10, 350 70" class="deco"/>
<path d="M-20 300 C 20 260, 10 210, -30 190" class="deco"/>
<text x="${CX}" y="40" text-anchor="middle" class="label">${LABEL[p.phase]}${session}</text>
<circle cx="${CX}" cy="${CY}" r="${R}" class="track"/>
${TICKS}
${frac > 0.001 ? `<circle cx="${CX}" cy="${CY}" r="${R}" class="arc" stroke-dasharray="${(frac * circ).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 ${CX} ${CY})"/>` : ''}
<circle cx="${tipX.toFixed(1)}" cy="${tipY.toFixed(1)}" r="8" class="tip"/>
<text x="${CX}" y="${CY + 26}" text-anchor="middle" class="time">${mmss(left)}</text>
<text x="${CX}" y="${CY + 52}" text-anchor="middle" class="state">${state}</text>
${dots}
<text x="${CX}" y="348" text-anchor="middle" class="script">${line}</text>
${scene(p.phase)}
</g>
</svg>`
}
