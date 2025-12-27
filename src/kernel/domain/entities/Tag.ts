/**
 * 标签实体 - 纯领域类型，不含 ORM 依赖
 */

/**
 * 标签元信息
 */
export interface TagMeta {
    tagId: number
    description: string | null
    icon: string | null
    extra: Record<string, unknown> | null
}

/**
 * 标签基础信息
 */
export interface Tag {
    id: number
    projectId: number
    name: string
    namespace: string
    color: string | null
    createdAt: Date
}

/**
 * 标签完整信息（含元信息）
 */
export interface TagWithMeta extends Tag {
    description: string | null
    icon: string | null
    extra: Record<string, unknown> | null
}

/**
 * 创建标签的输入
 */
export interface CreateTagInput {
    projectId: number
    name: string
    namespace?: string
    color?: string
    meta?: Partial<Omit<TagMeta, 'tagId'>>
}

/**
 * 更新标签的输入
 */
export interface UpdateTagInput {
    name?: string
    color?: string
}

/**
 * 更新标签元信息的输入
 */
export type UpdateTagMetaInput = Partial<Omit<TagMeta, 'tagId'>>
