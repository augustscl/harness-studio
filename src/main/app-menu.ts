import { app, Menu, type MenuItemConstructorOptions } from 'electron'

import type { WindowController } from './window-controller'

export function installApplicationMenu(controller: WindowController): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu:
        process.platform === 'darwin'
          ? [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          : [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload Harness',
          accelerator: 'CmdOrCtrl+R',
          click: () => controller.reloadHarness()
        },
        {
          label: 'Restart Harness Engine',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => void controller.restartEngine()
        },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      role: 'windowMenu'
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
