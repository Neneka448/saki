/**
 * 卡片实体 - 纯领域类型，不含 ORM 依赖
 */

/**
 * 卡片元信息
 */
export interface CardMeta {
    cardId: number
    title: string | null
    summary: string | null
    wordCount: number | null
    extra: Record<string, unknown> | null
}

/**
 * 卡片列表项 - 不含 content，用于列表展示
 */
export interface CardListItem {
    id: number
    projectId: number
    title: string | null
    summary: string | null
    wordCount: number | null
    createdAt: Date
    updatedAt: Date
    extra: Record<string, unknown> | null
}

/**
 * 卡片详情 - 包含完整 content
 */
export interface CardDetail extends CardListItem {
    content: string
}

/**
 * 创建卡片的输入
 */
export interface CreateCardInput {
    projectId: number
    content: string
    meta?: Partial<Omit<CardMeta, 'cardId'>>
}

/**
 * 更新卡片的输入
 */
export interface UpdateCardInput {
    content: string
    meta?: Partial<Omit<CardMeta, 'cardId'>>
}

/**
 * 更新卡片元信息的输入
 */
export type UpdateCardMetaInput = Partial<Omit<CardMeta, 'cardId'>>
