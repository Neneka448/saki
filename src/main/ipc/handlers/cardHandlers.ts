import { BrowserWindow, ipcMain } from 'electron'
import { channels } from '../../../shared/ipc/channels'
import type { KernelApi } from '../../../kernel'
import type {
    CardChangeEvent,
    CreateCardParams,
    UpdateCardParams,
    UpdateCardMetaParams,
} from '../../../shared/ipc/types'

/**
 * 注册卡片相关的 IPC handlers
 */
export function registerCardHandlers(kernel: KernelApi): void {
    const { card } = kernel

    const broadcastCardChange = (event: CardChangeEvent) => {
        for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send(channels.card.changed, event)
        }
    }

    const resolveProjectId = (cardId: number): number | null => {
        const detail = card.getById(cardId)
        return detail.success ? detail.data.projectId : null
    }

    // 创建卡片
    ipcMain.handle(channels.card.create, (_, params: CreateCardParams) => {
        const result = card.create(params.projectId, params.content, params.meta)
        if (result.success) {
            broadcastCardChange({
                type: 'create',
                cardId: result.data.id,
                projectId: params.projectId,
            })
        }
        return result
    })

    // 获取卡片详情
    ipcMain.handle(channels.card.getById, (_, id: number) => {
        return card.getById(id)
    })

    // 获取项目下的卡片列表
    ipcMain.handle(channels.card.getListByProject, (_, projectId: number) => {
        return card.getListByProject(projectId)
    })

    // 更新卡片
    ipcMain.handle(channels.card.update, (_, params: UpdateCardParams) => {
        const result = card.update(params.id, params.content, params.meta)
        if (result.success) {
            broadcastCardChange({
                type: 'update',
                cardId: result.data.id,
                projectId: result.data.projectId,
            })
        }
        return result
    })

    // 更新卡片元信息
    ipcMain.handle(channels.card.updateMeta, (_, params: UpdateCardMetaParams) => {
        return card.updateMeta(params.cardId, params.meta)
    })

    // 删除卡片
    ipcMain.handle(channels.card.delete, (_, id: number) => {
        const projectId = resolveProjectId(id)
        const result = card.delete(id)
        if (result.success && projectId !== null) {
            broadcastCardChange({
                type: 'delete',
                cardId: id,
                projectId,
            })
        }
        return result
    })

    // 获取卡片的标签
    ipcMain.handle(channels.card.getTags, (_, cardId: number) => {
        return card.getTagsForCard(cardId)
    })

    // 为卡片添加标签
    ipcMain.handle(channels.card.addTag, (_, params: { cardId: number; tagId: number }) => {
        const projectId = resolveProjectId(params.cardId)
        const result = card.addTag(params.cardId, params.tagId)
        if (result.success && projectId !== null) {
            broadcastCardChange({
                type: 'tag',
                cardId: params.cardId,
                projectId,
                payload: { tagId: params.tagId, action: 'add' },
            })
        }
        return result
    })

    // 移除卡片的标签
    ipcMain.handle(channels.card.removeTag, (_, params: { cardId: number; tagId: number }) => {
        const projectId = resolveProjectId(params.cardId)
        const result = card.removeTag(params.cardId, params.tagId)
        if (result.success && projectId !== null) {
            broadcastCardChange({
                type: 'tag',
                cardId: params.cardId,
                projectId,
                payload: { tagId: params.tagId, action: 'remove' },
            })
        }
        return result
    })

    // 添加卡片引用
    ipcMain.handle(channels.card.addReference, (_, params: { fromCardId: number; toCardId: number }) => {
        return card.addReference(params.fromCardId, params.toCardId)
    })

    // 获取卡片引用的其他卡片
    ipcMain.handle(channels.card.getReferencedCards, (_, cardId: number) => {
        return card.getReferencedCards(cardId)
    })

    // 获取引用该卡片的其他卡片
    ipcMain.handle(channels.card.getReferencingCards, (_, cardId: number) => {
        return card.getReferencingCards(cardId)
    })

    // 根据标签筛选卡片
    ipcMain.handle(channels.card.getByTag, (_, tagId: number) => {
        return card.getCardsByTag(tagId)
    })

    // 根据多个标签筛选卡片
    ipcMain.handle(channels.card.getByTags, (_, tagIds: number[]) => {
        return card.getCardsByTags(tagIds)
    })
}
