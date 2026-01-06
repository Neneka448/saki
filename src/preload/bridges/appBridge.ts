import { ipcRenderer, clipboard } from 'electron'
import { channels } from '../../shared/ipc/channels'

/**
 * 应用 API - 暴露给渲染进程
 */
export const appBridge = {
  /**
   * Ping 测试
   */
  ping: (): Promise<{ ok: boolean; ts: number }> => {
    return ipcRenderer.invoke(channels.app.ping)
  },
  /**
   * 获取当前项目
   */
  getActiveProjectId: (): Promise<number | null> => {
    return ipcRenderer.invoke(channels.app.getActiveProjectId)
  },
  /**
   * 设置当前项目
   */
  setActiveProjectId: (projectId: number | null): Promise<boolean> => {
    return ipcRenderer.invoke(channels.app.setActiveProjectId, projectId)
  },
  /**
   * 获取上次使用的项目 ID
   */
  getLastProjectId: (): Promise<number | null> => {
    return ipcRenderer.invoke(channels.app.getLastProjectId)
  },
  /**
   * 监听当前项目变化
   */
  onActiveProjectChanged: (listener: (projectId: number | null) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, projectId: number | null) => {
      listener(projectId ?? null)
    }
    ipcRenderer.on(channels.app.activeProjectChanged, handler)
    return () => {
      ipcRenderer.removeListener(channels.app.activeProjectChanged, handler)
    }
  },
  /**
   * 显示快速记录窗口
   */
  showQuickCapture: (): Promise<boolean> => {
    return ipcRenderer.invoke(channels.app.showQuickCapture)
  },
  /**
   * 隐藏快速记录窗口
   */
  hideQuickCapture: (): Promise<boolean> => {
    return ipcRenderer.invoke(channels.app.hideQuickCapture)
  },
  /**
   * 设置快速记录窗口固定状态
   */
  setQuickCapturePinned: (pinned: boolean): Promise<boolean> => {
    return ipcRenderer.invoke(channels.app.setQuickCapturePinned, pinned)
  },
  /**
   * 获取快速记录窗口固定状态
   */
  isQuickCapturePinned: (): Promise<boolean> => {
    return ipcRenderer.invoke(channels.app.isQuickCapturePinned)
  },
  /**
   * 获取快速记录快捷键
   */
  getQuickCaptureShortcut: (): Promise<{ shortcut: string; defaultShortcut: string }> => {
    return ipcRenderer.invoke(channels.app.getQuickCaptureShortcut)
  },
  /**
   * 设置快速记录快捷键
   */
  setQuickCaptureShortcut: (
    shortcut: string
  ): Promise<{ ok: boolean; shortcut: string; defaultShortcut: string; error?: string }> => {
    return ipcRenderer.invoke(channels.app.setQuickCaptureShortcut, shortcut)
  },
  /**
   * 重置快速记录快捷键
   */
  resetQuickCaptureShortcut: (): Promise<{ ok: boolean; shortcut: string; defaultShortcut: string; error?: string }> => {
    return ipcRenderer.invoke(channels.app.resetQuickCaptureShortcut)
  },
  /**
   * 选择文件夹（用于 Live2D 模型导入等）
   */
  selectFolder: (): Promise<string | null> => {
    return ipcRenderer.invoke(channels.app.selectFolder)
  },
  /**
   * 读取本地文件内容
   */
  readFile: (filePath: string): Promise<{ success: boolean; data?: string; error?: string }> => {
    return ipcRenderer.invoke(channels.app.readFile, filePath)
  },
  /**
   * 打开 Live2D 窗口
   */
  showLive2D: (): Promise<boolean> => {
    return ipcRenderer.invoke(channels.app.showLive2D)
  },
  /**
   * 设置鼠标事件穿透（用于 Live2D 透明窗口）
   */
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }): Promise<boolean> => {
    return ipcRenderer.invoke(channels.app.setIgnoreMouseEvents, ignore, options)
  },
  /**
   * 移动窗口（用于拖动）
   */
  moveWindow: (deltaX: number, deltaY: number): Promise<boolean> => {
    return ipcRenderer.invoke(channels.app.moveWindow, deltaX, deltaY)
  },
  /**
   * 剪贴板操作 - 读取文本
   */
  clipboardReadText: (): string => {
    return clipboard.readText()
  },
  /**
   * 剪贴板操作 - 写入文本
   */
  clipboardWriteText: (text: string): void => {
    clipboard.writeText(text)
  },
}
