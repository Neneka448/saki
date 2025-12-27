import { eq, and } from 'drizzle-orm'
import type { DrizzleDB } from '../database'
import { schema } from '../database'
import type { IRelationRepository } from '../../../domain/repositories/IRelationRepository'
import type { Relation, CreateRelationInput, RelationQuery, EntityType, RelationType } from '../../../domain/entities/Relation'

/**
 * Drizzle 实现的关系仓储
 */
export class DrizzleRelationRepository implements IRelationRepository {
    constructor(private db: DrizzleDB) { }

    create(input: CreateRelationInput): Relation {
        const now = new Date()

        const result = this.db
            .insert(schema.relations)
            .values({
                sourceId: input.sourceId,
                sourceType: input.sourceType,
                targetId: input.targetId,
                targetType: input.targetType,
                relationType: input.relationType,
                meta: input.meta,
                createdAt: now,
            })
            .returning()
            .get()

        return {
            id: result.id,
            sourceId: result.sourceId,
            sourceType: result.sourceType,
            targetId: result.targetId,
            targetType: result.targetType,
            relationType: result.relationType,
            meta: result.meta,
            createdAt: result.createdAt,
        }
    }

    getById(id: number): Relation | undefined {
        const result = this.db.select().from(schema.relations).where(eq(schema.relations.id, id)).get()
        if (!result) return undefined

        return {
            id: result.id,
            sourceId: result.sourceId,
            sourceType: result.sourceType,
            targetId: result.targetId,
            targetType: result.targetType,
            relationType: result.relationType,
            meta: result.meta,
            createdAt: result.createdAt,
        }
    }

    find(query: RelationQuery): Relation[] {
        const conditions = []

        if (query.sourceId !== undefined) {
            conditions.push(eq(schema.relations.sourceId, query.sourceId))
        }
        if (query.sourceType !== undefined) {
            conditions.push(eq(schema.relations.sourceType, query.sourceType))
        }
        if (query.targetId !== undefined) {
            conditions.push(eq(schema.relations.targetId, query.targetId))
        }
        if (query.targetType !== undefined) {
            conditions.push(eq(schema.relations.targetType, query.targetType))
        }
        if (query.relationType !== undefined) {
            conditions.push(eq(schema.relations.relationType, query.relationType))
        }

        let results
        if (conditions.length === 0) {
            results = this.db.select().from(schema.relations).all()
        } else {
            results = this.db
                .select()
                .from(schema.relations)
                .where(and(...conditions))
                .all()
        }

        return results.map((r) => ({
            id: r.id,
            sourceId: r.sourceId,
            sourceType: r.sourceType,
            targetId: r.targetId,
            targetType: r.targetType,
            relationType: r.relationType,
            meta: r.meta,
            createdAt: r.createdAt,
        }))
    }

    delete(id: number): boolean {
        const result = this.db.delete(schema.relations).where(eq(schema.relations.id, id)).run()
        return result.changes > 0
    }

    deleteBySource(sourceId: number, sourceType: EntityType): number {
        const result = this.db
            .delete(schema.relations)
            .where(and(eq(schema.relations.sourceId, sourceId), eq(schema.relations.sourceType, sourceType)))
            .run()
        return result.changes
    }

    deleteByTarget(targetId: number, targetType: EntityType): number {
        const result = this.db
            .delete(schema.relations)
            .where(and(eq(schema.relations.targetId, targetId), eq(schema.relations.targetType, targetType)))
            .run()
        return result.changes
    }

    exists(
        sourceId: number,
        sourceType: EntityType,
        targetId: number,
        targetType: EntityType,
        relationType: RelationType
    ): boolean {
        const relations = this.find({
            sourceId,
            sourceType,
            targetId,
            targetType,
            relationType,
        })
        return relations.length > 0
    }
}
