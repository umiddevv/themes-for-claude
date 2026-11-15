import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, Timer } from 'claude-code'

import { THEMES } from '../themes'
import type { Focus, Pomo, Stats } from '../types'
import { localDay, refreshStatus } from './clock'
import { pomoArt } from './pomo-art'
import {
  INITIAL,
  PHASE_COLOR,
  PHASE_ICON,
  PHASE_NAME,
  POMO_SHAPE,
  SET,
  advance,
  durationMs,
  mmss,
  nextPreset,
  parseMinutes,
  pause,
  remaining,
  reset,
  start,
} from './pomo-core'
import { statsCard } from './pomo-stats'
import { pomoPalette } from './pomo-theme'
import { pomoWidget } from './pomo-widget'
import {
  FOCUS_SHAPE,
  FOCUS_STORE_KEY,
  NO_FOCUS,
  NO_STATS,
  SOUND_STORE_KEY,
  STATS_SHAPE,
  STATS_STORE_KEY,
  addSession,
  creditFocus,
  formatMinutes,
  lastWeek,
  parseFocus,
  parseStats,
  setFocus,
  sparkline,
} from './stats-core'
import { TASKS_STORE_KEY, activeTask, parseStored } from './tasks-core'
import { findTheme } from './themes'

const pomodoro = atom({ plugin: 'themes-for-claude', key: 'pomodoro' } as const, INITIAL, { shape: POMO_SHAPE })
const tickAtom = atom({ plugin: 'themes-for-claude', key: 'pomodoroTick' } as const, 0)
const styleAtom = atom({ plugin: 'themes-for-claude', key: 'pomodoroStyle' } as const, 'widget' as 'widget' | 'illustrated')
const focusAtom = atom({ plugin: 'themes-for-claude', key: 'pomodoroFocus' } as const, NO_FOCUS, { shape: FOCUS_SHAPE })
const editingAtom = atom({ plugin: 'themes-for-claude', key: 'focusEditing' } as const, false)
const statsAtom = atom({ plugin: 'themes-for-claude', key: 'pomodoroStats' } as const, NO_STATS, { shape: STATS_SHAPE })
const soundAtom = atom({ plugin: 'themes-for-claude', key: 'pomodoroSound' } as const, true)
const themeAtom = atom({ plugin: 'themes-for-claude', key: 'themeId' } as const, THEMES[0]?.id ?? '')

export const POMO_PANE = 'pomodoro-pane'
const TITLE = 'Pomodoro'

let ticker: Timer | undefined

// ---- Saved values: the session's copy in state, a copy in $.store for later sessions ----

async function saveFocus($: EngineInterface, change: (f: Focus) => Focus): Promise<void> {
  await update($, focusAtom, change)
  await $.store.set(FOCUS_STORE_KEY, await read($, focusAtom)).catch(() => undefined)
}

async function saveStats($: EngineInterface, change: (s: Stats) => Stats): Promise<void> {
  await update($, statsAtom, change)
  await $.store.set(STATS_STORE_KEY, await read($, statsAtom)).catch(() => undefined)
}

async function saveSound($: EngineInterface, isOn: boolean): Promise<void> {
  await update($, soundAtom, () => isOn)
  await $.store.set(SOUND_STORE_KEY, isOn).catch(() => undefined)
}

async function loadSaved($: EngineInterface): Promise<void> {
  const get = (key: string) => $.store.get(key).catch(() => undefined)

  if ((await read($, focusAtom)).text === '') {
    const focus = parseFocus(await get(FOCUS_STORE_KEY))
    // 1.0 and 1.1 kept a task list: its current task becomes the focus line.
    const old = focus === undefined ? activeTask(parseStored(await get(TASKS_STORE_KEY)) ?? { items: [] }) : undefined
    const start = focus ?? (old === undefined ? undefined : { text: old.text, pomodoros: old.pomodoros })

    if (start !== undefined && start.text !== '') await update($, focusAtom, () => start)
  }
  const stats = parseStats(await get(STATS_STORE_KEY))

  if (stats !== undefined) await update($, statsAtom, () => stats)

  const sound = await get(SOUND_STORE_KEY)

  if (typeof sound === 'boolean') await update($, soundAtom, () => sound)
}

// ---- The timer ----

async function finishPhase($: EngineInterface, ended: Pomo): Promise<void> {
  const next = advance(ended, true)
  await update($, pomodoro, () => next)

  if (ended.phase === 'focus') {
    const day = localDay(await $.clock.now())
    await saveFocus($, creditFocus)
    await saveStats($, s => addSession(s, day, ended.minutes.focus))
  }

  const text =
    ended.phase === 'focus'
      ? `${PHASE_ICON.focus} Focus done. Time for a ${next.phase === 'long' ? 'long' : 'short'} break.`
      : `${PHASE_ICON[ended.phase]} Break over. Ready to focus?`

  $.ui.toast(text)
  void $.ui.notify(text, { title: 'Pomodoro' }).catch(() => undefined)

  if (await read($, soundAtom)) {
    void $.audio.play({ asset: 'sounds/chime.wav' }).catch(() => undefined)
  }
}

async function tick($: EngineInterface): Promise<void> {
  const p = await read($, pomodoro)

  if (!p.isRunning) {
    return
  }

  if (remaining(p, await $.clock.now()) <= 0) {
    await finishPhase($, p)
  }
  await update($, tickAtom, n => n + 1)
  await refreshStatus($)
}

export async function startPomodoro($: EngineInterface): Promise<void> {
  ticker?.cancel()
  ticker = $.clock.every(1000, () => void tick($))
  await loadSaved($)
}

export async function openPomodoro($: EngineInterface) {
  return $.ui.open({ id: POMO_PANE, title: TITLE })
}

export function registerPomodoro(on: On): void {
  on('command.run', { command: 'pomodoro' }, async ($, e) => {
    const args = e.args.trim()
    const lower = args.toLowerCase()
    const styleArg = /^style\s+(widget|illustrated)$/.exec(lower)?.[1]

    if (styleArg === 'widget' || styleArg === 'illustrated') {
      await update($, styleAtom, () => styleArg)
      await openPomodoro($)

      return { text: `Pomodoro style: ${styleArg}.` }
    }

    const focusArg = /^(?:focus|task|on)\s+(.+)$/is.exec(args)?.[1]

    if (focusArg !== undefined) {
      await saveFocus($, f => setFocus(f, focusArg))
      await openPomodoro($)

      return { text: `Working on: ${focusArg.trim()}` }
    }

    if (lower === 'sound on' || lower === 'sound off') {
      await saveSound($, lower === 'sound on')

      return { text: `Pomodoro sound ${lower === 'sound on' ? 'on' : 'off'}.` }
    }

    if (lower !== '') {
      const minutes = parseMinutes(lower)

      if (minutes === undefined) {
        return {
          text: 'Usage: /pomodoro focus <what you are working on>, /pomodoro 50 10 20 (minutes), /pomodoro sound on|off, or /pomodoro style widget|illustrated',
        }
      }
      await update($, pomodoro, p => reset({ ...p, minutes }))
      await openPomodoro($)

      return { text: `Pomodoro set to ${minutes.focus} / ${minutes.short} / ${minutes.long} minutes.` }
    }
    await openPomodoro($)

    return { text: 'Pomodoro pane opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: POMO_PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text, Button, Input, Progress } = elements
    const Svg = e.surface !== 'terminal' && 'Svg' in elements ? elements.Svg : undefined
    const p = await read($, pomodoro)
    const style = await read($, styleAtom)
    const focus = await read($, focusAtom)
    const isEditing = await read($, editingAtom)
    const stats = await read($, statsAtom)
    const isSoundOn = await read($, soundAtom)
    // Reading the theme here redraws the pane when /look switches it.
    const palette = pomoPalette(findTheme(await read($, themeAtom)))
    await read($, tickAtom)
    const now = await $.clock.now()
    const left = remaining(p, now)
    const total = durationMs(p)
    const today = localDay(now)
    const week = lastWeek(stats, today)
    const todaySessions = stats.days[today]?.sessions ?? 0

    // ---- What the buttons do ----
    const toggle = async () => {
      const at = await $.clock.now()
      await update($, pomodoro, q => (q.isRunning ? pause(q, at) : start(q, at)))
      await refreshStatus($)
    }
    const doReset = async () => {
      await update($, pomodoro, reset)
      await refreshStatus($)
    }
    const skip = async () => {
      await update($, pomodoro, q => advance(q, false))
      await refreshStatus($)
    }
    const preset = async () => {
      const q = await read($, pomodoro)
      const minutes = nextPreset(q.minutes)
      await update($, pomodoro, r => reset({ ...r, minutes }))
      await refreshStatus($)
      $.ui.toast(`Pomodoro: ${minutes.focus} min focus, ${minutes.short} min break`)
    }
    const sound = async () => {
      const isOn = !(await read($, soundAtom))
      await saveSound($, isOn)
      $.ui.toast(isOn ? '🔔 Chime on' : '🔕 Chime off')
    }
    const submitFocus = async (text: string) => {
      const isEdit = await read($, editingAtom)
      await saveFocus($, f => setFocus(f, text, isEdit))
      await update($, editingAtom, () => false)
    }
    const finishFocus = async () => {
      const f = await read($, focusAtom)
      await saveFocus($, () => NO_FOCUS)
      $.ui.toast(`✓ ${f.text}${f.pomodoros > 0 ? ` · ${f.pomodoros} 🍅` : ''}`)
    }

    // ---- Controls: one main button, then small ones ----
    const mainLabel = p.isRunning ? '⏸ Pause' : left < total ? '▶ Resume' : '▶ Start'
    const controls = (
      <Box flexDirection="row" gap={1} justifyContent="center" alignItems="center">
        <Button key="pomo-toggle" label={mainLabel} hotkey="s" variant="primary" onPress={() => void toggle()} />
        <Button key="pomo-skip" label="⏭" plain hotkey="n" onPress={() => void skip()} />
        <Button key="pomo-reset" label="↺" plain hotkey="r" onPress={() => void doReset()} />
        <Button key="pomo-preset" label={`${p.minutes.focus}/${p.minutes.short}`} plain dimColor hotkey="p" onPress={() => void preset()} />
        <Button key="pomo-sound" label={isSoundOn ? '🔔' : '🔕'} plain dimColor hotkey="m" onPress={() => void sound()} />
      </Box>
    )

    // ---- What you are working on ----
    const focusLine =
      focus.text === '' || isEditing ? (
        <Box flexDirection="row" alignItems="center" gap={1} width="100%">
          <Box flexGrow={1}>
            <Input
              key={isEditing ? 'focus-input-edit' : 'focus-input'}
              placeholder="What are you working on?"
              submitLabel="set"
              value={isEditing ? focus.text : ''}
              onSubmit={value => void submitFocus(value)}
            />
          </Box>
          {isEditing && <Button key="focus-cancel" label="✕" plain dimColor onPress={() => void update($, editingAtom, () => false)} />}
        </Box>
      ) : (
        <Box flexDirection="row" alignItems="center" gap={1} width="100%">
          <Box flexGrow={1}>
            <Text bold wrap="truncate-end">{`▸ ${focus.text}`}</Text>
          </Box>
          {focus.pomodoros > 0 && <Text dimColor>{`🍅 ${focus.pomodoros}`}</Text>}
          <Button key="focus-edit" label="✎" plain dimColor onPress={() => void update($, editingAtom, () => true)} />
          <Button key="focus-done" label="✓" plain onPress={() => void finishFocus()} />
        </Box>
      )

    const alt = `Pomodoro ${PHASE_NAME[p.phase]}: ${mmss(left)} left${p.isRunning ? '' : ', not running'}${focus.text === '' ? '' : `, working on ${focus.text}`}`
    const statsAlt = `Today ${formatMinutes(week.at(-1)?.minutes ?? 0)} of focus in ${todaySessions} sessions`

    // ---- Desktop, mobile and the editor: picture cards ----
    if (Svg !== undefined) {
      const card = style === 'widget' ? pomoWidget(p, now, focus.text || undefined, palette) : pomoArt(p, now, palette)

      return (
        <Box flexDirection="column" gap={1} alignItems="center">
          <Svg source={card} alt={alt} />
          {controls}
          <Box width="100%" paddingX={1}>
            {focusLine}
          </Box>
          <Svg source={statsCard(week, todaySessions, palette)} alt={statsAlt} />
        </Box>
      )
    }

    // ---- The terminal: text ----
    const color = PHASE_COLOR[p.phase]
    const dots = '●'.repeat(Math.min(p.cycle, SET)) + '○'.repeat(Math.max(0, SET - p.cycle))

    return (
      <Box flexDirection="column" gap={1} paddingX={1} alignItems="center">
        <Text size="caption" weight="semibold" color={color}>
          {`${PHASE_ICON[p.phase]} ${PHASE_NAME[p.phase].toUpperCase()}`}
        </Text>
        <Text size="title" weight="bold" tabular mono>
          {mmss(left)}
        </Text>
        <Box width="100%">
          <Progress label={PHASE_NAME[p.phase]} value={total - left} max={total} valueText={`${mmss(total - left)} of ${mmss(total)}`} color={color} />
        </Box>
        <Text color={color}>{dots}</Text>
        {controls}
        {focusLine}
        <Text dimColor>{`Today ${formatMinutes(week.at(-1)?.minutes ?? 0)} · ${todaySessions} ${todaySessions === 1 ? 'session' : 'sessions'}`}</Text>
        <Text dimColor mono>{`${sparkline(week)}  ${week.map(b => b.letter).join('')}`}</Text>
      </Box>
    )
  })
}
