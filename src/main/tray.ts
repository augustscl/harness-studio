import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

import { app, Menu, nativeImage, shell, Tray } from 'electron'

import type { WindowController } from './window-controller'

// 菜单栏模板图标：取自应用图标的「两条编排路径交汇于中心节点」线稿，
// 纯黑 + alpha，随系统深浅色自动适配。32px 为 2x、16px 为 1x。
const TRAY_PNG_32 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAACeUlEQVR4nO2WsWpUQRSGv7t3lQ1YJIUpAkIWY2FgkSjY5BFSBSsFsRBSBFKkSGusfIQ8QdoggeQhrBRFSamSKoKiQsKaxJGJ/wnHcTf37r23zA/DzM785z9nz5mZO/AXOXAb6Gps8OOqSPVm5Osf7RvAIfAdeAOsA5MNBGG2k9KM2j/lK/o8x30gJO0jsKj1NqPDbBallepHn+e4prQsAC+AA0d8UiEI4z51OgfSXpCv6HMoZoEPMjwBlkYoh3GWZBukFTWHIgNaMr6iuQnglQSOgV6JIGytJ5sgjaiFtHP5ij4LUzgNfJbQW2BMxtbaan5uTNwg2+lEszTa6ue0a6PgzgViNrcj7qFsKzk3WDlW3WZ6prlbwCO1OEZrxltNNCohU/Sx33biuy4r9m933e/txLYWMrdBN4FT5+jE7fSgtc2yG20URLGI68CRnPpATjV3JI63KSVchEztDtBxWTHYv+2IY/zGAggS/ObGg4IM4ti4EO2SAbRcrX8l5z7it2tBfVt9bbTU3wP2B3xU0rYvrret5bwFTAFf5OATsAK81nV7rPGK1oK4U0mWRkbmSvTSpXbeBXdTzZzMuzJEG+rcBVfVr7n0Lidrg/jLjr92AX8oMnd9PnRiG5qzrNhR9BeOrW04u6iBNLOidOdu7gHwQyJ7OuN5QTozcTqyCdKIWoa8qCydJO3v9ZCk5IYyzox71Fg5ovZAdIHnusctcnvJdF3kZZEPCWJPPtad7hnmkrPcVx3Ha7yMzWZcWv3Ex9lbIRNpQpH19ZrZAt65lFa90bxtT3vhroJ7DHwtMm7ic5p+uP5bTB1m7l5vEnZkrQRN61/iElTCH/THuivB/QHsAAAAAElFTkSuQmCC'
const TRAY_PNG_16 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABJElEQVR4nJXTTUoDQRQE4G8mxqBLkUQEQd16AW+QY7gSvIA5Q8C1m7gOeIPgFYJbNwFxoYgXiCj4R+NL6ExG1IJmul9VvZ+eGejgHEcofKO0jFmsCG3ydFKwhTX0cY02PipJyoi1Q9MPTyuvkAIjPKCJlcpqBjcK7RxFkDNcYVgzwjC4GZKnKCptfkZbT7jAdnCPOMYWXqNoGmkJjXh2I1m+uhVNLcoQbGKKl1jTiDWqb6isJEitvUe19RinFftucPnY8kO66Tfs4Qan2AnuHmc4wF2mnaORdXSLnmX0git/uotdTHAZ59XsG0h7wU1CO8c+xnjGIMuej1dkFQehHYfXBk5wkIkXLqomnrTJk7wLqPuJftWkrGnOv5jzJMlT1+n/8AVWeTELRjgVfwAAAABJRU5ErkJggg=='

export function installTray(
  controller: WindowController,
  logPath: string,
  options: { checkUpdates?: () => void } = {}
): Tray {
  const isMac = process.platform === 'darwin'
  // 托盘图标必须同时提供 1x 与 2x 表示：否则 Electron 把 32px 位图当成
  // 32pt 使用，macOS 菜单栏被迫缩放，出现模糊/变形/对比度问题。
  const image = nativeImage.createEmpty()
  if (isMac) {
    image.addRepresentation({
      scaleFactor: 2,
      width: 32,
      height: 32,
      buffer: Buffer.from(TRAY_PNG_32, 'base64')
    })
    image.addRepresentation({
      scaleFactor: 1,
      width: 16,
      height: 16,
      buffer: Buffer.from(TRAY_PNG_16, 'base64')
    })
    image.setTemplateImage(true)
  } else {
    image.addRepresentation({
      scaleFactor: 1,
      width: 16,
      height: 16,
      buffer: Buffer.from(TRAY_PNG_16, 'base64')
    })
  }

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
        ...(options.checkUpdates !== undefined
          ? [{
              label: '检查更新…',
              click: () => options.checkUpdates?.()
            }]
          : []),
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
