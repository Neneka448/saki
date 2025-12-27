import { ipcMain } from 'electron'
import { channels } from '../../../shared/ipc/channels'
import type { KernelApi } from '../../../kernel'
import type {
    CreateTagParams,
    UpdateTagParams,
    UpdateTagMetaParams,
} from '../../../shared/ipc/types'

/**
 * 注册标签相关的 IPC handlers
 */
export function registerTagHandlers(kernel: KernelApi): void {
    const { tag } = kernel

    // 创建标签
    ipcMain.handle(channels.tag.create, (_, params: CreateTagParams) => {
        return tag.create(params.projectId, params.name, params.color, params.meta, params.namespace)
    })

    // 获取标签
    ipcMain.handle(channels.tag.getById, (_, id: number) => {
        return tag.getById(id)
    })

    // 根据项目和名称获取标签
    ipcMain.handle(channels.tag.getByName, (_, params: { projectId: number; name: string; namespace?: string }) => {
        return tag.getByName(params.projectId, params.name, params.namespace)
    })

    // 获取或创建标签
    ipcMain.handle(channels.tag.getOrCreate, (_, params: { projectId: number; name: string; color?: string }) => {
        return tag.getOrCreate(params.projectId, params.name, params.color)
    })

    // 获取项目下所有用户标签
    ipcMain.handle(channels.tag.getAllUserTags, (_, projectId: number) => {
        return tag.getAllUserTags(projectId)
    })

    // 获取所有标签及使用次数
    ipcMain.handle(channels.tag.getAllWithUsageCount, (_, projectId: number) => {
        return tag.getAllWithUsageCount(projectId)
    })

    // 更新标签
    ipcMain.handle(channels.tag.update, (_, params: UpdateTagParams) => {
        return tag.update(params.id, { name: params.name, color: params.color })
    })

    // 更新标签元信息
    ipcMain.handle(channels.tag.updateMeta, (_, params: UpdateTagMetaParams) => {
        return tag.updateMeta(params.tagId, params.meta)
    })

    // 删除标签
    ipcMain.handle(channels.tag.delete, (_, id: number) => {
        return tag.delete(id)
    })

    // 合并标签
    ipcMain.handle(channels.tag.merge, (_, params: { sourceTagId: number; targetTagId: number }) => {
        return tag.merge(params.sourceTagId, params.targetTagId)
    })
}
