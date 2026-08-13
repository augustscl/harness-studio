export const IPC_CHANNELS = {
  engineGetState: 'studio:engine:get-state',
  engineState: 'studio:engine:state',
  engineRestart: 'studio:engine:restart',
  engineRetry: 'studio:engine:retry',
  harnessReload: 'studio:harness:reload',
  logsOpen: 'studio:logs:open',
  dataOpen: 'studio:data:open'
} as const
