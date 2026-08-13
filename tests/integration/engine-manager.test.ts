import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { HarnessEngineManager } from '../../src/main/engine-manager'

const managers: HarnessEngineManager[] = []

afterEach(async () => {
  await Promise.all(managers.splice(0).map((manager) => manager.stop()))
})

async function createManager(mode = 'ready', startupTimeoutMs = 3_000) {
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
    }
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
    expect(log).toContain('fake harness ready')
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
})
