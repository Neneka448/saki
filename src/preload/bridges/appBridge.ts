import { ipcRenderer } from 'electron'
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
}
