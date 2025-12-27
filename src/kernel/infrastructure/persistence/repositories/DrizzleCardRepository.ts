import { eq, desc, and } from 'drizzle-orm'
import type { DrizzleDB } from '../database'
import { schema } from '../database'
import type { ICardRepository } from '../../../domain/repositories/ICardRepository'
import type { CardListItem, CardDetail, CardMeta, CreateCardInput, UpdateCardInput, UpdateCardMetaInput } from '../../../domain/entities/Card'

/**
 * 计算字数
 */
function countWords(content: string): number {
    const chineseChars = content.match(/[\u4e00-\u9fa5]/g)?.length || 0
    const englishWords = content.replace(/[\u4e00-\u9fa5]/g, ' ').split(/\s+/).filter(Boolean).length
    return chineseChars + englishWords
}

/**
 * 提取标题
 */
function extractTitle(content: string): string {
    const firstLine = content.split('\n')[0].trim()
    const cleaned = firstLine.replace(/^#+\s*/, '')
    return cleaned.slice(0, 50)
}

/**
 * Drizzle 实现的卡片仓储
 */
export class DrizzleCardRepository implements ICardRepository {
    constructor(private db: DrizzleDB) { }

    create(input: CreateCardInput): CardDetail {
        const now = new Date()

        const card = this.db
            .insert(schema.cards)
            .values({
                projectId: input.projectId,
                content: input.content,
                createdAt: now,
                updatedAt: now,
            })
            .returning()
            .get()

        const cardMeta = this.db
            .insert(schema.cardMetas)
            .values({
                cardId: card.id,
                title: input.meta?.title ?? extractTitle(input.content),
                summary: input.meta?.summary ?? null,
                wordCount: countWords(input.content),
                extra: input.meta?.extra ?? null,
            })
            .returning()
            .get()

        return {
            id: card.id,
            projectId: card.projectId,
            content: card.content,
            title: cardMeta.title,
            summary: cardMeta.summary,
            wordCount: cardMeta.wordCount,
            createdAt: card.createdAt,
            updatedAt: card.updatedAt,
            extra: cardMeta.extra,
        }
    }

    getById(id: number): CardDetail | undefined {
        const card = this.db.select().from(schema.cards).where(eq(schema.cards.id, id)).get()
        if (!card) return undefined

        const meta = this.db.select().from(schema.cardMetas).where(eq(schema.cardMetas.cardId, id)).get()

        return {
            id: card.id,
            projectId: card.projectId,
            content: card.content,
            title: meta?.title ?? null,
            summary: meta?.summary ?? null,
            wordCount: meta?.wordCount ?? null,
            createdAt: card.createdAt,
            updatedAt: card.updatedAt,
            extra: meta?.extra ?? null,
        }
    }

    getListByProject(projectId: number): CardListItem[] {
        const results = this.db
            .select({
                id: schema.cards.id,
                projectId: schema.cards.projectId,
                title: schema.cardMetas.title,
                summary: schema.cardMetas.summary,
                wordCount: schema.cardMetas.wordCount,
                createdAt: schema.cards.createdAt,
                updatedAt: schema.cards.updatedAt,
                extra: schema.cardMetas.extra,
            })
            .from(schema.cards)
            .leftJoin(schema.cardMetas, eq(schema.cards.id, schema.cardMetas.cardId))
            .where(eq(schema.cards.projectId, projectId))
            .orderBy(desc(schema.cards.createdAt))
            .all()

        return results
    }

    update(id: number, input: UpdateCardInput): CardDetail | undefined {
        const now = new Date()

        const card = this.db
            .update(schema.cards)
            .set({
                content: input.content,
                updatedAt: now,
            })
            .where(eq(schema.cards.id, id))
            .returning()
            .get()

        if (!card) return undefined

        const existingMeta = this.db.select().from(schema.cardMetas).where(eq(schema.cardMetas.cardId, id)).get()

        const metaValues = {
            title: input.meta?.title ?? extractTitle(input.content),
            summary: input.meta?.summary ?? existingMeta?.summary ?? null,
            wordCount: countWords(input.content),
            extra: input.meta?.extra ?? existingMeta?.extra ?? null,
        }

        let cardMeta: typeof schema.cardMetas.$inferSelect
        if (existingMeta) {
            cardMeta = this.db
                .update(schema.cardMetas)
                .set(metaValues)
                .where(eq(schema.cardMetas.cardId, id))
                .returning()
                .get()!
        } else {
            cardMeta = this.db
                .insert(schema.cardMetas)
                .values({ cardId: id, ...metaValues })
                .returning()
                .get()
        }

        return {
            id: card.id,
            projectId: card.projectId,
            content: card.content,
            title: cardMeta.title,
            summary: cardMeta.summary,
            wordCount: cardMeta.wordCount,
            createdAt: card.createdAt,
            updatedAt: card.updatedAt,
            extra: cardMeta.extra,
        }
    }

    updateMeta(cardId: number, meta: UpdateCardMetaInput): CardMeta | undefined {
        const existing = this.db.select().from(schema.cardMetas).where(eq(schema.cardMetas.cardId, cardId)).get()

        let result: typeof schema.cardMetas.$inferSelect
        if (existing) {
            result = this.db
                .update(schema.cardMetas)
                .set(meta)
                .where(eq(schema.cardMetas.cardId, cardId))
                .returning()
                .get()!
        } else {
            result = this.db
                .insert(schema.cardMetas)
                .values({ cardId, ...meta })
                .returning()
                .get()
        }

        return {
            cardId: result.cardId,
            title: result.title,
            summary: result.summary,
            wordCount: result.wordCount,
            extra: result.extra,
        }
    }

    delete(id: number): boolean {
        this.db.delete(schema.cardMetas).where(eq(schema.cardMetas.cardId, id)).run()
        const result = this.db.delete(schema.cards).where(eq(schema.cards.id, id)).run()
        return result.changes > 0
    }

    countByProject(projectId: number): number {
        return this.db.select().from(schema.cards).where(eq(schema.cards.projectId, projectId)).all().length
    }

    deleteByProject(projectId: number): number {
        // 先删除元信息
        const cards = this.db.select({ id: schema.cards.id }).from(schema.cards).where(eq(schema.cards.projectId, projectId)).all()
        for (const card of cards) {
            this.db.delete(schema.cardMetas).where(eq(schema.cardMetas.cardId, card.id)).run()
        }
        // 再删除卡片
        const result = this.db.delete(schema.cards).where(eq(schema.cards.projectId, projectId)).run()
        return result.changes
    }
}
