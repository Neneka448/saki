/**
 * IPC 共享类型定义
 * 渲染进程和主进程共用的类型
 */

// ============ 通用类型 ============

/**
 * IPC 调用结果
 */
export type IpcResult<T> =
    | { success: true; data: T }
    | { success: false; error: string }

// ============ 项目相关类型 ============

export interface Project {
    id: number
    name: string
    description: string | null
    color: string | null
    icon: string | null
    extra: Record<string, unknown> | null
    createdAt: Date
    updatedAt: Date
}

export interface CreateProjectParams {
    name: string
    description?: string
    color?: string
    icon?: string
    extra?: Record<string, unknown>
}

export interface UpdateProjectParams {
    id: number
    name?: string
    description?: string
    color?: string
    icon?: string
    extra?: Record<string, unknown>
}

// ============ 卡片相关类型 ============

export interface CardMeta {
    cardId: number
    title: string | null
    summary: string | null
    wordCount: number | null
    extra: Record<string, unknown> | null
}

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

export interface CardDetail extends CardListItem {
    content: string
}

export interface CreateCardParams {
    projectId: number
    content: string
    meta?: Partial<Omit<CardMeta, 'cardId'>>
}

export interface UpdateCardParams {
    id: number
    content: string
    meta?: Partial<Omit<CardMeta, 'cardId'>>
}

export interface UpdateCardMetaParams {
    cardId: number
    meta: Partial<Omit<CardMeta, 'cardId'>>
}

export type CardChangeType = 'create' | 'update' | 'delete' | 'tag'

export interface CardChangeEvent {
    type: CardChangeType
    cardId: number
    projectId: number
    payload?: Record<string, unknown>
}

// ============ 标签相关类型 ============

export interface TagMeta {
    tagId: number
    description: string | null
    icon: string | null
    extra: Record<string, unknown> | null
}

export interface Tag {
    id: number
    projectId: number
    name: string
    namespace: string
    color: string | null
    createdAt: Date
}

export interface TagWithMeta extends Tag {
    description: string | null
    icon: string | null
    extra: Record<string, unknown> | null
}

export interface TagWithUsageCount extends TagWithMeta {
    usageCount: number
}

export interface CreateTagParams {
    projectId: number
    name: string
    namespace?: string
    color?: string
    meta?: Partial<Omit<TagMeta, 'tagId'>>
}

export interface UpdateTagParams {
    id: number
    name?: string
    color?: string
}

export interface UpdateTagMetaParams {
    tagId: number
    meta: Partial<Omit<TagMeta, 'tagId'>>
}

// ============ 关系相关类型 ============

export type EntityType = 'card' | 'tag' | (string & {})
export type RelationType = string

export interface Relation {
    id: number
    sourceId: number
    sourceType: EntityType
    targetId: number
    targetType: EntityType
    relationType: RelationType
    meta: Record<string, unknown> | null
    createdAt: Date
}

export interface CreateRelationParams {
    sourceId: number
    sourceType: EntityType
    targetId: number
    targetType: EntityType
    relationType: RelationType
    meta?: Record<string, unknown>
}

export interface RelationQuery {
    sourceId?: number
    sourceType?: EntityType
    targetId?: number
    targetType?: EntityType
    relationType?: RelationType
}
