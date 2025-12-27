/**
 * 关系实体 - 纯领域类型，不含 ORM 依赖
 */

/**
 * 实体类型（开放字符串，Kernel 预置这些，应用层可扩展）
 */
export type EntityType = 'card' | 'tag' | (string & {})

/**
 * 关系类型（开放字符串，应用层可自定义）
 * 预置类型：
 * - 'tagged': 卡片被打上标签
 * - 'references': 卡片引用另一张卡片
 * - 'parent': 标签的父子关系
 */
export type RelationType = string

/**
 * 关系实体
 */
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

/**
 * 创建关系的输入
 */
export interface CreateRelationInput {
    sourceId: number
    sourceType: EntityType
    targetId: number
    targetType: EntityType
    relationType: RelationType
    meta?: Record<string, unknown>
}

/**
 * 查询关系的参数
 */
export interface RelationQuery {
    sourceId?: number
    sourceType?: EntityType
    targetId?: number
    targetType?: EntityType
    relationType?: RelationType
}
