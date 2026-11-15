import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, Timer } from 'claude-code'

import type { Pomo, TaskList } from '../types'
import { refreshStatus } from './clock'
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
import { pomoWidget } from './pomo-widget'
import {
  NO_TASKS,
  TASKS_SHAPE,
  TASKS_STORE_KEY,
  activeTask,
  addTask,
  clearDone,
  creditPomodoro,
  parseStored,
  pickTask,
  removeTask,
  toggleTask,
} from './tasks-core'

const pomodoro = atom({ plugin: 'themes-for-claude', key: 'pomodoro' } as const, INITIAL, { shape: POMO_SHAPE })
const tickAtom = atom({ plugin: 'themes-for-claude', key: 'pomodoroTick' } as const, 0)
const styleAtom = atom({ plugin: 'themes-for-claude', key: 'pomodoroStyle' } as const, 'widget' as 'widget' | 'illustrated')
const tasksAtom = atom({ plugin: 'themes-for-claude', key: 'pomodoroTasks' } as const, NO_TASKS, { shape: TASKS_SHAPE })

export const POMO_PANE = 'pomodoro-pane'
const TITLE = 'Pomodoro'

let ticker: Timer | undefined

/** Changes the task list and keeps a copy in $.store, so it outlives the session. */
async function saveTasks($: EngineInterface, change: (list: TaskList) => TaskList): Promise<void> {
  await update($, tasksAtom, change)
  // The session's copy is already changed; a failed save only loses the copy for later sessions.
  await $.store.set(TASKS_STORE_KEY, await read($, tasksAtom)).catch(() => undefined)
}

async function loadTasks($: EngineInterface): Promise<void> {
  const current = await read($, tasksAtom)

  if (current.items.length > 0) {
    return
  }
  const stored = parseStored(await $.store.get(TASKS_STORE_KEY).catch(() => undefined))

  if (stored !== undefined && stored.items.length > 0) {
    await update($, tasksAtom, () => stored)
  }
}

async function finishPhase($: EngineInterface, ended: Pomo): Promise<void> {
  const next = advance(ended, true)
  await update($, pomodoro, () => next)

  if (ended.phase === 'focus') {
    await saveTasks($, creditPomodoro)
  }

  const text =
    ended.phase === 'focus'
      ? `${PHASE_ICON.focus} Focus done. Time for a ${next.phase === 'long' ? 'long' : 'short'} break.`
      : `${PHASE_ICON[ended.phase]} Break over. Ready to focus?`

  $.ui.toast(text)
  void $.ui.notify(text, { title: 'Pomodoro' }).catch(() => undefined)
  void $.audio.play({ asset: 'sounds/chime.wav' }).catch(() => undefined)
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
  await loadTasks($)
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

    const taskArg = /^(?:task|add)\s+(.+)$/is.exec(args)?.[1]

    if (taskArg !== undefined) {
      const id = `t${(await $.clock.now()).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
      await saveTasks($, list => addTask(list, taskArg, id))
      await openPomodoro($)

      return { text: `Task added: ${taskArg.trim()}` }
    }

    if (lower !== '') {
      const minutes = parseMinutes(lower)

      if (minutes === undefined) {
        return {
          text: 'Usage: /pomodoro [focus] [short] [long] in minutes (e.g. /pomodoro 50 10 20), /pomodoro task <text>, or /pomodoro style widget|illustrated',
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
    const list = await read($, tasksAtom)
    await read($, tickAtom)
    const now = await $.clock.now()
    const left = remaining(p, now)
    const total = durationMs(p)
    const color = PHASE_COLOR[p.phase]
    const dots = '●'.repeat(Math.min(p.cycle, SET)) + '○'.repeat(Math.max(0, SET - p.cycle))
    const current = activeTask(list)

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
      $.ui.toast(`Pomodoro: ${minutes.focus} / ${minutes.short} / ${minutes.long} minutes`)
    }
    const add = async (text: string) => {
      const id = `t${(await $.clock.now()).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
      await saveTasks($, l => addTask(l, text, id))
    }

    // ---- Task list, shared by every style ----
    const open = list.items.filter(t => !t.isDone)
    const done = list.items.filter(t => t.isDone)
    const doneCount = done.length
    const tasks = (
      <Box flexDirection="column" width="100%" paddingX={1} gap={0}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold>Tasks</Text>
          {list.items.length > 0 && <Text dimColor size="caption">{`${doneCount}/${list.items.length} done`}</Text>}
        </Box>
        <Input
          key={`task-input-${list.items.length}`}
          placeholder="Add a task and press Enter"
          submitLabel="add"
          value=""
          onSubmit={value => void add(value)}
        />
        {[...open, ...done].map(t => {
          const isActive = current?.id === t.id

          return (
            <Box key={`task-row-${t.id}`} flexDirection="row" alignItems="center" gap={1}>
              <Button key={`task-done-${t.id}`} label={t.isDone ? '☑' : '☐'} plain onPress={() => void saveTasks($, l => toggleTask(l, t.id))} />
              <Box flexGrow={1}>
                <Button key={`task-pick-${t.id}`} plain dimColor={t.isDone} onPress={() => void saveTasks($, l => pickTask(l, t.id))}>
                  <Text bold={isActive} strikethrough={t.isDone}>
                    {isActive ? `▸ ${t.text}` : t.text}
                  </Text>
                </Button>
              </Box>
              {t.pomodoros > 0 && <Text dimColor size="caption">{`🍅${t.pomodoros}`}</Text>}
              <Button key={`task-del-${t.id}`} label="×" plain dimColor onPress={() => void saveTasks($, l => removeTask(l, t.id))} />
            </Box>
          )
        })}
        {list.items.length === 0 && <Text dimColor size="caption">Each finished focus session adds a 🍅 to the current task.</Text>}
        {doneCount > 0 && (
          <Box flexDirection="row" justifyContent="flex-end">
            <Button key="tasks-clear" label="Clear done" plain dimColor onPress={() => void saveTasks($, clearDone)} />
          </Box>
        )}
      </Box>
    )

    const startLabel = p.isRunning ? 'Pause' : left < total ? 'Resume' : 'Start'
    const alt = `Pomodoro ${PHASE_NAME[p.phase]}: ${mmss(left)} left${p.isRunning ? '' : ', not running'}${current === undefined ? '' : `, task: ${current.text}`}`

    // Desktop, mobile and the editor draw a card; the terminal keeps the text version.
    if (Svg !== undefined && style === 'widget') {
      const nextPhase = p.phase === 'focus' ? 'Break' : 'Focus'

      return (
        <Box flexDirection="column" gap={1} alignItems="center">
          <Svg source={pomoWidget(p, now, current?.text)} alt={alt} />
          <Box flexDirection="row" gap={1} justifyContent="center" alignItems="center">
            <Button key="pomo-preset" label="⚙" plain hotkey="p" dimColor onPress={() => void preset()} />
            <Button key="pomo-toggle" label={p.isRunning ? '⏸ Pause' : '▶ ' + startLabel} hotkey="s" variant="primary" onPress={() => void toggle()} />
            <Button key="pomo-skip" label={nextPhase} hotkey="n" onPress={() => void skip()} />
            <Button key="pomo-reset" label="↺" plain hotkey="r" dimColor onPress={() => void doReset()} />
          </Box>
          <Text dimColor size="caption">
            {`${p.completed} done · ${p.minutes.focus}/${p.minutes.short}/${p.minutes.long} min`}
          </Text>
          {tasks}
        </Box>
      )
    }

    const buttons = (
      <Box flexDirection="row" gap={1} justifyContent="center">
        <Button key="pomo-toggle" label={startLabel} hotkey="s" variant="primary" onPress={() => void toggle()} />
        <Button key="pomo-reset" label="Reset" hotkey="r" onPress={() => void doReset()} />
        <Button key="pomo-skip" label="Skip" hotkey="n" onPress={() => void skip()} />
      </Box>
    )
    const footer = `${p.completed} done · ${p.minutes.focus}/${p.minutes.short}/${p.minutes.long} min · long break after ${SET}`

    if (Svg !== undefined) {
      return (
        <Box flexDirection="column" gap={1} alignItems="center">
          <Svg source={pomoArt(p, now)} alt={alt} />
          {buttons}
          <Text dimColor size="caption">
            {footer}
          </Text>
          {tasks}
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1} paddingX={1} alignItems="center">
        <Text size="caption" weight="semibold" color={color}>
          {`${PHASE_ICON[p.phase]} ${PHASE_NAME[p.phase].toUpperCase()}`}
        </Text>
        <Text size="title" weight="bold" tabular mono>
          {mmss(left)}
        </Text>
        {current !== undefined && <Text dimColor>{`▸ ${current.text}`}</Text>}
        <Box width="100%">
          <Progress
            label={PHASE_NAME[p.phase]}
            value={total - left}
            max={total}
            valueText={`${mmss(total - left)} of ${mmss(total)}`}
            color={color}
          />
        </Box>
        <Text color={color}>{dots}</Text>
        {buttons}
        <Text dimColor size="caption">
          {footer}
        </Text>
        {tasks}
      </Box>
    )
  })
}
