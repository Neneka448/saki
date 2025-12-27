import type { IRelationRepository } from '../repositories/IRelationRepository'
import type { Relation, CreateRelationInput, RelationQuery, EntityType, RelationType } from '../entities/Relation'

/**
 * 关系领域服务
 * 处理关系相关的业务逻辑
 */
export class RelationService {
    constructor(private relationRepo: IRelationRepository) { }

    /**
     * 创建关系
     */
    create(input: CreateRelationInput): Relation {
        return this.relationRepo.create(input)
    }

    /**
     * 获取关系
     */
    getById(id: number): Relation | undefined {
        return this.relationRepo.getById(id)
    }

    /**
     * 查询关系
     */
    find(query: RelationQuery): Relation[] {
        return this.relationRepo.find(query)
    }

    /**
     * 删除关系
     */
    delete(id: number): boolean {
        return this.relationRepo.delete(id)
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
    ): boolean {
        return this.relationRepo.exists(sourceId, sourceType, targetId, targetType, relationType)
    }

    /**
     * 获取实体的所有出向关系
     */
    getOutgoing(entityId: number, entityType: EntityType): Relation[] {
        return this.relationRepo.find({
            sourceId: entityId,
            sourceType: entityType,
        })
    }

    /**
     * 获取实体的所有入向关系
     */
    getIncoming(entityId: number, entityType: EntityType): Relation[] {
        return this.relationRepo.find({
            targetId: entityId,
            targetType: entityType,
        })
    }
}
