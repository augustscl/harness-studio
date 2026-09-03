import { Notification } from 'electron'

import type { HarnessEngineManager } from './engine-manager'

interface GoalTask {
  sessionId: string
  title: string
  goal: {
    id: string
    objective: string
    phase: string
    blockedReason?: string | null
  }
}

/**
 * 任务完成系统通知：轮询引擎的 /ux/tasks（studio-ux 宿主端点），
 * 检测 goal 阶段变化（active → complete / blocked）后弹系统通知，
 * 点击通知回到主窗口。首次启动无任务时为空转，零开销。
 */
export class TaskNotifier {
  readonly #engine: HarnessEngineManager
  readonly #showWindow: () => void
  #known = new Map<string, string>()
  #timer: NodeJS.Timeout | undefined
  #cookie: string | undefined
  #cookieForUrl: string | undefined

  constructor(engine: HarnessEngineManager, showWindow: () => void) {
    this.#engine = engine
    this.#showWindow = showWindow
  }

  start(intervalMs = 12000): void {
    if (this.#timer !== undefined) return
    this.#timer = setInterval(() => void this.#poll(), intervalMs)
    this.#timer.unref?.()
  }

  stop(): void {
    if (this.#timer !== undefined) clearInterval(this.#timer)
    this.#timer = undefined
  }

  /**
   * rc.1 起引擎 API 需要 token→Cookie 鉴权：访问一次 ready URL
   * （/?token=…）取 303 下发的 Set-Cookie，后续轮询带上它。
   */
  async #ensureCookie(baseUrl: string): Promise<string | undefined> {
    if (this.#cookie !== undefined && this.#cookieForUrl === baseUrl) {
      return this.#cookie
    }
    try {
      const res = await fetch(baseUrl, { redirect: 'manual' })
      const setCookie = res.headers.get('set-cookie')
      if (setCookie === null) return undefined
      const pair = setCookie.split(';')[0]
      if (pair === undefined || pair === '' || !pair.includes('=')) return undefined
      this.#cookie = pair
      this.#cookieForUrl = baseUrl
      return pair
    } catch {
      return undefined
    }
  }

  async #poll(): Promise<void> {
    const state = this.#engine.getState()
    if (state.phase !== 'ready' || !state.url) return
    // ready URL 形如 http://127.0.0.1:<port>/?token=…，API 基址取 origin+path。
    let base
    try {
      const parsed = new URL(state.url)
      base = `${parsed.origin}${parsed.pathname}`
    } catch {
      return
    }
    let tasks: GoalTask[] = []
    const cookie = await this.#ensureCookie(base)
    try {
      const res = await fetch(`${base}ux/tasks`, {
        headers: cookie !== undefined ? { cookie } : {}
      })
      if (res.status === 401) {
        this.#cookie = undefined
        return
      }
      if (!res.ok) return
      const body = (await res.json()) as { ok?: boolean; tasks?: GoalTask[] }
      if (body.ok !== true || !Array.isArray(body.tasks)) return
      tasks = body.tasks
    } catch {
      return
    }
    const live = new Set<string>()
    for (const task of tasks) {
      const id = task.goal?.id
      if (!id) continue
      live.add(id)
      const prev = this.#known.get(id)
      const next = task.goal.phase
      this.#known.set(id, next)
      if (prev === undefined || prev === next || next === 'paused') continue
      if (next === 'complete') {
        this.#notify('任务完成 ✅', task.goal.objective)
      } else if (next === 'blocked') {
        const reason = task.goal.blockedReason ? `\n原因：${task.goal.blockedReason}` : ''
        this.#notify('任务被阻塞 ⚠️', `${task.goal.objective}${reason}`)
      }
    }
    for (const key of [...this.#known.keys()]) {
      if (!live.has(key)) this.#known.delete(key)
    }
  }

  #notify(title: string, body: string): void {
    if (!Notification.isSupported()) return
    const notification = new Notification({ title, body, silent: false })
    notification.on('click', () => this.#showWindow())
    notification.show()
  }
}
