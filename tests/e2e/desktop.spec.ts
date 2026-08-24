import { mkdir, writeFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { resolve } from 'node:path'

import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from 'playwright/test'

const projectRoot = resolve(__dirname, '../..')
const visualOutputDirectory = resolve(projectRoot, 'test-results/visual')
const allowedEnvironmentNames = [
  'HOME',
  'USER',
  'LOGNAME',
  'PATH',
  'SHELL',
  'TMPDIR',
  'LANG',
  'LC_ALL'
] as const

type SafeEngineState = {
  phase: string
  url: string | null
  pid: number | null
}

function environmentWithoutSecrets(): Record<string, string> {
  const environment: Record<string, string> = {}

  for (const name of allowedEnvironmentNames) {
    const value = process.env[name]
    if (typeof value === 'string') environment[name] = value
  }

  return environment
}

async function readSafeEngineState(page: Page): Promise<SafeEngineState> {
  return page.evaluate(async () => {
    const bridge = (
      window as typeof window & {
        harnessStudio?: {
          getEngineState(): Promise<{
            phase: string
            url?: string
            pid?: number
          }>
        }
      }
    ).harnessStudio

    if (!bridge) {
      return { phase: 'bridge-missing', url: null, pid: null }
    }

    const state = await bridge.getEngineState()
    return {
      phase: state.phase,
      url: state.url ?? null,
      pid: state.pid ?? null
    }
  })
}

async function findPage(
  electronApp: ElectronApplication,
  predicate: (page: Page) => boolean,
  timeout = 20_000
): Promise<Page> {
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const page = electronApp.windows().find(predicate)
    if (page) return page
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }

  throw new Error('Timed out waiting for the Harness WebContentsView page')
}

async function isPortListening(endpoint: string): Promise<boolean> {
  const { hostname, port } = new URL(endpoint)

  return new Promise((resolvePromise) => {
    const socket = createConnection({ host: hostname, port: Number(port) })
    let settled = false

    const finish = (listening: boolean): void => {
      if (settled) return
      settled = true
      socket.destroy()
      resolvePromise(listening)
    }

    socket.setTimeout(500)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

function isProcessGroupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ESRCH') return false
    if (code === 'EPERM') return true
    throw error
  }
}

async function captureCompositedWindow(
  electronApp: ElectronApplication,
  outputPath: string
): Promise<{ ok: boolean; reason?: string; pngBase64?: string }> {
  const result = await electronApp.evaluate(async ({ BrowserWindow, desktopCapturer }) => {
    try {
      const window = BrowserWindow.getAllWindows()[0]
      if (!window || window.isDestroyed()) return { ok: false, reason: 'no-window' }

      const bounds = window.getBounds()
      const sourceId = window.getMediaSourceId()
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: bounds.width, height: bounds.height },
        fetchWindowIcons: false
      })
      const source = sources.find((candidate) => candidate.id === sourceId)
      if (!source) {
        return {
          ok: false,
          reason: `source-not-found (sources=${sources.length}, own=${sourceId.slice(0, 8)}…)`
        }
      }
      if (source.thumbnail.isEmpty()) return { ok: false, reason: 'empty-thumbnail' }

      return { ok: true, pngBase64: source.thumbnail.toPNG().toString('base64') }
    } catch {
      // desktopCapturer needs the macOS screen-recording permission, which a
      // dev/CI Electron may lack. Fall back to a permission-free pixel capture
      // of the shell page so the render pipeline is still verified.
      const window = BrowserWindow.getAllWindows()[0]
      if (!window || window.isDestroyed()) return { ok: false, reason: 'no-window' }
      const image = await window.webContents.capturePage()
      if (image.isEmpty()) return { ok: false, reason: 'empty-capture-page' }
      return { ok: true, pngBase64: image.toPNG().toString('base64') }
    }
  })

  if (!result.ok || result.pngBase64 === undefined) return result
  await writeFile(outputPath, Buffer.from(result.pngBase64, 'base64'))
  return { ok: true }
}

test('launches the real Harness engine, renders the desktop shell, and shuts down cleanly', async ({}, testInfo) => {
  test.skip(process.platform !== 'darwin', 'The distributable MVP currently targets macOS')

  const userDataDirectory = testInfo.outputPath('user-data')
  await mkdir(userDataDirectory, { recursive: true })
  await mkdir(visualOutputDirectory, { recursive: true })

  let electronApp: ElectronApplication | undefined
  let appClosed = false

  try {
    const app = await electron.launch({
      args: [projectRoot, `--user-data-dir=${userDataDirectory}`],
      cwd: projectRoot,
      env: environmentWithoutSecrets()
    })
    electronApp = app
    app.once('close', () => {
      appClosed = true
    })

    const shellPage = await app.firstWindow()
    await expect(shellPage).toHaveTitle(/^Harness Studio(?: — .+)?$/)

    const actualUserDataDirectory = await app.evaluate(({ app }) => app.getPath('userData'))
    expect(actualUserDataDirectory).toBe(userDataDirectory)

    await expect
      .poll(async () => (await readSafeEngineState(shellPage)).phase, {
        timeout: 75_000,
        message: 'the bundled dsh engine should reach ready without inherited API credentials'
      })
      .toBe('ready')

    const engineState = await readSafeEngineState(shellPage)
    expect(engineState.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    expect(engineState.pid).toBeGreaterThan(0)
    const engineUrl = engineState.url as string
    const enginePid = engineState.pid as number
    const engineOrigin = new URL(engineUrl).origin

    const toolbar = shellPage.getByTestId('toolbar')
    await expect(toolbar).toBeVisible()
    const toolbarBox = await toolbar.boundingBox()
    expect(toolbarBox).not.toBeNull()
    expect(toolbarBox?.y).toBe(0)
    expect(toolbarBox?.height).toBe(52)
    await expect(shellPage.locator('.engine-status')).toHaveAttribute('data-phase', 'ready')
    await expect(shellPage.locator('.engine-status')).toContainText('已连接')

    const harnessPage = await findPage(app, (page) => {
      try {
        return new URL(page.url()).origin === engineOrigin
      } catch {
        return false
      }
    })
    await harnessPage.waitForLoadState('domcontentloaded')
    await expect(harnessPage).toHaveTitle('DeepSeek Harness')

    const readWebContentsTargets = () =>
      app.evaluate(({ BrowserWindow, webContents }) => {
        const window = BrowserWindow.getAllWindows()[0]
        if (!window) throw new Error('Harness Studio BrowserWindow is missing')
        const viewTargetIds = window.contentView.children
          .filter((child): child is Electron.WebContentsView => 'webContents' in child)
          .map((child) => child.webContents.id)

        return webContents
          .getAllWebContents()
          .filter((contents) => !contents.isDestroyed())
          .map((contents) => ({
            id: contents.id,
            type: contents.getType(),
            url: contents.getURL(),
            title: contents.getTitle(),
            isWebContentsView: viewTargetIds.includes(contents.id)
          }))
      })
    await expect
      .poll(async () => {
        const targets = await readWebContentsTargets()
        return targets.find((target) => target.url.startsWith(engineOrigin))?.isWebContentsView
      }, {
        message: 'the official Harness target should be mounted as a WebContentsView'
      })
      .toBe(true)
    const webContentsTargets = await readWebContentsTargets()
    const harnessTarget = webContentsTargets.find((target) => target.url.startsWith(engineOrigin))
    expect(harnessTarget).toMatchObject({
      title: 'DeepSeek Harness',
      isWebContentsView: true
    })

    await expect(harnessPage.locator('body')).toContainText('DeepSeek Harness')
    await expect(harnessPage.locator('body')).toContainText(/选择工作区|工作区|Choose workspace/i)

    const bootMarker = await harnessPage.evaluate(() => {
      const marker = (window as typeof window & { __DSH_BOOT__?: unknown }).__DSH_BOOT__
      if (!marker || typeof marker !== 'object') return null
      return Object.keys(marker)
    })
    expect(bootMarker).toEqual(expect.arrayContaining(['rev', 'entries']))

    const readLayout = () =>
      app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0]
        if (!window) throw new Error('Harness Studio BrowserWindow is missing')
        return {
          contentBounds: window.getContentBounds(),
          childBounds: window.contentView.children.map((child) => child.getBounds())
        }
      })
    await expect
      .poll(async () => (await readLayout()).childBounds.some((bounds) => bounds.y === 52), {
        message: 'the loaded Harness WebContentsView should be attached below the toolbar'
      })
      .toBe(true)
    const layout = await readLayout()
    const harnessViewBounds = layout.childBounds.find((bounds) => bounds.y === 52)
    expect(harnessViewBounds).toEqual({
      x: 0,
      y: 52,
      width: layout.contentBounds.width,
      height: layout.contentBounds.height - 52
    })

    await shellPage.screenshot({
      path: resolve(visualOutputDirectory, 'harness-studio-shell.png')
    })
    await harnessPage.screenshot({
      path: resolve(visualOutputDirectory, 'harness-studio-harness-view.png')
    })
    // The compositor needs a moment after the view mounts; poll instead of
    // asserting once so a slow first paint is not a spurious failure.
    await expect
      .poll(
        async () => {
          const result = await captureCompositedWindow(
            app,
            resolve(visualOutputDirectory, 'harness-studio-window.png')
          )
          return result
        },
        {
          timeout: 20_000,
          message: 'the composited application window screenshot should be captured'
        }
      )
      .toEqual({ ok: true })

    await expect.poll(() => isPortListening(engineUrl)).toBe(true)
    expect(isProcessGroupAlive(enginePid)).toBe(true)

    const closePromise = app.waitForEvent('close')
    await app.evaluate(({ app }) => app.quit())
    await closePromise

    await expect
      .poll(() => isPortListening(engineUrl), {
        timeout: 15_000,
        message: 'the loopback dsh listener should close after app.quit()'
      })
      .toBe(false)
    await expect
      .poll(() => isProcessGroupAlive(enginePid), {
        timeout: 15_000,
        message: 'the detached dsh process group should be reaped after app.quit()'
      })
      .toBe(false)
  } finally {
    if (electronApp && !appClosed) {
      try {
        const closePromise = electronApp.waitForEvent('close', { timeout: 10_000 })
        await electronApp.evaluate(({ app }) => app.quit())
        await closePromise
      } catch {
        await electronApp.close().catch(() => undefined)
      }
    }
  }
})
