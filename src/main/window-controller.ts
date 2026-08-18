import { join } from 'node:path'

import {
  BrowserWindow,
  WebContentsView,
  shell,
  type Rectangle
} from 'electron'

import type { EngineState } from '../shared/contracts'
import { IPC_CHANNELS } from '../shared/ipc'
import type { HarnessEngineManager } from './engine-manager'
import { classifyNavigation } from './navigation-policy'
import { calculateHarnessBounds } from './window-layout'

export interface WindowControllerOptions {
  engine: HarnessEngineManager
  preloadPath: string
  rendererHtmlPath: string
  rendererDevUrl?: string
}

export class WindowController {
  readonly #options: WindowControllerOptions
  #window: BrowserWindow | undefined
  #harnessView: WebContentsView | undefined
  #harnessUrl: string | undefined
  #viewAttached = false
  #downloadGuardInstalled = false
  #isQuitting = false
  #latestState: EngineState
  #unsubscribeState: (() => void) | undefined

  constructor(options: WindowControllerOptions) {
    this.#options = options
    this.#latestState = options.engine.getState()
  }

  async create(): Promise<BrowserWindow> {
    if (this.#window && !this.#window.isDestroyed()) return this.#window

    const isMac = process.platform === 'darwin'
    const window = new BrowserWindow({
      width: 1220,
      height: 820,
      minWidth: 900,
      minHeight: 620,
      show: false,
      title: 'Harness Studio',
      ...(isMac
        ? {
            titleBarStyle: 'hiddenInset',
            trafficLightPosition: { x: 18, y: 18 },
            vibrancy: 'under-window',
            visualEffectState: 'active'
          }
        : {
            titleBarStyle: 'hidden',
            titleBarOverlay: {
              color: '#111318',
              symbolColor: '#9aa0a6',
              height: 40
            }
          }),
      backgroundColor: '#111318',
      webPreferences: {
        preload: this.#options.preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        spellcheck: true
      }
    })
    this.#window = window

    window.on('resize', () => this.#layoutHarnessView())
    window.on('enter-full-screen', () => this.#layoutHarnessView())
    window.on('leave-full-screen', () => this.#layoutHarnessView())
    window.on('close', (event) => {
      // 关闭窗口 = 收进托盘（系统托盘安装后，两个平台统一行为）。
      if (!this.#isQuitting) {
        event.preventDefault()
        window.hide()
      }
    })
    window.on('closed', () => {
      this.#detachHarnessView()
      if (this.#window === window) this.#window = undefined
    })

    window.webContents.on('did-finish-load', () => {
      this.#sendEngineState(this.#latestState)
    })

    if (this.#options.rendererDevUrl) {
      await window.loadURL(this.#options.rendererDevUrl)
    } else {
      await window.loadFile(this.#options.rendererHtmlPath)
    }

    this.#unsubscribeState?.()
    this.#unsubscribeState = this.#options.engine.onState((state) => {
      this.#latestState = state
      this.#sendEngineState(state)
      if (state.phase === 'ready' && state.url) {
        this.#mountHarnessView(state.url)
      } else {
        this.#detachHarnessView()
      }
    })

    window.once('ready-to-show', () => window.show())
    if (!window.isVisible()) window.show()
    return window
  }

  get shellWebContentsId(): number | undefined {
    return this.#window?.webContents.id
  }

  show(): void {
    const window = this.#window
    if (!window || window.isDestroyed()) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }

  hide(): void {
    const window = this.#window
    if (!window || window.isDestroyed()) return
    window.hide()
  }

  isVisible(): boolean {
    const window = this.#window
    return !!window && !window.isDestroyed() && window.isVisible()
  }

  setQuitting(isQuitting: boolean): void {
    this.#isQuitting = isQuitting
  }

  reloadHarness(): void {
    const contents = this.#harnessView?.webContents
    if (contents && !contents.isDestroyed()) contents.reload()
  }

  async restartEngine(): Promise<void> {
    await this.#options.engine.restart()
  }

  async retryEngine(): Promise<void> {
    await this.#options.engine.start()
  }

  dispose(): void {
    this.#isQuitting = true
    this.#unsubscribeState?.()
    this.#unsubscribeState = undefined
    this.#detachHarnessView()
  }

  #sendEngineState(state: EngineState): void {
    const contents = this.#window?.webContents
    if (!contents || contents.isDestroyed() || contents.isLoadingMainFrame()) return
    contents.send(IPC_CHANNELS.engineState, state)
  }

  #mountHarnessView(url: string): void {
    const window = this.#window
    if (!window || window.isDestroyed()) return
    if (
      this.#harnessView &&
      this.#harnessUrl === url &&
      !this.#harnessView.webContents.isDestroyed()
    ) {
      return
    }

    this.#detachHarnessView()
    const view = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        spellcheck: true,
        partition: 'persist:harness-studio-web'
      }
    })
    view.setBackgroundColor('#111318')
    this.#harnessView = view
    this.#harnessUrl = url
    this.#configureHarnessSecurity(view, url)

    view.webContents.once('did-finish-load', () => {
      if (this.#harnessView !== view || view.webContents.isDestroyed()) return
      const currentWindow = this.#window
      if (!currentWindow || currentWindow.isDestroyed()) return
      currentWindow.contentView.addChildView(view)
      this.#viewAttached = true
      this.#layoutHarnessView()
    })
    view.webContents.on(
      'did-fail-load',
      (_event, errorCode, _description, _validatedUrl, isMainFrame) => {
        if (isMainFrame && errorCode !== -3 && this.#harnessView === view) {
          setTimeout(() => {
            if (!view.webContents.isDestroyed()) view.webContents.reload()
          }, 600)
        }
      }
    )
    void view.webContents.loadURL(url)
  }

  #configureHarnessSecurity(view: WebContentsView, origin: string): void {
    const contents = view.webContents
    contents.setWindowOpenHandler(({ url }) => {
      if (classifyNavigation(url, origin) === 'external') {
        void shell.openExternal(url)
      }
      return { action: 'deny' }
    })
    contents.on('will-navigate', (event, url) => {
      const disposition = classifyNavigation(url, origin)
      if (disposition === 'internal') return
      event.preventDefault()
      if (disposition === 'external') void shell.openExternal(url)
    })
    contents.session.setPermissionRequestHandler(
      (requestingContents, permission, callback) => {
        const sameContents = requestingContents.id === contents.id
        callback(sameContents && permission === 'clipboard-sanitized-write')
      }
    )
    if (!this.#downloadGuardInstalled) {
      contents.session.on('will-download', (event, item) => {
        const activeOrigin = this.#harnessUrl
        if (
          !activeOrigin ||
          classifyNavigation(item.getURL(), activeOrigin) !== 'internal'
        ) {
          event.preventDefault()
        }
      })
      this.#downloadGuardInstalled = true
    }
  }

  #layoutHarnessView(): void {
    const window = this.#window
    const view = this.#harnessView
    if (!window || !view || !this.#viewAttached) return
    const contentBounds = window.getContentBounds()
    view.setBounds(
      calculateHarnessBounds(contentBounds) as Rectangle
    )
  }

  #detachHarnessView(): void {
    const window = this.#window
    const view = this.#harnessView
    if (!view) return
    if (window && !window.isDestroyed() && this.#viewAttached) {
      window.contentView.removeChildView(view)
    }
    this.#viewAttached = false
    this.#harnessView = undefined
    this.#harnessUrl = undefined
    if (!view.webContents.isDestroyed()) view.webContents.close()
  }
}
