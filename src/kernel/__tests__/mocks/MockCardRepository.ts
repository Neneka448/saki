import type { ICardRepository } from '../../domain/repositories/ICardRepository'
import type { CardListItem, CardDetail, CardMeta, CreateCardInput, UpdateCardInput, UpdateCardMetaInput } from '../../domain/entities/Card'

/**
 * Mock 卡片仓储 - 用于单元测试
 */
export class MockCardRepository implements ICardRepository {
    private cards: Map<number, { projectId: number; content: string; createdAt: Date; updatedAt: Date }> = new Map()
    private metas: Map<number, Omit<CardMeta, 'cardId'>> = new Map()
    private nextId = 1

    create(input: CreateCardInput): CardDetail {
        const id = this.nextId++
        const now = new Date()

        this.cards.set(id, {
            projectId: input.projectId,
            content: input.content,
            createdAt: now,
            updatedAt: now,
        })

        const meta = {
            title: input.meta?.title ?? input.content.slice(0, 50),
            summary: input.meta?.summary ?? null,
            wordCount: input.content.length,
            extra: input.meta?.extra ?? null,
        }
        this.metas.set(id, meta)

        return {
            id,
            projectId: input.projectId,
            content: input.content,
            ...meta,
            createdAt: now,
            updatedAt: now,
        }
    }

    getById(id: number): CardDetail | undefined {
        const card = this.cards.get(id)
        if (!card) return undefined

        const meta = this.metas.get(id) ?? { title: null, summary: null, wordCount: null, extra: null }

        return {
            id,
            projectId: card.projectId,
            content: card.content,
            ...meta,
            createdAt: card.createdAt,
            updatedAt: card.updatedAt,
        }
    }

    getListByProject(projectId: number): CardListItem[] {
        const result: CardListItem[] = []
        for (const [id, card] of this.cards) {
            if (card.projectId !== projectId) continue
            const meta = this.metas.get(id) ?? { title: null, summary: null, wordCount: null, extra: null }
            result.push({
                id,
                projectId: card.projectId,
                ...meta,
                createdAt: card.createdAt,
                updatedAt: card.updatedAt,
            })
        }
        return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }

    update(id: number, input: UpdateCardInput): CardDetail | undefined {
        const card = this.cards.get(id)
        if (!card) return undefined

        const now = new Date()
        card.content = input.content
        card.updatedAt = now

        const existingMeta = this.metas.get(id)
        const meta = {
            title: input.meta?.title ?? input.content.slice(0, 50),
            summary: input.meta?.summary ?? existingMeta?.summary ?? null,
            wordCount: input.content.length,
            extra: input.meta?.extra ?? existingMeta?.extra ?? null,
        }
        this.metas.set(id, meta)

        return {
            id,
            projectId: card.projectId,
            content: input.content,
            ...meta,
            createdAt: card.createdAt,
            updatedAt: now,
        }
    }

    updateMeta(cardId: number, meta: UpdateCardMetaInput): CardMeta | undefined {
        if (!this.cards.has(cardId)) return undefined

        const existing = this.metas.get(cardId) ?? { title: null, summary: null, wordCount: null, extra: null }
        const updated = { ...existing, ...meta }
        this.metas.set(cardId, updated)

        return { cardId, ...updated }
    }

    delete(id: number): boolean {
        if (!this.cards.has(id)) return false
        this.cards.delete(id)
        this.metas.delete(id)
        return true
    }

    countByProject(projectId: number): number {
        let count = 0
        for (const card of this.cards.values()) {
            if (card.projectId === projectId) count++
        }
        return count
    }

    deleteByProject(projectId: number): number {
        let count = 0
        for (const [id, card] of this.cards) {
            if (card.projectId === projectId) {
                this.cards.delete(id)
                this.metas.delete(id)
                count++
            }
        }
        return count
    }

    // 测试辅助方法
    clear(): void {
        this.cards.clear()
        this.metas.clear()
        this.nextId = 1
    }
}
