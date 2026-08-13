import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { HarnessEngineManager } from '../../src/main/engine-manager'

const managers: HarnessEngineManager[] = []

afterEach(async () => {
  await Promise.all(managers.splice(0).map((manager) => manager.stop()))
})

async function createManager(
  mode = 'ready',
  startupTimeoutMs = 3_000,
  overrides: Partial<ConstructorParameters<typeof HarnessEngineManager>[0]> = {}
) {
  const root = await mkdtemp(resolve(tmpdir(), 'harness-studio-test-'))
  const manager = new HarnessEngineManager({
    command: process.execPath,
    buildArgs: (port) => [
      resolve('tests/fixtures/fake-harness.mjs'),
      '--port',
      String(port)
    ],
    cwd: root,
    dataDirectory: resolve(root, 'data'),
    logPath: resolve(root, 'logs/engine.log'),
    startupTimeoutMs,
    healthPollMs: 30,
    environment: {
      FAKE_HARNESS_MODE: mode
    },
    ...overrides
  })
  managers.push(manager)
  return { manager, root }
}

describe('HarnessEngineManager', () => {
  it('starts a service, reports ready, and records logs', async () => {
    const { manager, root } = await createManager()
    const state = await manager.start()

    expect(state.phase).toBe('ready')
    expect(state.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    expect(state.pid).toBeTypeOf('number')
    await expect(fetch(state.url!)).resolves.toMatchObject({ status: 200 })

    const log = await readFile(resolve(root, 'logs/engine.log'), 'utf8')
    expect(log).toMatch(/dsh web: http:\/\/127\.0\.0\.1:\d+/u)
    expect(log).toContain(`fake harness home: ${resolve(root, 'data')}`)
  })

  it('reports a process that exits before becoming ready', async () => {
    const { manager } = await createManager('exit')

    await expect(manager.start()).rejects.toMatchObject({
      code: 'PROCESS_EXITED'
    })
    expect(manager.getState()).toMatchObject({
      phase: 'failed',
      failure: { code: 'PROCESS_EXITED' }
    })
  })

  it('times out a process that never listens', async () => {
    const { manager } = await createManager('timeout', 180)

    await expect(manager.start()).rejects.toMatchObject({
      code: 'START_TIMEOUT'
    })
    expect(manager.getState().phase).toBe('failed')
  })

  it('restarts with a new process and stops without residue', async () => {
    const { manager } = await createManager()
    const first = await manager.start()
    const firstPid = first.pid
    const firstUrl = first.url

    const restarted = await manager.restart()
    expect(restarted.phase).toBe('ready')
    expect(restarted.pid).not.toBe(firstPid)

    await manager.stop()
    expect(manager.getState().phase).toBe('idle')
    await expect(fetch(firstUrl!)).rejects.toThrow()
  })

  it('deduplicates concurrent start calls', async () => {
    const { manager } = await createManager('delay')
    const [first, second] = await Promise.all([
      manager.start(),
      manager.start()
    ])

    expect(first.pid).toBe(second.pid)
  })

  it('does not report ready without the Harness boot marker', async () => {
    const { manager } = await createManager('no-marker', 220)

    await expect(manager.start()).rejects.toMatchObject({
      code: 'START_TIMEOUT'
    })
  })

  it('moves to failed if the ready process later crashes', async () => {
    const { manager } = await createManager('crash-after-ready')
    await manager.start()
    await new Promise((resolve) => setTimeout(resolve, 300))

    expect(manager.getState()).toMatchObject({
      phase: 'failed',
      failure: { code: 'PROCESS_EXITED' }
    })
  })

  it('can stop while startup is still in progress', async () => {
    const { manager } = await createManager('delay')
    const starting = manager.start()
    await new Promise((resolve) => setTimeout(resolve, 30))
    await manager.stop()

    await expect(starting).rejects.toMatchObject({ code: 'PROCESS_EXITED' })
    expect(manager.getState().phase).toBe('idle')
  })

  it('force stops an engine that ignores SIGTERM', async () => {
    const { manager } = await createManager('ignore-term', 3_000, {
      stopGraceMs: 80
    })
    await manager.start()
    const before = Date.now()
    await manager.stop()

    expect(Date.now() - before).toBeLessThan(1_000)
    expect(manager.getState().phase).toBe('idle')
  })

  it('reports a missing runtime binary', async () => {
    const { manager } = await createManager('ready', 1_000, {
      command: resolve(tmpdir(), 'definitely-missing-harness-runtime')
    })

    await expect(manager.start()).rejects.toMatchObject({
      code: 'BIN_NOT_FOUND'
    })
    expect(manager.getState().phase).toBe('failed')
  })
})
