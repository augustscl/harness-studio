export const TOOLBAR_HEIGHT = 52

export type EnginePhase =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'stopping'
  | 'failed'

export type StartupStage =
  | 'preparing-runtime'
  | 'starting-harness'
  | 'connecting-interface'

export interface EngineFailure {
  code:
    | 'BIN_NOT_FOUND'
    | 'PORT_UNAVAILABLE'
    | 'PROCESS_EXITED'
    | 'START_TIMEOUT'
    | 'HEALTH_CHECK_FAILED'
    | 'UNKNOWN'
  message: string
  detail?: string
}

export interface EngineState {
  phase: EnginePhase
  stage?: StartupStage
  url?: string
  pid?: number
  startedAt?: string
  failure?: EngineFailure
  logTail: string[]
}

export interface HarnessStudioApi {
  getEngineState(): Promise<EngineState>
  onEngineState(listener: (state: EngineState) => void): () => void
  restartEngine(): Promise<void>
  reloadHarness(): Promise<void>
  retryEngine(): Promise<void>
  openLogs(): Promise<void>
  openDataDirectory(): Promise<void>
}
