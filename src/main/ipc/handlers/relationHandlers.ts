import { ipcMain } from 'electron'
import { channels } from '../../../shared/ipc/channels'
import type { KernelApi } from '../../../kernel'
import type { CreateRelationParams, RelationQuery } from '../../../shared/ipc/types'

/**
 * 注册关系相关的 IPC handlers
 */
export function registerRelationHandlers(kernel: KernelApi): void {
    const { relation } = kernel

    // 创建关系
    ipcMain.handle(channels.relation.create, (_, params: CreateRelationParams) => {
        return relation.create(params)
    })

    // 获取关系
    ipcMain.handle(channels.relation.getById, (_, id: number) => {
        return relation.getById(id)
    })

    // 查询关系
    ipcMain.handle(channels.relation.find, (_, query: RelationQuery) => {
        return relation.find(query)
    })

    // 删除关系
    ipcMain.handle(channels.relation.delete, (_, id: number) => {
        return relation.delete(id)
    })
}
