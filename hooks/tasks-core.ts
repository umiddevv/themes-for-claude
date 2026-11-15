import type { Task, TaskList } from '../types'

// Pure task-list logic for the Pomodoro pane.

export const NO_TASKS: TaskList = { items: [] }
export const TASKS_SHAPE = 'tasks-1'
export const TASKS_STORE_KEY = 'pomodoro-tasks'
const MAX_TASKS = 50
const MAX_TEXT = 120

export function addTask(list: TaskList, text: string, id: string): TaskList {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT)

  if (clean === '' || list.items.length >= MAX_TASKS) {
    return list
  }
  const task: Task = { id, text: clean, isDone: false, pomodoros: 0 }

  return { items: [...list.items, task], activeId: activeTask(list) === undefined ? id : list.activeId }
}

/** The current task: the picked one while it is open, else the first open one. */
export function activeTask(list: TaskList): Task | undefined {
  const picked = list.items.find(t => t.id === list.activeId && !t.isDone)

  return picked ?? list.items.find(t => !t.isDone)
}

export function toggleTask(list: TaskList, id: string): TaskList {
  return { ...list, items: list.items.map(t => (t.id === id ? { ...t, isDone: !t.isDone } : t)) }
}

export function pickTask(list: TaskList, id: string): TaskList {
  const task = list.items.find(t => t.id === id)

  return task === undefined || task.isDone ? list : { ...list, activeId: id }
}

export function removeTask(list: TaskList, id: string): TaskList {
  const items = list.items.filter(t => t.id !== id)

  return { items, activeId: list.activeId === id ? undefined : list.activeId }
}

export function clearDone(list: TaskList): TaskList {
  return { ...list, items: list.items.filter(t => !t.isDone) }
}

/** A finished focus session counts for the current task. */
export function creditPomodoro(list: TaskList): TaskList {
  const active = activeTask(list)

  if (active === undefined) {
    return list
  }

  return {
    activeId: active.id,
    items: list.items.map(t => (t.id === active.id ? { ...t, pomodoros: t.pomodoros + 1 } : t)),
  }
}

/** Accepts what $.store held, dropping anything that is not a task list. */
export function parseStored(value: unknown): TaskList | undefined {
  if (typeof value !== 'object' || value === null || !Array.isArray((value as TaskList).items)) {
    return undefined
  }
  const v = value as { items: unknown[]; activeId?: unknown }
  const items = v.items.filter(
    (t): t is Task =>
      typeof t === 'object' &&
      t !== null &&
      typeof (t as Task).id === 'string' &&
      typeof (t as Task).text === 'string' &&
      typeof (t as Task).isDone === 'boolean' &&
      typeof (t as Task).pomodoros === 'number',
  )

  return { items, activeId: typeof v.activeId === 'string' ? v.activeId : undefined }
}

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] ?? c)
}

export function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}
