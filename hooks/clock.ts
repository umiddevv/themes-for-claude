import { atom, read } from 'claude-code'
import type { EngineInterface, Timer } from 'claude-code'

import { INITIAL, POMO_SHAPE, pomoStatus } from './pomo-core'

const pomodoro = atom({ plugin: 'themes-for-claude', key: 'pomodoro' } as const, INITIAL, { shape: POMO_SHAPE })

// Minutes east of UTC. The hooks sandbox may not know the Mac's time zone,
// so it is read from the host's `date`; Date's own offset is the fallback.
let offsetMinutes: number | undefined
let timers: Timer[] = []

export function parseOffset(text: string): number | undefined {
  const m = /^([+-])(\d\d)(\d\d)/.exec(text.trim())

  if (m === null) {
    return undefined
  }

  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]))
}

const pad = (n: number) => String(n).padStart(2, '0')

export function formatTime(ms: number, offset?: number): string {
  const shift = offset ?? -new Date(ms).getTimezoneOffset()
  const d = new Date(ms + shift * 60_000)

  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

export function localTime(ms: number): string {
  return formatTime(ms, offsetMinutes)
}

async function readOffset($: EngineInterface): Promise<void> {
  try {
    const { exitCode, stdout } = await $.process.run(['date', '+%z'], { timeoutMs: 3000 })

    if (exitCode === 0) {
      offsetMinutes = parseOffset(stdout) ?? offsetMinutes
    }
  } catch {
    // Keep Date's own offset.
  }
}

/** The status line: the Pomodoro countdown while a timer runs, else nothing. */
export async function refreshStatus($: EngineInterface): Promise<void> {
  $.ui.status(pomoStatus(await read($, pomodoro), await $.clock.now()))
}

/** Learns the local time zone (for rate-limit reset times) and clears the status line. */
export async function startClock($: EngineInterface): Promise<void> {
  for (const t of timers) t.cancel()
  await readOffset($)
  await refreshStatus($)
  // Re-read the offset hourly so a daylight-saving change is picked up.
  timers = [$.clock.every(3_600_000, () => void readOffset($))]
}
