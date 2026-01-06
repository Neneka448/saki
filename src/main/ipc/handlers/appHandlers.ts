import { BrowserWindow, dialog, ipcMain } from 'electron'
import * as fs from 'fs'
import { channels } from '../../../shared/ipc/channels'
import { appState } from '../../state/appState'
import { getAppSettings } from '../../state/appSettings'
import {
  hideQuickCaptureWindow,
  showQuickCaptureWindow,
  setQuickCapturePinned,
  isQuickCapturePinned
} from '../../windows/quickCaptureWindow'
import {
  getQuickCaptureShortcutInfo,
  resetQuickCaptureShortcut,
  setQuickCaptureShortcut,
} from '../../services/shortcutManager'
import { showLive2DWindow } from '../../windows/live2dWindow'

export function registerAppHandlers(): void {
  ipcMain.handle(channels.app.ping, () => ({ ok: true, ts: Date.now() }))

  ipcMain.handle(channels.app.getActiveProjectId, () => appState.getActiveProjectId())

  ipcMain.handle(channels.app.setActiveProjectId, (_event, projectId: number | null) => {
    appState.setActiveProjectId(projectId ?? null)
    return true
  })

  ipcMain.handle(channels.app.getLastProjectId, () => {
    const settings = getAppSettings()
    return settings.lastProjectId ?? null
  })

  ipcMain.handle(channels.app.showQuickCapture, () => {
    showQuickCaptureWindow()
    return true
  })

  ipcMain.handle(channels.app.hideQuickCapture, () => {
    hideQuickCaptureWindow()
    return true
  })

  ipcMain.handle(channels.app.setQuickCapturePinned, (_event, pinned: boolean) => {
    setQuickCapturePinned(pinned)
    return true
  })

  ipcMain.handle(channels.app.isQuickCapturePinned, () => {
    return isQuickCapturePinned()
  })

  ipcMain.handle(channels.app.getQuickCaptureShortcut, () => {
    return getQuickCaptureShortcutInfo()
  })

  ipcMain.handle(channels.app.setQuickCaptureShortcut, (_event, shortcut: string) => {
    return setQuickCaptureShortcut(shortcut)
  })

  ipcMain.handle(channels.app.resetQuickCaptureShortcut, () => {
    return resetQuickCaptureShortcut()
  })

  ipcMain.handle(channels.app.selectFolder, async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(focusedWindow ?? BrowserWindow.getAllWindows()[0], {
      properties: ['openDirectory'],
      title: '选择 Live2D 模型文件夹',
      message: '请选择包含 model.json 的文件夹',
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle(channels.app.readFile, async (_event, filePath: string) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return { success: true, data: content }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(channels.app.showLive2D, () => {
    showLive2DWindow()
    return true
  })

  // 设置鼠标事件穿透（用于 Live2D 透明窗口）
  ipcMain.handle(channels.app.setIgnoreMouseEvents, (_event, ignore: boolean, options?: { forward: boolean }) => {
    const win = BrowserWindow.fromWebContents(_event.sender)
    if (win) {
      win.setIgnoreMouseEvents(ignore, options)
    }
    return true
  })

  // 移动窗口（用于拖动）
  ipcMain.handle(channels.app.moveWindow, (_event, deltaX: number, deltaY: number) => {
    const win = BrowserWindow.fromWebContents(_event.sender)
    if (win) {
      const [x, y] = win.getPosition()
      win.setPosition(x + deltaX, y + deltaY)
    }
    return true
  })

  appState.onActiveProjectChanged((projectId) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(channels.app.activeProjectChanged, projectId)
    }
  })
}
