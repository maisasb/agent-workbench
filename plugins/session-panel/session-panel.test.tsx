import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'session-panel',
  component: 'Pane',
  requestId: 'session-panel',
  props: {
    title: 'Sessions',
    isFocused: true,
    bodyColumns: 80,
    placement: 'inline',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const SID = '11111111-2222-3333-4444-555555555555'
const registry = {
  pid: 4242,
  sessionId: SID,
  name: 'workspace-aa',
  status: 'idle',
  cwd: '/home/user/workspace',
  statusUpdatedAt: 0,
}
const details = { [SID]: { title: 'Minha sessão', prompt: 'oi', said: 'Pronto.', quiet: 1, tool: '' } }

test('pressing a session row fills the prompt', async ($, on) => {
  on('clock.every', () => ({ value: { cancel() {} } }))
  on('clock.now', () => ({ value: 1000000 }))
  on('command.register', () => ({ value: { command: 'x' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.list', (_, e) => ({ value: String(e.path).endsWith('sessions') ? [{ name: 'a.json', kind: 'file', size: 1, mtimeMs: 0, isLink: false }] : [] }))
  on('fs.read', () => ({ value: JSON.stringify(registry) }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify(details), stderr: '' } }))
  on('session.id', () => ({ value: 'other' }))
  let filled = ''
  on('prompt.fill', (_, e) => {
    filled = e.text
    return { isFilled: true, cursor: 0 }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await new Promise(r => setTimeout(r, 50))
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    filled = ''
    const ui = await $.ui.mount({ ...PANE, surface })
    const row = await ui.find({ type: 'Button', key: `pick-${SID}` })
    expect(row).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'new-session' })).toBeDefined()
    await ui.press({ key: `pick-${SID}` })
    expect(filled).toBe('/panel-send 1 ')
    await ui.unmount()
  }
})

test('the band draws one line with the count', async ($, on) => {
  on('clock.every', () => ({ value: { cancel() {} } }))
  on('clock.now', () => ({ value: 1000000 }))
  on('command.register', () => ({ value: { command: 'x' } }))
  on('ui.open', () => ({ value: { isPlaced: false } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.list', (_, e) => ({ value: String(e.path).endsWith('sessions') ? [{ name: 'a.json', kind: 'file', size: 1, mtimeMs: 0, isLink: false }] : [] }))
  on('fs.read', () => ({ value: JSON.stringify(registry) }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify(details), stderr: '' } }))
  on('session.id', () => ({ value: 'other' }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await new Promise(r => setTimeout(r, 50))
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'session-panel',
      component: 'AbovePrompt',
      surface,
      props: { hasSurvey: false, isCollapsed: false, bodyColumns: 67 },
    } as any)
    expect(await ui.find({ type: 'Text' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'band-open' })).toBeDefined()
    await ui.press({ key: 'band-open' })
    await ui.unmount()
  }
})

test('the band hides while the pane is placed', async ($, on) => {
  on('clock.every', () => ({ value: { cancel() {} } }))
  on('clock.now', () => ({ value: 1000000 }))
  on('command.register', () => ({ value: { command: 'x' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.list', (_, e) => ({ value: String(e.path).endsWith('sessions') ? [{ name: 'a.json', kind: 'file', size: 1, mtimeMs: 0, isLink: false }] : [] }))
  on('fs.read', () => ({ value: JSON.stringify(registry) }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify(details), stderr: '' } }))
  on('session.id', () => ({ value: 'other' }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await new Promise(r => setTimeout(r, 50))
  const ui = await $.ui.mount({
    plugin: 'session-panel',
    component: 'AbovePrompt',
    surface: 'terminal',
    props: { hasSurvey: false, isCollapsed: false, bodyColumns: 67 },
  } as any)
  expect(await ui.find({ type: 'Text' })).toBeUndefined()
  await ui.unmount()
})

test('the band comes back when the pane closes', async ($, on) => {
  on('clock.every', () => ({ value: { cancel() {} } }))
  on('clock.now', () => ({ value: 1000000 }))
  on('command.register', () => ({ value: { command: 'x' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.list', (_, e) => ({ value: String(e.path).endsWith('sessions') ? [{ name: 'a.json', kind: 'file', size: 1, mtimeMs: 0, isLink: false }] : [] }))
  on('fs.read', () => ({ value: JSON.stringify(registry) }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify(details), stderr: '' } }))
  on('session.id', () => ({ value: 'other' }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await new Promise(r => setTimeout(r, 50))
  const mount = () =>
    $.ui.mount({
      plugin: 'session-panel',
      component: 'AbovePrompt',
      surface: 'terminal',
      props: { hasSurvey: false, isCollapsed: false, bodyColumns: 67 },
    } as any)
  let ui = await mount()
  expect(await ui.find({ type: 'Text' })).toBeUndefined()
  await ui.unmount()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pane.press({ key: 'minimize' })
  await pane.unmount()
  ui = await mount()
  expect(await ui.find({ type: 'Text' })).toBeDefined()
  await ui.unmount()
})
