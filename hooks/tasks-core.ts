import type { Task, TaskList } from '../types'

// Versions 1.0 and 1.1 kept a task list. Only what carries its current task
// over to the focus line is left, with two text helpers the cards use.

export const TASKS_STORE_KEY = 'pomodoro-tasks'

/** The list's current task: the picked one while it is open, else the first open one. */
export function activeTask(list: TaskList): Task | undefined {
  const picked = list.items.find(t => t.id === list.activeId && !t.isDone)

  return picked ?? list.items.find(t => !t.isDone)
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

  return { items, ...(typeof v.activeId === 'string' ? { activeId: v.activeId } : {}) }
}

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] ?? c)
}

export function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}
