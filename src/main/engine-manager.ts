import {
  appendFileSync,
  mkdirSync
} from 'node:fs'
import { dirname } from 'node:path'
import {
  spawn,
  type ChildProcess
} from 'node:child_process'

import type {
  EngineFailure,
  EngineState
} from '../shared/contracts'
import {
  createInitialEngineState,
  transitionEngineState
} from './engine-state'
import { LogBuffer } from './log-buffer'
import { findAvailablePort } from './port'

export interface HarnessEngineManagerOptions {
  command: string
  buildArgs: (port: number) => string[]
  cwd: string
  dataDirectory: string
  logPath: string
  startupTimeoutMs?: number
  healthPollMs?: number
  environment?: NodeJS.ProcessEnv
  electronRunAsNode?: boolean
}

export class HarnessEngineError extends Error {
  readonly code: EngineFailure['code']
  readonly detail?: string

  constructor(failure: EngineFailure) {
    super(failure.message)
    this.name = 'HarnessEngineError'
    this.code = failure.code
    if (failure.detail !== undefined) this.detail = failure.detail
  }

  toFailure(): EngineFailure {
    return {
      code: this.code,
      message: this.message,
      ...(this.detail === undefined ? {} : { detail: this.detail })
    }
  }
}

type StateListener = (state: EngineState) => void

const DEFAULT_START_TIMEOUT_MS = 45_000
const DEFAULT_HEALTH_POLL_MS = 180
const STOP_GRACE_MS = 3_000

export class HarnessEngineManager {
  readonly #options: HarnessEngineManagerOptions
  readonly #logs = new LogBuffer()
  readonly #listeners = new Set<StateListener>()
  #state = createInitialEngineState()
  #child: ChildProcess | undefined
  #startPromise: Promise<EngineState> | undefined
  #stopPromise: Promise<void> | undefined
  #expectedExit = false

  constructor(options: HarnessEngineManagerOptions) {
    this.#options = options
  }

  getState(): EngineState {
    return structuredClone(this.#state)
  }

  onState(listener: StateListener): () => void {
    this.#listeners.add(listener)
    listener(this.getState())
    return () => this.#listeners.delete(listener)
  }

  async start(): Promise<EngineState> {
    if (this.#state.phase === 'ready') return this.getState()
    if (this.#startPromise) return this.#startPromise
    if (this.#stopPromise) await this.#stopPromise

    const promise = this.#performStart()
    this.#startPromise = promise
    try {
      return await promise
    } finally {
      if (this.#startPromise === promise) this.#startPromise = undefined
    }
  }

  async restart(): Promise<EngineState> {
    await this.stop()
    return this.start()
  }

  async stop(): Promise<void> {
    if (this.#stopPromise) return this.#stopPromise
    if (!this.#child) return

    const promise = this.#performStop()
    this.#stopPromise = promise
    try {
      await promise
    } finally {
      if (this.#stopPromise === promise) this.#stopPromise = undefined
    }
  }

  async #performStart(): Promise<EngineState> {
    this.#dispatch({ type: 'START', stage: 'preparing-runtime' })
    mkdirSync(this.#options.dataDirectory, { recursive: true })
    mkdirSync(dirname(this.#options.logPath), { recursive: true })
    this.#writeLog(`\n[studio] starting engine at ${new Date().toISOString()}\n`)

    let port: number
    try {
      port = await findAvailablePort()
    } catch (error) {
      throw this.#fail({
        code: 'PORT_UNAVAILABLE',
        message: 'Harness Studio could not reserve a local port.',
        detail: error instanceof Error ? error.message : String(error)
      })
    }

    const url = `http://127.0.0.1:${port}`
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      ...this.#options.environment,
      DSH_HOME: this.#options.dataDirectory
    }
    if (this.#options.electronRunAsNode) {
      environment.ELECTRON_RUN_AS_NODE = '1'
    }

    this.#expectedExit = false
    const child = spawn(this.#options.command, this.#options.buildArgs(port), {
      cwd: this.#options.cwd,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32'
    })
    this.#child = child
    this.#dispatch({
      type: 'PROGRESS',
      stage: 'starting-harness',
      ...(child.pid === undefined ? {} : { pid: child.pid })
    })

    child.stdout?.on('data', (chunk: Buffer) => this.#captureLog(chunk))
    child.stderr?.on('data', (chunk: Buffer) => this.#captureLog(chunk))

    const processEnded = new Promise<HarnessEngineError>((resolve) => {
      child.once('error', (error) => {
        resolve(
          new HarnessEngineError({
            code: 'BIN_NOT_FOUND',
            message: 'The bundled Harness runtime could not be started.',
            detail: error.message
          })
        )
      })
      child.once('exit', (code, signal) => {
        if (!this.#expectedExit) {
          const engineError = new HarnessEngineError({
            code: 'PROCESS_EXITED',
            message: 'Harness stopped before its interface was ready.',
            detail: `exit code ${String(code)}, signal ${String(signal)}`
          })
          if (this.#state.phase === 'starting' || this.#state.phase === 'ready') {
            this.#fail(engineError.toFailure())
          }
          resolve(engineError)
        }
      })
    })

    this.#dispatch({
      type: 'PROGRESS',
      stage: 'connecting-interface',
      ...(child.pid === undefined ? {} : { pid: child.pid })
    })

    try {
      await Promise.race([
        this.#waitUntilHealthy(url),
        processEnded.then((error) => Promise.reject(error))
      ])
    } catch (error) {
      const engineError =
        error instanceof HarnessEngineError
          ? error
          : new HarnessEngineError({
              code: 'HEALTH_CHECK_FAILED',
              message: 'Harness Studio could not connect to the local interface.',
              detail: error instanceof Error ? error.message : String(error)
            })
      if (this.#state.phase === 'starting') this.#fail(engineError.toFailure())
      this.#expectedExit = true
      await this.#terminateChild(child)
      if (this.#child === child) this.#child = undefined
      throw engineError
    }

    if (child.pid === undefined) {
      const error = new HarnessEngineError({
        code: 'PROCESS_EXITED',
        message: 'Harness started without a process identifier.'
      })
      this.#fail(error.toFailure())
      throw error
    }

    this.#dispatch({
      type: 'READY',
      url,
      pid: child.pid,
      startedAt: new Date().toISOString()
    })
    return this.getState()
  }

  async #performStop(): Promise<void> {
    const child = this.#child
    if (!child) return
    this.#expectedExit = true

    if (this.#state.phase === 'starting' || this.#state.phase === 'ready') {
      this.#dispatch({ type: 'STOP' })
    }
    await this.#terminateChild(child)
    if (this.#child === child) this.#child = undefined
    if (this.#state.phase === 'stopping') this.#dispatch({ type: 'STOPPED' })
  }

  async #waitUntilHealthy(url: string): Promise<void> {
    const timeoutMs =
      this.#options.startupTimeoutMs ?? DEFAULT_START_TIMEOUT_MS
    const pollMs = this.#options.healthPollMs ?? DEFAULT_HEALTH_POLL_MS
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(Math.min(1_000, pollMs * 3))
        })
        if (response.ok) return
      } catch {
        // The server normally refuses connections while its plugins load.
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs))
    }

    throw new HarnessEngineError({
      code: 'START_TIMEOUT',
      message: 'Harness took too long to start.',
      detail: `No healthy response from ${url} within ${timeoutMs}ms`
    })
  }

  async #terminateChild(child: ChildProcess): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) return
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))
    this.#signalChild(child, 'SIGTERM')
    const graceful = await Promise.race([
      exited.then(() => true),
      new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), STOP_GRACE_MS)
      )
    ])
    if (!graceful) {
      this.#signalChild(child, 'SIGKILL')
      await exited
    }
  }

  #signalChild(child: ChildProcess, signal: NodeJS.Signals): void {
    try {
      if (process.platform !== 'win32' && child.pid !== undefined) {
        process.kill(-child.pid, signal)
      } else {
        child.kill(signal)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
    }
  }

  #captureLog(chunk: Buffer): void {
    this.#logs.append(chunk)
    this.#writeLog(chunk)
    this.#dispatch({ type: 'LOGS', lines: this.#logs.lines() })
  }

  #writeLog(chunk: string | Buffer): void {
    appendFileSync(this.#options.logPath, chunk)
  }

  #fail(failure: EngineFailure): HarnessEngineError {
    if (this.#state.phase === 'starting' || this.#state.phase === 'ready') {
      this.#dispatch({ type: 'FAIL', failure })
    }
    return new HarnessEngineError(failure)
  }

  #dispatch(action: Parameters<typeof transitionEngineState>[1]): void {
    this.#state = transitionEngineState(this.#state, action)
    const snapshot = this.getState()
    for (const listener of this.#listeners) listener(snapshot)
  }
}
