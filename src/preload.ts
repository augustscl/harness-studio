import { contextBridge, ipcRenderer } from 'electron'

import type { EngineState, HarnessStudioApi } from './shared/contracts'
import { IPC_CHANNELS } from './shared/ipc'

const api: HarnessStudioApi = {
  getEngineState: () => ipcRenderer.invoke(IPC_CHANNELS.engineGetState),
  onEngineState: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, state: EngineState) => {
      listener(state)
    }
    ipcRenderer.on(IPC_CHANNELS.engineState, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.engineState, handler)
  },
  restartEngine: () => ipcRenderer.invoke(IPC_CHANNELS.engineRestart),
  reloadHarness: () => ipcRenderer.invoke(IPC_CHANNELS.harnessReload),
  retryEngine: () => ipcRenderer.invoke(IPC_CHANNELS.engineRetry),
  openLogs: () => ipcRenderer.invoke(IPC_CHANNELS.logsOpen),
  openDataDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.dataOpen)
}

contextBridge.exposeInMainWorld('harnessStudio', api)
