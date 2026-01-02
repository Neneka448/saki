import { ipcRenderer } from 'electron'
import { channels } from '../../shared/ipc/channels'
import type {
    IpcResult,
    CardDetail,
    CardListItem,
    CardMeta,
    CreateCardParams,
    UpdateCardParams,
    UpdateCardMetaParams,
    TagWithMeta,
    CardChangeEvent,
} from '../../shared/ipc/types'

/**
 * 卡片 API - 暴露给渲染进程
 */
export const cardBridge = {
    /**
     * 创建卡片
     */
    create(params: CreateCardParams): Promise<IpcResult<CardDetail>> {
        return ipcRenderer.invoke(channels.card.create, params)
    },

    /**
     * 获取卡片详情
     */
    getById(id: number): Promise<IpcResult<CardDetail>> {
        return ipcRenderer.invoke(channels.card.getById, id)
    },

    /**
     * 获取项目下的卡片列表
     */
    getListByProject(projectId: number): Promise<IpcResult<CardListItem[]>> {
        return ipcRenderer.invoke(channels.card.getListByProject, projectId)
    },

    /**
     * 更新卡片
     */
    update(params: UpdateCardParams): Promise<IpcResult<CardDetail>> {
        return ipcRenderer.invoke(channels.card.update, params)
    },

    /**
     * 更新卡片元信息
     */
    updateMeta(params: UpdateCardMetaParams): Promise<IpcResult<CardMeta>> {
        return ipcRenderer.invoke(channels.card.updateMeta, params)
    },

    /**
     * 删除卡片
     */
    delete(id: number): Promise<IpcResult<boolean>> {
        return ipcRenderer.invoke(channels.card.delete, id)
    },

    /**
     * 获取卡片的标签
     */
    getTags(cardId: number): Promise<IpcResult<TagWithMeta[]>> {
        return ipcRenderer.invoke(channels.card.getTags, cardId)
    },

    /**
     * 为卡片添加标签
     */
    addTag(cardId: number, tagId: number): Promise<IpcResult<boolean>> {
        return ipcRenderer.invoke(channels.card.addTag, { cardId, tagId })
    },

    /**
     * 移除卡片的标签
     */
    removeTag(cardId: number, tagId: number): Promise<IpcResult<boolean>> {
        return ipcRenderer.invoke(channels.card.removeTag, { cardId, tagId })
    },

    /**
     * 添加卡片引用
     */
    addReference(fromCardId: number, toCardId: number): Promise<IpcResult<boolean>> {
        return ipcRenderer.invoke(channels.card.addReference, { fromCardId, toCardId })
    },

    /**
     * 获取卡片引用的其他卡片
     */
    getReferencedCards(cardId: number): Promise<IpcResult<CardListItem[]>> {
        return ipcRenderer.invoke(channels.card.getReferencedCards, cardId)
    },

    /**
     * 获取引用该卡片的其他卡片
     */
    getReferencingCards(cardId: number): Promise<IpcResult<CardListItem[]>> {
        return ipcRenderer.invoke(channels.card.getReferencingCards, cardId)
    },

    /**
     * 根据标签筛选卡片
     */
    getByTag(tagId: number): Promise<IpcResult<CardListItem[]>> {
        return ipcRenderer.invoke(channels.card.getByTag, tagId)
    },

    /**
     * 根据多个标签筛选卡片
     */
    getByTags(tagIds: number[]): Promise<IpcResult<CardListItem[]>> {
        return ipcRenderer.invoke(channels.card.getByTags, tagIds)
    },

    /**
     * 批量更新卡片
     */
    batchUpdate(projectId: number, operations: any[]): Promise<IpcResult<any[]>> {
        return ipcRenderer.invoke(channels.card.batchUpdate, { projectId, operations })
    },

    /**
     * 监听卡片变更
     */
    onChanged(listener: (event: CardChangeEvent) => void) {
        const handler = (_event: Electron.IpcRendererEvent, payload: CardChangeEvent) => {
            listener(payload)
        }
        ipcRenderer.on(channels.card.changed, handler)
        return () => {
            ipcRenderer.removeListener(channels.card.changed, handler)
        }
    },
}
