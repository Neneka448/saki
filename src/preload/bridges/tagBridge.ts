import { ipcRenderer } from 'electron'
import { channels } from '../../shared/ipc/channels'
import type {
    IpcResult,
    TagWithMeta,
    TagMeta,
    TagWithUsageCount,
    CreateTagParams,
    UpdateTagParams,
    UpdateTagMetaParams,
} from '../../shared/ipc/types'

/**
 * 标签 API - 暴露给渲染进程
 */
export const tagBridge = {
    /**
     * 创建标签
     */
    create(params: CreateTagParams): Promise<IpcResult<TagWithMeta>> {
        return ipcRenderer.invoke(channels.tag.create, params)
    },

    /**
     * 获取标签
     */
    getById(id: number): Promise<IpcResult<TagWithMeta>> {
        return ipcRenderer.invoke(channels.tag.getById, id)
    },

    /**
     * 根据项目和名称获取标签
     */
    getByName(projectId: number, name: string, namespace?: string): Promise<IpcResult<TagWithMeta>> {
        return ipcRenderer.invoke(channels.tag.getByName, { projectId, name, namespace })
    },

    /**
     * 获取或创建标签
     */
    getOrCreate(projectId: number, name: string, color?: string): Promise<IpcResult<TagWithMeta>> {
        return ipcRenderer.invoke(channels.tag.getOrCreate, { projectId, name, color })
    },

    /**
     * 获取项目下所有用户标签
     */
    getAllUserTags(projectId: number): Promise<IpcResult<TagWithMeta[]>> {
        return ipcRenderer.invoke(channels.tag.getAllUserTags, projectId)
    },

    /**
     * 获取项目下所有标签及使用次数
     */
    getAllWithUsageCount(projectId: number): Promise<IpcResult<TagWithUsageCount[]>> {
        return ipcRenderer.invoke(channels.tag.getAllWithUsageCount, projectId)
    },

    /**
     * 更新标签
     */
    update(params: UpdateTagParams): Promise<IpcResult<TagWithMeta>> {
        return ipcRenderer.invoke(channels.tag.update, params)
    },

    /**
     * 更新标签元信息
     */
    updateMeta(params: UpdateTagMetaParams): Promise<IpcResult<TagMeta>> {
        return ipcRenderer.invoke(channels.tag.updateMeta, params)
    },

    /**
     * 删除标签
     */
    delete(id: number): Promise<IpcResult<boolean>> {
        return ipcRenderer.invoke(channels.tag.delete, id)
    },

    /**
     * 合并标签
     */
    merge(sourceTagId: number, targetTagId: number): Promise<IpcResult<boolean>> {
        return ipcRenderer.invoke(channels.tag.merge, { sourceTagId, targetTagId })
    },
}
