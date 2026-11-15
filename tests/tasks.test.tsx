import { describe, expect, test } from 'claude-code/testing'

import {
  NO_TASKS,
  activeTask,
  addTask,
  clearDone,
  creditPomodoro,
  escapeXml,
  parseStored,
  pickTask,
  removeTask,
  toggleTask,
} from '../hooks/tasks-core'

const PANE = {
  plugin: 'themes-for-claude',
  component: 'Pane',
  requestId: 'pomodoro-pane',
  props: {
    title: 'Pomodoro',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

describe('task logic', () => {
  test('the first open task is current until another is picked', async () => {
    let l = addTask(NO_TASKS, '  Write   tests ', 'a')
    l = addTask(l, 'Ship it', 'b')
    l = addTask(l, '   ', 'c')
    expect(l.items.map(t => t.text)).toEqual(['Write tests', 'Ship it'])
    expect(activeTask(l)?.id).toBe('a')

    l = pickTask(l, 'b')
    expect(activeTask(l)?.id).toBe('b')

    l = toggleTask(l, 'b')
    expect(activeTask(l)?.id).toBe('a')
    expect(pickTask(l, 'b').activeId).toBe(l.activeId)
  })

  test('a finished focus session credits the current task', async () => {
    let l = addTask(addTask(NO_TASKS, 'One', 'a'), 'Two', 'b')
    l = creditPomodoro(pickTask(l, 'b'))
    l = creditPomodoro(l)
    expect(l.items.find(t => t.id === 'b')?.pomodoros).toBe(2)
    expect(creditPomodoro(NO_TASKS)).toEqual(NO_TASKS)
  })

  test('remove, clear done, stored data and escaping', async () => {
    let l = addTask(addTask(NO_TASKS, 'One', 'a'), 'Two', 'b')
    l = removeTask(l, 'a')
    expect(l.items.map(t => t.id)).toEqual(['b'])
    expect(clearDone(toggleTask(l, 'b')).items).toEqual([])

    expect(parseStored({ items: [{ id: 'x', text: 'ok', isDone: false, pomodoros: 1 }, { id: 3 }], activeId: 'x' })).toEqual({
      items: [{ id: 'x', text: 'ok', isDone: false, pomodoros: 1 }],
      activeId: 'x',
    })
    expect(parseStored('junk')).toBe(undefined)
    expect(escapeXml('a <b> & "c"')).toBe('a &lt;b&gt; &amp; &quot;c&quot;')
  })
})

test('tasks are added, picked, ticked off and shown on the card', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('store.set', () => ({ value: undefined }))

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const inputKey = async () => (await ui.find({ type: 'Input' }))?.key ?? ''

    await ui.input({ key: await inputKey(), text: `Write the report ${surface}` })
    await ui.input({ key: await inputKey(), text: `Reply to <email> ${surface}` })

    // The list carries across surfaces: the first task added stays current.
    expect((await ui.find({ type: 'Text', text: '▸ Write the report desktop' }))?.text).toBe('▸ Write the report desktop')

    if (surface === 'desktop') {
      const card = String((await ui.find({ type: 'Svg' }))?.props.source ?? '')
      expect(card).toContain('Write the report')
    }
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const rows = await ui.findAll({ type: 'Button' })
  const pick = rows.find(b => b.text.includes('Reply to <email> desktop') && b.key?.startsWith('task-pick-'))
  await ui.press({ key: pick?.key ?? '' })

  const card = String((await ui.find({ type: 'Svg' }))?.props.source ?? '')
  expect(card).toContain('Reply to &lt;email&gt;')

  const done = (await ui.findAll({ type: 'Button' })).find(b => b.key === pick?.key?.replace('task-pick-', 'task-done-'))
  await ui.press({ key: done?.key ?? '' })
  expect((await ui.find({ type: 'Text', text: /\d\/4 done/ }))?.text).toBe('1/4 done')

  await ui.press({ key: 'tasks-clear' })
  expect((await ui.find({ type: 'Text', text: /\/3 done/ }))?.text).toBe('0/3 done')
  await ui.unmount()
})

test('/pomodoro task adds a task and saves it', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  const saved: unknown[] = []
  on('store.set', (_, e) => {
    saved.push(e)

    return { value: undefined }
  })

  const ran = await $.command.run({
    command: 'pomodoro',
    args: 'task Plan the week',
    origin: { kind: 'sdk' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  expect(JSON.stringify(ran)).toContain('Plan the week')
  expect(JSON.stringify(saved)).toContain('Plan the week')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: '▸ Plan the week' }))?.text).toBe('▸ Plan the week')
  await ui.unmount()
})
