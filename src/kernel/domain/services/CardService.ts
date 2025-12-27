import type { ICardRepository } from '../repositories/ICardRepository'
import type { ITagRepository } from '../repositories/ITagRepository'
import type { IRelationRepository } from '../repositories/IRelationRepository'
import type { CardListItem, CardDetail, CardMeta, CreateCardInput, UpdateCardInput, UpdateCardMetaInput } from '../entities/Card'
import type { TagWithMeta } from '../entities/Tag'

/**
 * 卡片领域服务
 * 处理卡片相关的业务逻辑
 */
export class CardService {
    constructor(
        private cardRepo: ICardRepository,
        private tagRepo: ITagRepository,
        private relationRepo: IRelationRepository
    ) { }

    /**
     * 创建卡片
     */
    create(input: CreateCardInput): CardDetail {
        return this.cardRepo.create(input)
    }

    /**
     * 获取卡片详情
     */
    getById(id: number): CardDetail | undefined {
        return this.cardRepo.getById(id)
    }

    /**
     * 获取项目下的卡片列表
     */
    getListByProject(projectId: number): CardListItem[] {
        return this.cardRepo.getListByProject(projectId)
    }

    /**
     * 更新卡片
     */
    update(id: number, input: UpdateCardInput): CardDetail | undefined {
        return this.cardRepo.update(id, input)
    }

    /**
     * 更新卡片元信息
     */
    updateMeta(cardId: number, meta: UpdateCardMetaInput): CardMeta | undefined {
        return this.cardRepo.updateMeta(cardId, meta)
    }

    /**
     * 删除卡片
     */
    delete(id: number): boolean {
        // 先删除关系
        this.relationRepo.deleteBySource(id, 'card')
        this.relationRepo.deleteByTarget(id, 'card')
        // 再删除卡片
        return this.cardRepo.delete(id)
    }

    /**
     * 获取卡片的标签
     */
    getTagsForCard(cardId: number): TagWithMeta[] {
        const relations = this.relationRepo.find({
            sourceId: cardId,
            sourceType: 'card',
            targetType: 'tag',
            relationType: 'tagged',
        })

        return relations
            .map((rel) => this.tagRepo.getById(rel.targetId))
            .filter((tag): tag is TagWithMeta => tag !== undefined)
    }

    /**
     * 为卡片添加标签
     */
    addTag(cardId: number, tagId: number): boolean {
        const card = this.cardRepo.getById(cardId)
        const tag = this.tagRepo.getById(tagId)
        if (!card || !tag) return false

        if (this.relationRepo.exists(cardId, 'card', tagId, 'tag', 'tagged')) {
            return true
        }

        this.relationRepo.create({
            sourceId: cardId,
            sourceType: 'card',
            targetId: tagId,
            targetType: 'tag',
            relationType: 'tagged',
        })
        return true
    }

    /**
     * 移除卡片的标签
     */
    removeTag(cardId: number, tagId: number): boolean {
        const relations = this.relationRepo.find({
            sourceId: cardId,
            sourceType: 'card',
            targetId: tagId,
            targetType: 'tag',
            relationType: 'tagged',
        })

        if (relations.length === 0) return false
        return this.relationRepo.delete(relations[0].id)
    }

    /**
     * 获取卡片引用的其他卡片
     */
    getReferencedCards(cardId: number): CardListItem[] {
        const relations = this.relationRepo.find({
            sourceId: cardId,
            sourceType: 'card',
            targetType: 'card',
            relationType: 'references',
        })

        return relations
            .map((rel) => this.cardRepo.getById(rel.targetId))
            .filter((card): card is CardDetail => card !== undefined)
            .map(({ content, ...listItem }) => listItem)
    }

    /**
     * 获取引用该卡片的其他卡片
     */
    getReferencingCards(cardId: number): CardListItem[] {
        const relations = this.relationRepo.find({
            targetId: cardId,
            targetType: 'card',
            sourceType: 'card',
            relationType: 'references',
        })

        return relations
            .map((rel) => this.cardRepo.getById(rel.sourceId))
            .filter((card): card is CardDetail => card !== undefined)
            .map(({ content, ...listItem }) => listItem)
    }

    /**
     * 添加卡片引用
     */
    addReference(fromCardId: number, toCardId: number): boolean {
        const fromCard = this.cardRepo.getById(fromCardId)
        const toCard = this.cardRepo.getById(toCardId)
        if (!fromCard || !toCard) return false
        if (fromCardId === toCardId) return false

        if (this.relationRepo.exists(fromCardId, 'card', toCardId, 'card', 'references')) {
            return true
        }

        this.relationRepo.create({
            sourceId: fromCardId,
            sourceType: 'card',
            targetId: toCardId,
            targetType: 'card',
            relationType: 'references',
        })
        return true
    }

    /**
     * 根据标签筛选卡片
     */
    getCardsByTag(tagId: number): CardListItem[] {
        const relations = this.relationRepo.find({
            targetId: tagId,
            targetType: 'tag',
            sourceType: 'card',
            relationType: 'tagged',
        })

        return relations
            .map((rel) => this.cardRepo.getById(rel.sourceId))
            .filter((card): card is CardDetail => card !== undefined)
            .map(({ content, ...listItem }) => listItem)
    }

    /**
     * 根据多个标签筛选卡片（AND 逻辑）
     */
    getCardsByTags(tagIds: number[]): CardListItem[] {
        if (tagIds.length === 0) return []

        let cardIds = new Set(
            this.relationRepo
                .find({
                    targetId: tagIds[0],
                    targetType: 'tag',
                    sourceType: 'card',
                    relationType: 'tagged',
                })
                .map((rel) => rel.sourceId)
        )

        for (let i = 1; i < tagIds.length; i++) {
            const tagCardIds = new Set(
                this.relationRepo
                    .find({
                        targetId: tagIds[i],
                        targetType: 'tag',
                        sourceType: 'card',
                        relationType: 'tagged',
                    })
                    .map((rel) => rel.sourceId)
            )
            cardIds = new Set([...cardIds].filter((id) => tagCardIds.has(id)))
        }

        return [...cardIds]
            .map((id) => this.cardRepo.getById(id))
            .filter((card): card is CardDetail => card !== undefined)
            .map(({ content, ...listItem }) => listItem)
    }
}
