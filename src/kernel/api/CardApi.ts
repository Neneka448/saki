import { CardService } from '../domain/services/CardService'
import type { CardListItem, CardDetail, CardMeta, CreateCardInput, UpdateCardMetaInput } from '../domain/entities/Card'
import type { TagWithMeta } from '../domain/entities/Tag'
import { Result, ok, err } from './Result'

/**
 * 卡片 API - 对外暴露的卡片能力
 */
export class CardApi {
    constructor(private cardService: CardService) { }

    /**
     * 创建卡片
     */
    create(projectId: number, content: string, meta?: Partial<Omit<CardMeta, 'cardId'>>): Result<CardDetail> {
        if (!content.trim()) {
            return err('Content cannot be empty')
        }

        try {
            const card = this.cardService.create({ projectId, content, meta })
            return ok(card)
        } catch (e) {
            return err(`Failed to create card: ${e}`)
        }
    }

    /**
     * 获取卡片详情
     */
    getById(id: number): Result<CardDetail> {
        const card = this.cardService.getById(id)
        if (!card) {
            return err(`Card not found: ${id}`)
        }
        return ok(card)
    }

    /**
     * 获取项目下的卡片列表
     */
    getListByProject(projectId: number): Result<CardListItem[]> {
        try {
            const cards = this.cardService.getListByProject(projectId)
            return ok(cards)
        } catch (e) {
            return err(`Failed to get card list: ${e}`)
        }
    }

    /**
     * 更新卡片
     */
    update(id: number, content: string, meta?: Partial<Omit<CardMeta, 'cardId'>>): Result<CardDetail> {
        if (!content.trim()) {
            return err('Content cannot be empty')
        }

        const card = this.cardService.update(id, { content, meta })
        if (!card) {
            return err(`Card not found: ${id}`)
        }
        return ok(card)
    }

    /**
     * 更新卡片元信息
     */
    updateMeta(cardId: number, meta: UpdateCardMetaInput): Result<CardMeta> {
        const result = this.cardService.updateMeta(cardId, meta)
        if (!result) {
            return err(`Card not found: ${cardId}`)
        }
        return ok(result)
    }

    /**
     * 删除卡片
     */
    delete(id: number): Result<boolean> {
        const success = this.cardService.delete(id)
        if (!success) {
            return err(`Card not found: ${id}`)
        }
        return ok(true)
    }

    /**
     * 获取卡片的标签
     */
    getTagsForCard(cardId: number): Result<TagWithMeta[]> {
        try {
            const tags = this.cardService.getTagsForCard(cardId)
            return ok(tags)
        } catch (e) {
            return err(`Failed to get tags: ${e}`)
        }
    }

    /**
     * 为卡片添加标签
     */
    addTag(cardId: number, tagId: number): Result<boolean> {
        const success = this.cardService.addTag(cardId, tagId)
        if (!success) {
            return err('Card or tag not found')
        }
        return ok(true)
    }

    /**
     * 移除卡片的标签
     */
    removeTag(cardId: number, tagId: number): Result<boolean> {
        const success = this.cardService.removeTag(cardId, tagId)
        if (!success) {
            return err('Tag not found on card')
        }
        return ok(true)
    }

    /**
     * 添加卡片引用
     */
    addReference(fromCardId: number, toCardId: number): Result<boolean> {
        if (fromCardId === toCardId) {
            return err('Cannot reference self')
        }

        const success = this.cardService.addReference(fromCardId, toCardId)
        if (!success) {
            return err('Card not found')
        }
        return ok(true)
    }

    /**
     * 获取卡片引用的其他卡片
     */
    getReferencedCards(cardId: number): Result<CardListItem[]> {
        try {
            const cards = this.cardService.getReferencedCards(cardId)
            return ok(cards)
        } catch (e) {
            return err(`Failed to get referenced cards: ${e}`)
        }
    }

    /**
     * 获取引用该卡片的其他卡片
     */
    getReferencingCards(cardId: number): Result<CardListItem[]> {
        try {
            const cards = this.cardService.getReferencingCards(cardId)
            return ok(cards)
        } catch (e) {
            return err(`Failed to get referencing cards: ${e}`)
        }
    }

    /**
     * 根据标签筛选卡片
     */
    getCardsByTag(tagId: number): Result<CardListItem[]> {
        try {
            const cards = this.cardService.getCardsByTag(tagId)
            return ok(cards)
        } catch (e) {
            return err(`Failed to get cards by tag: ${e}`)
        }
    }

    /**
     * 根据多个标签筛选卡片
     */
    getCardsByTags(tagIds: number[]): Result<CardListItem[]> {
        try {
            const cards = this.cardService.getCardsByTags(tagIds)
            return ok(cards)
        } catch (e) {
            return err(`Failed to get cards by tags: ${e}`)
        }
    }
}
