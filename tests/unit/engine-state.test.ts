import { describe, expect, it } from 'vitest'

import {
  createInitialEngineState,
  transitionEngineState
} from '../../src/main/engine-state'

describe('engine state transitions', () => {
  it('walks through a successful startup', () => {
    const idle = createInitialEngineState()
    const preparing = transitionEngineState(idle, {
      type: 'START',
      stage: 'preparing-runtime'
    })
    const starting = transitionEngineState(preparing, {
      type: 'PROGRESS',
      stage: 'starting-harness'
    })
    const ready = transitionEngineState(starting, {
      type: 'READY',
      url: 'http://127.0.0.1:39876',
      pid: 42,
      startedAt: '2026-08-13T00:00:00.000Z'
    })

    expect(idle.phase).toBe('idle')
    expect(starting).toMatchObject({
      phase: 'starting',
      stage: 'starting-harness'
    })
    expect(ready).toMatchObject({
      phase: 'ready',
      url: 'http://127.0.0.1:39876',
      pid: 42
    })
  })

  it('preserves the log tail while reporting failure', () => {
    const starting = transitionEngineState(createInitialEngineState(), {
      type: 'START',
      stage: 'preparing-runtime'
    })
    const withLogs = transitionEngineState(starting, {
      type: 'LOGS',
      lines: ['first', 'last']
    })
    const failed = transitionEngineState(withLogs, {
      type: 'FAIL',
      failure: {
        code: 'START_TIMEOUT',
        message: 'Harness took too long to start.'
      }
    })

    expect(failed.phase).toBe('failed')
    expect(failed.logTail).toEqual(['first', 'last'])
    expect(failed.failure?.code).toBe('START_TIMEOUT')
  })

  it('rejects impossible transitions', () => {
    expect(() =>
      transitionEngineState(createInitialEngineState(), {
        type: 'READY',
        url: 'http://127.0.0.1:3000',
        pid: 42,
        startedAt: '2026-08-13T00:00:00.000Z'
      })
    ).toThrow(/idle.*ready/i)
  })
})
