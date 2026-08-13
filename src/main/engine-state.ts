import type {
  EngineFailure,
  EngineState,
  StartupStage
} from '../shared/contracts'

export type EngineAction =
  | { type: 'START'; stage: StartupStage }
  | { type: 'PROGRESS'; stage: StartupStage; pid?: number }
  | {
      type: 'READY'
      url: string
      pid: number
      startedAt: string
    }
  | { type: 'STOP' }
  | { type: 'STOPPED' }
  | { type: 'FAIL'; failure: EngineFailure }
  | { type: 'LOGS'; lines: string[] }

export function createInitialEngineState(): EngineState {
  return {
    phase: 'idle',
    logTail: []
  }
}

function invalidTransition(state: EngineState, target: string): never {
  throw new Error(`Invalid engine transition from ${state.phase} to ${target}`)
}

export function transitionEngineState(
  state: EngineState,
  action: EngineAction
): EngineState {
  if (action.type === 'LOGS') {
    return { ...state, logTail: [...action.lines] }
  }

  if (action.type === 'START') {
    if (state.phase !== 'idle' && state.phase !== 'failed') {
      return invalidTransition(state, 'starting')
    }
    return {
      phase: 'starting',
      stage: action.stage,
      logTail: state.logTail
    }
  }

  if (action.type === 'PROGRESS') {
    if (state.phase !== 'starting') {
      return invalidTransition(state, 'starting')
    }
    return {
      ...state,
      stage: action.stage,
      ...(action.pid === undefined ? {} : { pid: action.pid })
    }
  }

  if (action.type === 'READY') {
    if (state.phase !== 'starting') {
      return invalidTransition(state, 'ready')
    }
    return {
      phase: 'ready',
      url: action.url,
      pid: action.pid,
      startedAt: action.startedAt,
      logTail: state.logTail
    }
  }

  if (action.type === 'STOP') {
    if (state.phase !== 'starting' && state.phase !== 'ready') {
      return invalidTransition(state, 'stopping')
    }
    return {
      phase: 'stopping',
      ...(state.pid === undefined ? {} : { pid: state.pid }),
      logTail: state.logTail
    }
  }

  if (action.type === 'STOPPED') {
    if (state.phase !== 'stopping') {
      return invalidTransition(state, 'idle')
    }
    return {
      phase: 'idle',
      logTail: state.logTail
    }
  }

  if (action.type === 'FAIL') {
    if (state.phase !== 'starting' && state.phase !== 'ready') {
      return invalidTransition(state, 'failed')
    }
    return {
      phase: 'failed',
      failure: action.failure,
      logTail: state.logTail
    }
  }

  return invalidTransition(state, 'unknown')
}
