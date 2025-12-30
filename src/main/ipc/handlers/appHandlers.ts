import { BrowserWindow, ipcMain } from 'electron'
import { channels } from '../../../shared/ipc/channels'
import { appState } from '../../state/appState'
import { hideQuickCaptureWindow, showQuickCaptureWindow } from '../../windows/quickCaptureWindow'

export function registerAppHandlers(): void {
  ipcMain.handle(channels.app.ping, () => ({ ok: true, ts: Date.now() }))

  ipcMain.handle(channels.app.getActiveProjectId, () => appState.getActiveProjectId())

  ipcMain.handle(channels.app.setActiveProjectId, (_event, projectId: number | null) => {
    appState.setActiveProjectId(projectId ?? null)
    return true
  })

  ipcMain.handle(channels.app.showQuickCapture, () => {
    showQuickCaptureWindow()
    return true
  })

  ipcMain.handle(channels.app.hideQuickCapture, () => {
    hideQuickCaptureWindow()
    return true
  })

  appState.onActiveProjectChanged((projectId) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(channels.app.activeProjectChanged, projectId)
    }
  })
}
