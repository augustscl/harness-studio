import type { EngineState, HarnessStudioApi } from '../shared/contracts'
import {
  announce,
  createAppShell,
  renderEngineState,
  showToast,
  type PendingAction
} from './components'
import './styles.css'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Renderer root element was not found')

const elements = createAppShell(root)
const fallbackState: EngineState = {
  phase: 'idle',
  logTail: []
}

let engineState = fallbackState
let pendingAction: PendingAction = null
let unsubscribe: (() => void) | undefined

function getApi(): HarnessStudioApi | undefined {
  return window.harnessStudio
}

function update(state: EngineState = engineState): void {
  const phaseChanged = state.phase !== engineState.phase
  engineState = state
  renderEngineState(elements, engineState, pendingAction)

  if (phaseChanged) {
    const announcements: Record<EngineState['phase'], string> = {
      idle: 'Harness 引擎正在待机',
      starting: '正在启动 Harness 引擎',
      ready: 'Harness 已连接，可以开始工作',
      stopping: '正在安全停止 Harness 引擎',
      failed: 'Harness 启动失败，可以重试或查看日志'
    }
    announce(elements, announcements[state.phase])
  }
}

async function runAction(
  action: Exclude<PendingAction, null>,
  operation: (api: HarnessStudioApi) => Promise<void>,
  failureMessage: string
): Promise<void> {
  if (pendingAction) return

  const api = getApi()
  if (!api) {
    showToast(elements, '桌面连接尚未就绪，请重新打开应用。')
    announce(elements, '操作失败：桌面连接尚未就绪')
    return
  }

  pendingAction = action
  renderEngineState(elements, engineState, pendingAction)

  try {
    await operation(api)
  } catch (error) {
    const detail = error instanceof Error && error.message
      ? ` ${error.message}`
      : ''
    showToast(elements, `${failureMessage}${detail}`)
    announce(elements, failureMessage)
  } finally {
    pendingAction = null
    renderEngineState(elements, engineState, pendingAction)
  }
}

elements.reloadButton.addEventListener('click', () => {
  void runAction('reload', (api) => api.reloadHarness(), '无法刷新 Harness 界面。')
})

elements.restartButton.addEventListener('click', () => {
  void runAction('restart', (api) => api.restartEngine(), '无法重新启动 Harness。')
})

elements.retryButton.addEventListener('click', () => {
  void runAction('retry', (api) => api.retryEngine(), 'Harness 重试失败。')
})

for (const button of [elements.logsButton, elements.failureLogsButton]) {
  button.addEventListener('click', () => {
    void runAction('logs', (api) => api.openLogs(), '无法打开日志目录。')
  })
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="data"]')) {
  button.addEventListener('click', () => {
    void runAction('data', (api) => api.openDataDirectory(), '无法打开数据目录。')
  })
}

document.addEventListener('keydown', (event) => {
  const isCommand = event.metaKey || event.ctrlKey
  if (!isCommand || event.altKey || event.key.toLowerCase() !== 'r') return

  event.preventDefault()
  if (event.shiftKey) {
    elements.restartButton.click()
  } else {
    elements.reloadButton.click()
  }
})

async function connect(): Promise<void> {
  const api = getApi()
  if (!api) {
    update({
      phase: 'failed',
      failure: {
        code: 'UNKNOWN',
        message: 'Harness Studio 的桌面桥接没有载入。',
        detail: 'window.harnessStudio is unavailable'
      },
      logTail: []
    })
    return
  }

  unsubscribe = api.onEngineState((state) => {
    update(state)
  })

  try {
    update(await api.getEngineState())
  } catch (error) {
    update({
      phase: 'failed',
      failure: {
        code: 'UNKNOWN',
        message: '无法读取 Harness 引擎状态。',
        detail: error instanceof Error ? error.message : String(error)
      },
      logTail: []
    })
  }
}

window.addEventListener('beforeunload', () => {
  unsubscribe?.()
})

renderEngineState(elements, engineState, pendingAction)
void connect()
