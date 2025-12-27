import { ipcMain } from 'electron'
import { channels } from '../../shared/ipc/channels'
import type { KernelApi } from '../../kernel'
import { registerProjectHandlers } from './handlers/projectHandlers'
import { registerCardHandlers } from './handlers/cardHandlers'
import { registerTagHandlers } from './handlers/tagHandlers'
import { registerRelationHandlers } from './handlers/relationHandlers'
import { registerAssetHandlers } from './handlers/assetHandlers'

/**
 * 注册所有 IPC handlers
 */
export function registerIpcHandlers(kernel: KernelApi): void {
  // 应用相关
  ipcMain.handle(channels.app.ping, () => ({ ok: true, ts: Date.now() }))

  // 注册各模块的 handlers
  registerProjectHandlers(kernel)
  registerCardHandlers(kernel)
  registerTagHandlers(kernel)
  registerRelationHandlers(kernel)
  registerAssetHandlers()

  console.log('[IPC] All handlers registered')
}
