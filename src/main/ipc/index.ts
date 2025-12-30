import type { KernelApi } from '../../kernel'
import { registerProjectHandlers } from './handlers/projectHandlers'
import { registerCardHandlers } from './handlers/cardHandlers'
import { registerTagHandlers } from './handlers/tagHandlers'
import { registerRelationHandlers } from './handlers/relationHandlers'
import { registerAssetHandlers } from './handlers/assetHandlers'
import { registerAppHandlers } from './handlers/appHandlers'

/**
 * 注册所有 IPC handlers
 */
export function registerIpcHandlers(kernel: KernelApi): void {
  // 注册各模块的 handlers
  registerAppHandlers()
  registerProjectHandlers(kernel)
  registerCardHandlers(kernel)
  registerTagHandlers(kernel)
  registerRelationHandlers(kernel)
  registerAssetHandlers()

  console.log('[IPC] All handlers registered')
}
