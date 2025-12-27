import type { Relation, CreateRelationInput, RelationQuery, EntityType, RelationType } from '../entities/Relation'

/**
 * 关系仓储接口 - 定义数据访问契约
 * 具体实现由 Infrastructure 层提供
 */
export interface IRelationRepository {
    /**
     * 创建关系
     */
    create(input: CreateRelationInput): Relation

    /**
     * 根据 ID 获取关系
     */
    getById(id: number): Relation | undefined

    /**
     * 查询关系
     */
    find(query: RelationQuery): Relation[]

    /**
     * 删除关系
     */
    delete(id: number): boolean

    /**
     * 删除指定源的所有关系
     */
    deleteBySource(sourceId: number, sourceType: EntityType): number

    /**
     * 删除指定目标的所有关系
     */
    deleteByTarget(targetId: number, targetType: EntityType): number

    /**
     * 检查关系是否存在
     */
    exists(
        sourceId: number,
        sourceType: EntityType,
        targetId: number,
        targetType: EntityType,
        relationType: RelationType
    ): boolean
}
