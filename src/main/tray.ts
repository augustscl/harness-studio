import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

import { app, Menu, nativeImage, shell, Tray } from 'electron'

import type { WindowController } from './window-controller'

// 16px (Windows) 与 32px (macOS 模板图标, 16pt@2x) 的应用图标剪影,
// 纯黑 + alpha, 随系统深浅色自动适配。
const TRAY_PNG_32 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABjklEQVR4nOWXv0oDQRDGfzdRi5SCqLXY2ChWdja+gZVg7xv4BL6Fz+BbWGlpJ9pZiCIEFExikpOVb2RzOa9IsncBPxh2b7Oz8yezyzcwDgOWSIMMaJUtxsZHmi8Dm8Aq0JZiTjnyirUh8AG8AK+RzQkd07gDXAIPQFcb5yEd4Bo4Ldj7gaflCHgvKI4UxbQyKnHmouhEppTfa0OvQnlaCWcNgC9978l2y7SwBWxrviLv4vqYZwEGGye+bpqsRT+mRCbZd3umycT1SOhAwIbGoTvg168utP29sZpSX0TLs2E0DGsoAyxcBurG7xtjNAz7z0W4WBloDPafb0EWO9B4EeZNO9DVOE8WVAWnargDHXG2UsqcAD3Zwx14FndPDQ/uTSTITOTgE7jRhsCIU8GZ9p2+LeaDhxGF7itFgxn7gmF0Tj/67w+KXNQ0nkspTyShTTuLbWYlvWFoGo6BXWBdBPKvB6vq1mQKJnRbT8AtcAU8FvpQYtTxMo61AGURBCe8Y/KimQXBhnda4byxyL8B6l+0dYQEOjoAAAAASUVORK5CYII='
const TRAY_PNG_16 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA0ElEQVR4nM3TQUoDQRAF0DeTaOI+4EJXHiA5jcfJPnfJHVxnkYWQO8SNiIiQKCYTSrqlGYhDdKEfPkPXdP36M/yqUKFBD1e4SLUSTfF8xbr13i1WeMYWbwW3BTd4wh1u8qARXpL6KZxHcx+XGGCf3LTtt5HvTaK/j10q1Em5S6BOd4bB2s/xOaj+hYD/I9AUQTkV1Z87EDmIaEZEz7Ktjp4cpI+Iejh4xCItUzBq3zGGBu/xHtOC15hhnLbx2L/J27jEFA9tu3E+7/iM2MovHAAbFzVHWZTTwgAAAABJRU5ErkJggg=='

export function installTray(
  controller: WindowController,
  logPath: string
): Tray {
  const isMac = process.platform === 'darwin'
  const image = nativeImage.createFromBuffer(
    Buffer.from(isMac ? TRAY_PNG_32 : TRAY_PNG_16, 'base64')
  )
  if (isMac) image.setTemplateImage(true)

  const tray = new Tray(image)
  tray.setToolTip('Harness Studio')

  const rebuildMenu = (): void => {
    const visible = controller.isVisible()
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: visible ? '隐藏 Harness Studio' : '显示 Harness Studio',
          click: () => {
            if (visible) controller.hide()
            else controller.show()
            rebuildMenu()
          }
        },
        { type: 'separator' },
        {
          label: '重启引擎',
          click: () => {
            controller.show()
            void controller.restartEngine().catch(() => undefined)
          }
        },
        {
          label: '打开日志目录',
          click: () => {
            if (existsSync(logPath)) shell.showItemInFolder(logPath)
            else void shell.openPath(dirname(logPath))
          }
        },
        { type: 'separator' },
        {
          label: '退出 Harness Studio',
          click: () => {
            controller.setQuitting(true)
            app.quit()
          }
        }
      ])
    )
  }

  rebuildMenu()
  tray.on('click', () => {
    if (process.platform === 'darwin') return // macOS 上左键由菜单接管
    if (controller.isVisible()) controller.hide()
    else controller.show()
  })
  tray.on('double-click', () => controller.show())

  return tray
}
