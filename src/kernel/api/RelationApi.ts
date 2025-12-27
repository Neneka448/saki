import { RelationService } from '../domain/services/RelationService'
import type { Relation, CreateRelationInput, RelationQuery, EntityType, RelationType } from '../domain/entities/Relation'
import { Result, ok, err } from './Result'

/**
 * 关系 API - 对外暴露的关系能力
 */
export class RelationApi {
    constructor(private relationService: RelationService) { }

    /**
     * 创建关系
     */
    create(input: CreateRelationInput): Result<Relation> {
        try {
            const relation = this.relationService.create(input)
            return ok(relation)
        } catch (e) {
            return err(`Failed to create relation: ${e}`)
        }
    }

    /**
     * 获取关系
     */
    getById(id: number): Result<Relation> {
        const relation = this.relationService.getById(id)
        if (!relation) {
            return err(`Relation not found: ${id}`)
        }
        return ok(relation)
    }

    /**
     * 查询关系
     */
    find(query: RelationQuery): Result<Relation[]> {
        try {
            const relations = this.relationService.find(query)
            return ok(relations)
        } catch (e) {
            return err(`Failed to find relations: ${e}`)
        }
    }

    /**
     * 删除关系
     */
    delete(id: number): Result<boolean> {
        const success = this.relationService.delete(id)
        if (!success) {
            return err(`Relation not found: ${id}`)
        }
        return ok(true)
    }

    /**
     * 检查关系是否存在
     */
    exists(
        sourceId: number,
        sourceType: EntityType,
        targetId: number,
        targetType: EntityType,
        relationType: RelationType
    ): Result<boolean> {
        try {
            const exists = this.relationService.exists(sourceId, sourceType, targetId, targetType, relationType)
            return ok(exists)
        } catch (e) {
            return err(`Failed to check relation: ${e}`)
        }
    }

    /**
     * 获取实体的出向关系
     */
    getOutgoing(entityId: number, entityType: EntityType): Result<Relation[]> {
        try {
            const relations = this.relationService.getOutgoing(entityId, entityType)
            return ok(relations)
        } catch (e) {
            return err(`Failed to get outgoing relations: ${e}`)
        }
    }

    /**
     * 获取实体的入向关系
     */
    getIncoming(entityId: number, entityType: EntityType): Result<Relation[]> {
        try {
            const relations = this.relationService.getIncoming(entityId, entityType)
            return ok(relations)
        } catch (e) {
            return err(`Failed to get incoming relations: ${e}`)
        }
    }
}
