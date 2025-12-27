import type { IRelationRepository } from '../../domain/repositories/IRelationRepository'
import type { Relation, CreateRelationInput, RelationQuery, EntityType, RelationType } from '../../domain/entities/Relation'

/**
 * Mock 关系仓储 - 用于单元测试
 */
export class MockRelationRepository implements IRelationRepository {
    private relations: Map<number, Relation> = new Map()
    private nextId = 1

    create(input: CreateRelationInput): Relation {
        const id = this.nextId++
        const now = new Date()

        const relation: Relation = {
            id,
            sourceId: input.sourceId,
            sourceType: input.sourceType,
            targetId: input.targetId,
            targetType: input.targetType,
            relationType: input.relationType,
            meta: input.meta ?? null,
            createdAt: now,
        }

        this.relations.set(id, relation)
        return relation
    }

    getById(id: number): Relation | undefined {
        return this.relations.get(id)
    }

    find(query: RelationQuery): Relation[] {
        const result: Relation[] = []

        for (const relation of this.relations.values()) {
            let match = true

            if (query.sourceId !== undefined && relation.sourceId !== query.sourceId) match = false
            if (query.sourceType !== undefined && relation.sourceType !== query.sourceType) match = false
            if (query.targetId !== undefined && relation.targetId !== query.targetId) match = false
            if (query.targetType !== undefined && relation.targetType !== query.targetType) match = false
            if (query.relationType !== undefined && relation.relationType !== query.relationType) match = false

            if (match) result.push(relation)
        }

        return result
    }

    delete(id: number): boolean {
        return this.relations.delete(id)
    }

    deleteBySource(sourceId: number, sourceType: EntityType): number {
        let count = 0
        for (const [id, relation] of this.relations) {
            if (relation.sourceId === sourceId && relation.sourceType === sourceType) {
                this.relations.delete(id)
                count++
            }
        }
        return count
    }

    deleteByTarget(targetId: number, targetType: EntityType): number {
        let count = 0
        for (const [id, relation] of this.relations) {
            if (relation.targetId === targetId && relation.targetType === targetType) {
                this.relations.delete(id)
                count++
            }
        }
        return count
    }

    exists(
        sourceId: number,
        sourceType: EntityType,
        targetId: number,
        targetType: EntityType,
        relationType: RelationType
    ): boolean {
        for (const relation of this.relations.values()) {
            if (
                relation.sourceId === sourceId &&
                relation.sourceType === sourceType &&
                relation.targetId === targetId &&
                relation.targetType === targetType &&
                relation.relationType === relationType
            ) {
                return true
            }
        }
        return false
    }

    // 测试辅助方法
    clear(): void {
        this.relations.clear()
        this.nextId = 1
    }

    getAll(): Relation[] {
        return Array.from(this.relations.values())
    }
}
