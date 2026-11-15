// A deep sea drawn in code characters: a whale, a manta ray, a jellyfish and a
// school of fish, each a silhouette filled with glyphs, drifting slowly while
// single glyphs rise like bubbles. Built once from shape functions with a
// fixed random seed, so it is the same every time. Pure SVG + CSS.

const W = 1600
const H = 1000
const CW = 7.2 // a monospace character's width at 12px
const LH = 12.5 // line height

const GLYPHS = '{}[]()<>/\\|_-~=+*:;.,!?^1lijtfrxnuvczXYUJQ0O#%&$@'

/** A small seeded random generator, so the scene never changes between loads. */
function seeded(seed: number): () => number {
  let a = seed >>> 0

  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = seeded(20261115)
const pick = (s: string) => s[Math.floor(rand() * s.length)] ?? '.'

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

type Shape = (u: number, v: number) => boolean

/**
 * Fills a shape with glyphs on a grid of `cols` x `rows`. `u` runs 0..1 across,
 * `v` -1..1 down. A few glyphs take the accent color, as a spark.
 */
function glyphs(shape: Shape, cols: number, rows: number, sparks = 2, isMirrored = false): string {
  const lines: string[] = []
  let sparked = 0

  for (let r = 0; r < rows; r++) {
    let line = ''
    let lastIn = -1

    for (let c = 0; c < cols; c++) {
      const across = (c + 0.5) / cols
      const u = isMirrored ? 1 - across : across
      const v = ((r + 0.5) / rows) * 2 - 1
      const isIn = shape(u, v)

      if (isIn) lastIn = c
      line += isIn ? '\u0000' : ' '
    }
    if (lastIn < 0) continue
    line = line.slice(0, lastIn + 1)
    let out = ''

    for (const ch of line) {
      if (ch === ' ') {
        out += ' '
      } else if (sparked < sparks && rand() < 0.006) {
        out += `<tspan class="spark">${esc(pick(GLYPHS))}</tspan>`
        sparked++
      } else {
        out += esc(pick(GLYPHS))
      }
    }
    lines.push(`<text x="0" y="${(r * LH).toFixed(1)}">${out}</text>`)
  }

  return lines.join('')
}

// ---- Silhouettes (head on the left: they swim left unless mirrored) ----

const whale: Shape = (u, v) => {
  // Body: a long teardrop, round head on the left, tapering to the tail.
  const t = (u - 0.04) / 0.84
  const half = t >= 0 && t <= 1 ? 0.8 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.8) : 0
  const body = Math.abs(v - 0.05) < Math.max(half, t > 0.85 && t <= 1 ? 0.2 : 0)
  // Tail stalk joined to the body, then flukes spreading up and down.
  const stalk = u > 0.78 && u < 0.92 && Math.abs(v) < 0.22
  const fluke = u > 0.86 && u < 1 && Math.abs(v) < 0.2 + (u - 0.86) * 6 && Math.abs(v) > (u - 0.86) * 2.4
  // Pectoral fin under the body.
  const fin = u > 0.3 && u < 0.44 && v > 0.45 && v < 0.45 + (0.44 - u) * 5

  return body || stalk || fluke || fin
}

const manta: Shape = (u, v) => {
  // Wide diamond wings with a soft curve, and a thin tail behind.
  // Seen from above: pointed wing tips left and right, a blunt head, a whip tail.
  const x = Math.abs(u - 0.4) / 0.4
  const wing = x <= 1 && Math.abs(v + 0.05) < 0.95 * Math.pow(1 - x, 1.5) * (v < 0 ? 1 : 0.6)
  const head = u > 0.66 && u < 0.76 && v > -0.55 && v < -0.2
  const tail = u > 0.74 && u < 1 && Math.abs(v + 0.05 - (u - 0.74) * 0.4) < 0.07

  return wing || head || tail
}

const jelly: Shape = (u, v) => {
  // A dome on top, then wavy tentacles.
  const dome = v < -0.25 && (u - 0.5) ** 2 / 0.21 + ((v + 0.25) / 0.75) ** 2 < 1
  const tentacle = v >= -0.25 && [0.2, 0.35, 0.5, 0.65, 0.8].some(c => Math.abs(u - c - 0.04 * Math.sin(v * 9 + c * 20)) < 0.035) && v < 0.95 - Math.abs(u - 0.5) * 0.6

  return dome || tentacle
}

// Small fish facing right, for a school that swims right.
const FISH = ['><(((°>', '><>', '>=>', '><((°>', '>->', '><o>']

function school(count: number, w: number, h: number): string {
  let out = ''

  for (let i = 0; i < count; i++) {
    const x = rand() * w
    const y = rand() * h
    const f = FISH[Math.floor(rand() * FISH.length)] ?? '><>'
    out += `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" class="fish" style="animation-delay:-${(rand() * 4).toFixed(2)}s">${esc(f)}</text>`
  }

  return out
}

function bubbles(count: number): string {
  let out = ''

  for (let i = 0; i < count; i++) {
    const x = (rand() * W).toFixed(0)
    const y = (H * 0.35 + rand() * H * 0.75).toFixed(0)
    const dur = (22 + rand() * 30).toFixed(1)
    const delay = (rand() * 40).toFixed(1)
    out += `<text x="${x}" y="${y}" class="bub" style="animation-duration:${dur}s;animation-delay:-${delay}s">${esc(pick("()o.:~'`^"))}</text>`
  }

  return out
}

const WHALE = glyphs(whale, 64, 18, 2)
const MANTA = glyphs(manta, 46, 12, 1, true)
const JELLY = glyphs(jelly, 18, 20, 1)
const SCHOOL = school(16, 220, 120)
const BUBBLES = bubbles(46)

const scene = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
<style>
svg{--sea-top:#070b10;--sea-low:#0b131b;--ink:#9fd3cf;--ink2:#6fa8b5;--spark:#ff6b5e}
@media (prefers-color-scheme: light){svg{--sea-top:#eef3f4;--sea-low:#e2ebee;--ink:#2d6f78;--ink2:#4f8792;--spark:#d9473c}}
text{font:500 12px 'SF Mono',Menlo,Monaco,'Courier New',monospace;white-space:pre;fill:var(--ink)}
.spark{fill:var(--spark)}
.creature{opacity:.62}
.far{opacity:.32}
.fish{fill:var(--ink2);animation:wiggle 3.6s ease-in-out infinite alternate}
.bub{fill:var(--ink2);opacity:0;animation:rise linear infinite}
.swimL{animation:swimL 150s linear infinite}
.swimR{animation:swimR 190s linear infinite}
.swimR2{animation:swimR 120s linear infinite}
.bob{animation:bob 9s ease-in-out infinite alternate}
.glide{animation:bob 13s ease-in-out infinite alternate}
.drift{animation:drift 70s ease-in-out infinite alternate}
.pulse{animation:pulse 4.5s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:50% 0}
@keyframes swimL{from{transform:translateX(${W + 80}px)}to{transform:translateX(-620px)}}
@keyframes swimR{from{transform:translateX(-520px)}to{transform:translateX(${W + 80}px)}}
@keyframes bob{from{transform:translateY(-14px)}to{transform:translateY(16px)}}
@keyframes drift{from{transform:translate(0,40px)}to{transform:translate(60px,-120px)}}
@keyframes pulse{from{transform:scaleY(.94)}to{transform:scaleY(1.05)}}
@keyframes wiggle{from{transform:translateY(-3px)}to{transform:translateY(3px)}}
@keyframes rise{0%{opacity:0;transform:translateY(0)}12%{opacity:.55}80%{opacity:.35}100%{opacity:0;transform:translateY(-520px)}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}.bub{opacity:.3}}
</style>
<defs><linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sea-top)"/><stop offset="1" stop-color="var(--sea-low)"/></linearGradient></defs>
<rect width="${W}" height="${H}" style="fill:url(#sea)"/>
<!-- Each position is on its own group: a CSS animation's transform would replace a transform attribute on the same element. -->
<g class="swimR far"><g transform="translate(0 140) scale(1.15)"><g class="glide">${MANTA}</g></g></g>
<g class="swimL creature"><g transform="translate(0 560) scale(1.35)"><g class="bob">${WHALE}</g></g></g>
<g transform="translate(1270 210) scale(1.2)"><g class="drift creature"><g class="pulse">${JELLY}</g></g></g>
<g class="swimR2 creature"><g transform="translate(0 830) scale(1.1)"><g class="glide">${SCHOOL}</g></g></g>
${BUBBLES}
</svg>`

export default scene
