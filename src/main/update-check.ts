import { app, dialog, Notification, shell } from 'electron'

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * 更新检查：对比 GitHub Release 最新版与本机版本。
 * - 启动后与每 6 小时自动检查：发现新版弹一次系统通知，点击打开下载页；
 * - 托盘菜单「检查更新…」手动触发：用对话框呈现结果（有新版可选下载）。
 */
export class UpdateChecker {
  #timer: NodeJS.Timeout | undefined
  #notified = false

  start(intervalMs = 6 * 60 * 60 * 1000): void {
    if (this.#timer !== undefined) return
    void this.check(false)
    this.#timer = setInterval(() => void this.check(false), intervalMs)
    this.#timer.unref?.()
  }

  stop(): void {
    if (this.#timer !== undefined) clearInterval(this.#timer)
    this.#timer = undefined
  }

  async check(manual: boolean): Promise<void> {
    let tag = ''
    let url = ''
    try {
      const res = await fetch('https://api.github.com/repos/augustscl/harness-studio/releases/latest', {
        headers: { accept: 'application/vnd.github+json' }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as { tag_name?: string; html_url?: string }
      if (typeof body.tag_name !== 'string' || typeof body.html_url !== 'string') {
        throw new Error('unexpected response')
      }
      tag = body.tag_name
      url = body.html_url
    } catch (error) {
      if (manual) {
        const detail = error instanceof Error ? error.message : String(error)
        void dialog.showMessageBox({
          type: 'error',
          title: '检查更新',
          message: '检查更新失败',
          detail: `${detail}\n\n请检查网络连接后重试。`
        })
      }
      return
    }
    const latest = tag.replace(/^v/, '')
    const current = app.getVersion()
    if (compareVersions(latest, current) > 0) {
      if (manual) {
        const result = await dialog.showMessageBox({
          type: 'info',
          title: '检查更新',
          message: `发现新版本 v${latest}`,
          detail: `当前版本 v${current}。`,
          buttons: ['前往下载', '稍后'],
          defaultId: 0,
          cancelId: 1
        })
        if (result.response === 0) void shell.openExternal(url)
      } else if (!this.#notified) {
        this.#notified = true
        const notification = new Notification({
          title: 'Harness Studio 有新版本',
          body: `v${latest} 已发布（当前 v${current}），点击查看下载`
        })
        notification.on('click', () => void shell.openExternal(url))
        notification.show()
      }
      return
    }
    if (manual) {
      void dialog.showMessageBox({
        type: 'info',
        title: '检查更新',
        message: `已是最新版本 v${current}`
      })
    }
  }
}
