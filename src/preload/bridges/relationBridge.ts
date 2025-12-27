import { ipcRenderer } from 'electron'
import { channels } from '../../shared/ipc/channels'
import type {
    IpcResult,
    Relation,
    CreateRelationParams,
    RelationQuery,
} from '../../shared/ipc/types'

/**
 * 关系 API - 暴露给渲染进程
 */
export const relationBridge = {
    /**
     * 创建关系
     */
    create(params: CreateRelationParams): Promise<IpcResult<Relation>> {
        return ipcRenderer.invoke(channels.relation.create, params)
    },

    /**
     * 获取关系
     */
    getById(id: number): Promise<IpcResult<Relation>> {
        return ipcRenderer.invoke(channels.relation.getById, id)
    },

    /**
     * 查询关系
     */
    find(query: RelationQuery): Promise<IpcResult<Relation[]>> {
        return ipcRenderer.invoke(channels.relation.find, query)
    },

    /**
     * 删除关系
     */
    delete(id: number): Promise<IpcResult<boolean>> {
        return ipcRenderer.invoke(channels.relation.delete, id)
    },
}
