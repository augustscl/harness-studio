import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  app,
  dialog,
  ipcMain,
  nativeTheme,
  shell
} from 'electron'

import { IPC_CHANNELS } from '../shared/ipc'
import { installApplicationMenu } from './app-menu'
import { HarnessEngineManager } from './engine-manager'
import { assertTrustedIpcSender } from './ipc-policy'
import { resolveLoginShellPath } from './login-shell-path'
import { WindowController } from './window-controller'

app.setName('Harness Studio')
app.setAppUserModelId('com.harnessstudio.desktop')

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) app.quit()

let controller: WindowController | undefined
let engine: HarnessEngineManager | undefined
let allowQuit = false
let quitRequested = false
let logPath = ''
let dataDirectory = ''

function assertShellSender(actualId: number): void {
  assertTrustedIpcSender(actualId, controller?.shellWebContentsId)
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.engineGetState, (event) => {
    assertShellSender(event.sender.id)
    return engine?.getState()
  })
  ipcMain.handle(IPC_CHANNELS.engineRestart, async (event) => {
    assertShellSender(event.sender.id)
    await controller?.restartEngine()
  })
  ipcMain.handle(IPC_CHANNELS.engineRetry, async (event) => {
    assertShellSender(event.sender.id)
    await controller?.retryEngine()
  })
  ipcMain.handle(IPC_CHANNELS.harnessReload, (event) => {
    assertShellSender(event.sender.id)
    controller?.reloadHarness()
  })
  ipcMain.handle(IPC_CHANNELS.logsOpen, async (event) => {
    assertShellSender(event.sender.id)
    if (existsSync(logPath)) shell.showItemInFolder(logPath)
    else await shell.openPath(dirname(logPath))
  })
  ipcMain.handle(IPC_CHANNELS.dataOpen, async (event) => {
    assertShellSender(event.sender.id)
    await shell.openPath(dataDirectory)
  })
}

async function bootApplication(): Promise<void> {
  nativeTheme.themeSource = 'system'

  dataDirectory = join(app.getPath('userData'), 'dsh')
  logPath = join(app.getPath('userData'), 'logs', 'harness-engine.log')
  const workspaceRoot = app.getPath('documents')
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 })
  mkdirSync(dirname(logPath), { recursive: true, mode: 0o700 })

  const appRoot = app.getAppPath()
  const dshEntrypoint = join(
    appRoot,
    'node_modules',
    '@deepseek-ai',
    'dsh',
    'lib',
    'bin.js'
  )
  const bootstrapPath = app.isPackaged
    ? join(process.resourcesPath, 'runtime', 'dsh-bootstrap.cjs')
    : join(appRoot, 'resources', 'dsh-bootstrap.cjs')
  const resolvedPath = await resolveLoginShellPath()

  engine = new HarnessEngineManager({
    command: process.execPath,
    buildArgs: () => [
      '--expose-internals',
      bootstrapPath,
      dshEntrypoint,
      'web',
      '--host',
      '127.0.0.1',
      '--port',
      '0'
    ],
    cwd: workspaceRoot,
    dataDirectory,
    logPath,
    electronRunAsNode: true,
    environment: {
      PATH: resolvedPath,
      DSH_TELEMETRY_DISABLED: '1'
    }
  })

  controller = new WindowController({
    engine,
    preloadPath: join(__dirname, '../preload/index.js'),
    rendererHtmlPath: join(__dirname, '../renderer/index.html'),
    ...(process.env.ELECTRON_RENDERER_URL
      ? { rendererDevUrl: process.env.ELECTRON_RENDERER_URL }
      : {})
  })
  registerIpcHandlers()
  installApplicationMenu(controller)
  await controller.create()
  if (quitRequested) return
  void engine.start().catch(() => undefined)
}

app.on('second-instance', () => controller?.show())

app.on('activate', () => {
  if (controller) controller.show()
})

app.on('before-quit', (event) => {
  if (allowQuit) return
  event.preventDefault()
  if (quitRequested) return
  quitRequested = true
  controller?.setQuitting(true)
  const stopEngine = engine?.stop() ?? Promise.resolve()
  void stopEngine
    .catch(() => undefined)
    .finally(() => {
      allowQuit = true
      app.quit()
    })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

if (hasSingleInstanceLock) {
  void app.whenReady().then(bootApplication).catch((error: unknown) => {
    const detail = error instanceof Error ? error.stack ?? error.message : String(error)
    dialog.showErrorBox(
      'Harness Studio could not start',
      `${detail}\n\nNo model credentials were changed.`
    )
    app.quit()
  })
}
