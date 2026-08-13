import type {
  EngineFailure,
  EnginePhase,
  EngineState,
  StartupStage
} from '../shared/contracts'

export type PendingAction =
  | 'reload'
  | 'restart'
  | 'retry'
  | 'logs'
  | 'data'
  | null

export interface AppElements {
  shell: HTMLElement
  status: HTMLElement
  statusText: HTMLElement
  statusDetail: HTMLElement
  liveRegion: HTMLElement
  toast: HTMLElement
  launchView: HTMLElement
  launchEyebrow: HTMLElement
  launchTitle: HTMLElement
  launchDescription: HTMLElement
  progressSegments: HTMLElement[]
  readyView: HTMLElement
  stoppingView: HTMLElement
  failedView: HTMLElement
  failureCode: HTMLElement
  failureMessage: HTMLElement
  failureHint: HTMLElement
  failureDetails: HTMLDetailsElement
  failureDetail: HTMLElement
  logTail: HTMLElement
  reloadButton: HTMLButtonElement
  restartButton: HTMLButtonElement
  retryButton: HTMLButtonElement
  logsButton: HTMLButtonElement
  failureLogsButton: HTMLButtonElement
  dataButton: HTMLButtonElement
}

interface PhaseCopy {
  label: string
  detail: string
}

interface StageCopy {
  eyebrow: string
  title: string
  description: string
}

interface FailureCopy {
  title: string
  hint: string
}

const stageOrder: StartupStage[] = [
  'preparing-runtime',
  'starting-harness',
  'connecting-interface'
]

const stageCopy: Record<StartupStage, StageCopy> = {
  'preparing-runtime': {
    eyebrow: '正在准备本地运行时',
    title: '唤醒你的工作空间',
    description: '正在确认 Harness 组件和本地数据目录。'
  },
  'starting-harness': {
    eyebrow: '正在启动 Harness',
    title: '引擎即将就绪',
    description: '正在启动安全的本地服务，这通常只需要几秒钟。'
  },
  'connecting-interface': {
    eyebrow: '正在连接界面',
    title: '最后一步',
    description: '本地引擎已响应，正在装载完整工作界面。'
  }
}

const failureCopy: Record<EngineFailure['code'], FailureCopy> = {
  BIN_NOT_FOUND: {
    title: '没有找到 Harness 运行时',
    hint: '应用组件可能不完整。你可以先重试；如果问题持续，请重新安装应用。'
  },
  PORT_UNAVAILABLE: {
    title: '无法分配本地连接',
    hint: '可用端口暂时被占用。稍等片刻后重试通常就能恢复。'
  },
  PROCESS_EXITED: {
    title: 'Harness 意外退出',
    hint: '打开日志可以查看最近的运行信息，然后再次启动。'
  },
  START_TIMEOUT: {
    title: '启动等待时间过长',
    hint: '首次启动可能需要更久。请重试，或查看日志确认运行状态。'
  },
  HEALTH_CHECK_FAILED: {
    title: '本地引擎没有响应',
    hint: 'Harness 已启动，但界面暂时无法连接。重试会重新建立连接。'
  },
  UNKNOWN: {
    title: 'Harness 暂时无法启动',
    hint: '你可以立即重试；如果问题持续，打开日志会有更多线索。'
  }
}

const icon = (name: 'brand' | 'reload' | 'restart' | 'logs' | 'folder' | 'arrow') => {
  const icons = {
    brand: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.75 5.25v13.5M17.25 5.25v13.5M7 12h10" />
        <path class="icon-accent" d="M4.75 5.25h4M15.25 18.75h4" />
      </svg>`,
    reload: `
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M15.45 7.1A6 6 0 1 0 16 11.5" />
        <path d="M12.2 6.9h3.55V3.35" />
      </svg>`,
    restart: `
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4.1 8.15A6.15 6.15 0 1 1 4.5 13" />
        <path d="M7.4 8.15H3.85V4.6" />
      </svg>`,
    logs: `
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4.25 4.25h11.5v11.5H4.25z" />
        <path d="m6.75 8 1.6 1.5-1.6 1.5M10.25 11h3" />
      </svg>`,
    folder: `
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M2.75 6.25h5l1.35 1.5h8.15v7.5h-14.5z" />
        <path d="M2.75 6.25v-1.5h5l1.35 1.5" />
      </svg>`,
    arrow: `
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5.75 10h8.5M11 6.75 14.25 10 11 13.25" />
      </svg>`
  }

  return icons[name]
}

export function createAppShell(root: HTMLElement): AppElements {
  root.innerHTML = `
    <div class="app-shell" data-testid="app-shell">
      <header class="toolbar" data-testid="toolbar">
        <div class="toolbar__leading">
          <span class="traffic-light-space" aria-hidden="true"></span>
          <div class="wordmark" aria-label="Harness Studio">
            <span class="wordmark__mark">${icon('brand')}</span>
            <span class="wordmark__label">Harness Studio</span>
          </div>
        </div>

        <div class="engine-status" role="status" aria-live="polite" aria-atomic="true">
          <span class="engine-status__dot" aria-hidden="true"></span>
          <span class="engine-status__label">正在启动</span>
          <span class="engine-status__divider" aria-hidden="true"></span>
          <span class="engine-status__detail">准备运行时</span>
        </div>

        <nav class="toolbar__actions" aria-label="Harness 控制">
          <button class="icon-button" type="button" data-action="reload" aria-label="刷新 Harness 界面" title="刷新界面  ⌘R">
            ${icon('reload')}
          </button>
          <button class="icon-button" type="button" data-action="restart" aria-label="重新启动 Harness 引擎" title="重启引擎  ⇧⌘R">
            ${icon('restart')}
          </button>
          <span class="toolbar__separator" aria-hidden="true"></span>
          <button class="icon-button" type="button" data-action="logs" aria-label="打开 Harness 日志" title="打开日志">
            ${icon('logs')}
          </button>
          <button class="icon-button" type="button" data-action="data" aria-label="打开 Harness 数据目录" title="打开数据目录">
            ${icon('folder')}
          </button>
        </nav>
      </header>

      <main class="workspace" id="main-content">
        <section class="state-view launch-view" data-view="launch" aria-labelledby="launch-title">
          <div class="ambient ambient--one" aria-hidden="true"></div>
          <div class="ambient ambient--two" aria-hidden="true"></div>
          <div class="state-card state-card--launch">
            <div class="engine-orbit" aria-hidden="true">
              <span class="engine-orbit__ring engine-orbit__ring--outer"></span>
              <span class="engine-orbit__ring engine-orbit__ring--inner"></span>
              <span class="engine-orbit__core">${icon('brand')}</span>
              <span class="engine-orbit__satellite"></span>
            </div>
            <p class="eyebrow" data-role="launch-eyebrow">正在准备本地运行时</p>
            <h1 id="launch-title" data-role="launch-title">唤醒你的工作空间</h1>
            <p class="state-description" data-role="launch-description">
              正在确认 Harness 组件和本地数据目录。
            </p>
            <div class="stage-progress" role="progressbar" aria-label="Harness 启动进度" aria-valuemin="1" aria-valuemax="3" aria-valuenow="1">
              <span class="stage-progress__segment" data-stage="preparing-runtime"></span>
              <span class="stage-progress__segment" data-stage="starting-harness"></span>
              <span class="stage-progress__segment" data-stage="connecting-interface"></span>
            </div>
            <p class="privacy-note">
              <span class="privacy-note__indicator" aria-hidden="true"></span>
              本地服务 · Harness 遥测已关闭
            </p>
          </div>
        </section>

        <section class="state-view ready-view" data-view="ready" aria-labelledby="ready-title" hidden>
          <div class="ready-view__content">
            <span class="ready-check" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="m6.5 12.25 3.4 3.4 7.6-8" /></svg>
            </span>
            <p class="eyebrow">本地引擎已连接</p>
            <h1 id="ready-title">工作空间准备好了</h1>
            <p class="state-description">正在显示 Harness 界面…</p>
          </div>
        </section>

        <section class="state-view stopping-view" data-view="stopping" aria-labelledby="stopping-title" hidden>
          <div class="state-card state-card--compact">
            <div class="closing-indicator" aria-hidden="true">
              <span></span><span></span><span></span>
            </div>
            <p class="eyebrow">正在安全关闭</p>
            <h1 id="stopping-title">保存当前工作状态</h1>
            <p class="state-description">请稍候，Harness 正在结束本地进程。</p>
          </div>
        </section>

        <section class="state-view failed-view" data-view="failed" aria-labelledby="failure-title" hidden>
          <div class="ambient ambient--failure" aria-hidden="true"></div>
          <article class="failure-panel">
            <div class="failure-panel__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 7.5v5.25M12 16.4v.1" /></svg>
            </div>
            <div class="failure-panel__copy">
              <p class="eyebrow"><span data-role="failure-code">启动未完成</span></p>
              <h1 id="failure-title" data-role="failure-message">Harness 暂时无法启动</h1>
              <p class="state-description" data-role="failure-hint">
                你可以立即重试；如果问题持续，打开日志会有更多线索。
              </p>
            </div>

            <div class="failure-panel__actions">
              <button class="button button--primary" type="button" data-action="retry">
                <span>再次尝试</span>${icon('arrow')}
              </button>
              <button class="button button--secondary" type="button" data-action="failure-logs">
                ${icon('logs')}<span>查看日志</span>
              </button>
            </div>

            <details class="technical-details" data-role="failure-details">
              <summary>技术详情</summary>
              <div class="technical-details__body">
                <p data-role="failure-detail"></p>
                <pre data-role="log-tail" aria-label="最近的 Harness 日志"></pre>
              </div>
            </details>
          </article>
          <button class="data-link" type="button" data-action="data">
            ${icon('folder')}<span>打开应用数据目录</span>
          </button>
        </section>
      </main>

      <div class="toast" role="status" aria-live="polite" aria-atomic="true" hidden></div>
      <div class="visually-hidden" data-role="live-region" aria-live="assertive" aria-atomic="true"></div>
    </div>
  `

  const query = <T extends Element>(selector: string): T => {
    const element = root.querySelector<T>(selector)
    if (!element) throw new Error(`Renderer element is missing: ${selector}`)
    return element
  }

  return {
    shell: query<HTMLElement>('.app-shell'),
    status: query<HTMLElement>('.engine-status'),
    statusText: query<HTMLElement>('.engine-status__label'),
    statusDetail: query<HTMLElement>('.engine-status__detail'),
    liveRegion: query<HTMLElement>('[data-role="live-region"]'),
    toast: query<HTMLElement>('.toast'),
    launchView: query<HTMLElement>('[data-view="launch"]'),
    launchEyebrow: query<HTMLElement>('[data-role="launch-eyebrow"]'),
    launchTitle: query<HTMLElement>('[data-role="launch-title"]'),
    launchDescription: query<HTMLElement>('[data-role="launch-description"]'),
    progressSegments: Array.from(root.querySelectorAll<HTMLElement>('.stage-progress__segment')),
    readyView: query<HTMLElement>('[data-view="ready"]'),
    stoppingView: query<HTMLElement>('[data-view="stopping"]'),
    failedView: query<HTMLElement>('[data-view="failed"]'),
    failureCode: query<HTMLElement>('[data-role="failure-code"]'),
    failureMessage: query<HTMLElement>('[data-role="failure-message"]'),
    failureHint: query<HTMLElement>('[data-role="failure-hint"]'),
    failureDetails: query<HTMLDetailsElement>('[data-role="failure-details"]'),
    failureDetail: query<HTMLElement>('[data-role="failure-detail"]'),
    logTail: query<HTMLElement>('[data-role="log-tail"]'),
    reloadButton: query<HTMLButtonElement>('[data-action="reload"]'),
    restartButton: query<HTMLButtonElement>('[data-action="restart"]'),
    retryButton: query<HTMLButtonElement>('[data-action="retry"]'),
    logsButton: query<HTMLButtonElement>('[data-action="logs"]'),
    failureLogsButton: query<HTMLButtonElement>('[data-action="failure-logs"]'),
    dataButton: query<HTMLButtonElement>('.toolbar [data-action="data"]')
  }
}

function phaseCopy(state: EngineState): PhaseCopy {
  switch (state.phase) {
    case 'idle':
      return { label: '待机', detail: '等待本地引擎' }
    case 'starting':
      switch (state.stage) {
        case 'starting-harness':
          return { label: '正在启动', detail: '启动 Harness' }
        case 'connecting-interface':
          return { label: '正在连接', detail: '装载界面' }
        case 'preparing-runtime':
        default:
          return { label: '正在启动', detail: '准备运行时' }
      }
    case 'ready':
      return { label: '已连接', detail: '本地引擎' }
    case 'stopping':
      return { label: '正在停止', detail: '安全结束进程' }
    case 'failed':
      return { label: '需要处理', detail: '启动未完成' }
  }
}

function setView(elements: AppElements, phase: EnginePhase): void {
  const activeView = phase === 'ready'
    ? elements.readyView
    : phase === 'failed'
      ? elements.failedView
      : phase === 'stopping'
        ? elements.stoppingView
        : elements.launchView

  for (const view of [
    elements.launchView,
    elements.readyView,
    elements.stoppingView,
    elements.failedView
  ]) {
    view.hidden = view !== activeView
  }
}

function renderLaunch(elements: AppElements, state: EngineState): void {
  const fallback: StageCopy = state.phase === 'idle'
    ? {
        eyebrow: '本地工作空间',
        title: 'Harness Studio',
        description: '等待本地引擎启动。'
      }
    : stageCopy[state.stage ?? 'preparing-runtime']

  elements.launchEyebrow.textContent = fallback.eyebrow
  elements.launchTitle.textContent = fallback.title
  elements.launchDescription.textContent = fallback.description

  const stageIndex = state.phase === 'idle'
    ? -1
    : stageOrder.indexOf(state.stage ?? 'preparing-runtime')
  const progress = elements.shell.querySelector<HTMLElement>('.stage-progress')
  progress?.setAttribute('aria-valuenow', String(Math.max(1, stageIndex + 1)))

  elements.progressSegments.forEach((segment, index) => {
    segment.classList.toggle('is-complete', index < stageIndex)
    segment.classList.toggle('is-current', index === stageIndex)
  })
}

function renderFailure(elements: AppElements, state: EngineState): void {
  const failure: EngineFailure = state.failure ?? {
    code: 'UNKNOWN',
    message: '本地引擎没有提供更多信息。'
  }
  const copy = failureCopy[failure.code]
  const diagnostic = failure.detail?.trim() || failure.message.trim()
  const logs = state.logTail.filter(Boolean).slice(-12).join('\n')

  elements.failureCode.textContent = failure.code.replaceAll('_', ' ')
  elements.failureMessage.textContent = copy.title
  elements.failureHint.textContent = copy.hint
  elements.failureDetail.textContent = diagnostic
  elements.logTail.textContent = logs
  elements.logTail.hidden = logs.length === 0
  elements.failureDetails.hidden = diagnostic.length === 0 && logs.length === 0
}

export function renderEngineState(
  elements: AppElements,
  state: EngineState,
  pendingAction: PendingAction
): void {
  const copy = phaseCopy(state)
  const isTransitioning = state.phase === 'starting' || state.phase === 'stopping'
  const hasPendingAction = pendingAction !== null

  document.documentElement.dataset.phase = state.phase
  document.title = state.phase === 'ready'
    ? 'Harness Studio'
    : `Harness Studio — ${copy.label}`
  elements.shell.dataset.phase = state.phase
  elements.shell.setAttribute('aria-busy', String(isTransitioning || hasPendingAction))
  elements.status.dataset.phase = state.phase
  elements.statusText.textContent = copy.label
  elements.statusDetail.textContent = copy.detail
  setView(elements, state.phase)

  if (state.phase === 'idle' || state.phase === 'starting') {
    renderLaunch(elements, state)
  }
  if (state.phase === 'failed') {
    renderFailure(elements, state)
  }

  elements.reloadButton.disabled = state.phase !== 'ready' || hasPendingAction
  elements.restartButton.disabled = isTransitioning || hasPendingAction
  elements.retryButton.disabled = state.phase !== 'failed' || hasPendingAction
  elements.logsButton.disabled = pendingAction === 'logs'
  elements.failureLogsButton.disabled = pendingAction === 'logs'
  elements.dataButton.disabled = pendingAction === 'data'

  elements.reloadButton.classList.toggle('is-pending', pendingAction === 'reload')
  elements.restartButton.classList.toggle('is-pending', pendingAction === 'restart')
  elements.retryButton.classList.toggle('is-pending', pendingAction === 'retry')

  const retryLabel = elements.retryButton.querySelector('span')
  if (retryLabel) {
    retryLabel.textContent = pendingAction === 'retry' ? '正在重试' : '再次尝试'
  }
}

export function announce(elements: AppElements, message: string): void {
  elements.liveRegion.textContent = ''
  window.setTimeout(() => {
    elements.liveRegion.textContent = message
  }, 20)
}

export function showToast(elements: AppElements, message: string): void {
  elements.toast.textContent = message
  elements.toast.hidden = false
  elements.toast.classList.remove('is-visible')
  window.requestAnimationFrame(() => {
    elements.toast.classList.add('is-visible')
  })

  window.setTimeout(() => {
    elements.toast.classList.remove('is-visible')
    window.setTimeout(() => {
      elements.toast.hidden = true
    }, 180)
  }, 3600)
}
