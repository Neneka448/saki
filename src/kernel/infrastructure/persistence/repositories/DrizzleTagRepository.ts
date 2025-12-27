import { eq, and } from 'drizzle-orm'
import type { DrizzleDB } from '../database'
import { schema } from '../database'
import type { ITagRepository } from '../../../domain/repositories/ITagRepository'
import type { Tag, TagWithMeta, TagMeta, CreateTagInput, UpdateTagInput, UpdateTagMetaInput } from '../../../domain/entities/Tag'

/**
 * Drizzle 实现的标签仓储
 */
export class DrizzleTagRepository implements ITagRepository {
    constructor(private db: DrizzleDB) { }

    create(input: CreateTagInput): TagWithMeta {
        const now = new Date()

        const tag = this.db
            .insert(schema.tags)
            .values({
                projectId: input.projectId,
                name: input.name,
                namespace: input.namespace ?? 'user',
                color: input.color,
                createdAt: now,
            })
            .returning()
            .get()

        let tagMeta: typeof schema.tagMetas.$inferSelect | null = null
        if (input.meta?.description || input.meta?.icon || input.meta?.extra) {
            tagMeta = this.db
                .insert(schema.tagMetas)
                .values({
                    tagId: tag.id,
                    description: input.meta.description ?? null,
                    icon: input.meta.icon ?? null,
                    extra: input.meta.extra ?? null,
                })
                .returning()
                .get()
        }

        return {
            ...tag,
            description: tagMeta?.description ?? null,
            icon: tagMeta?.icon ?? null,
            extra: tagMeta?.extra ?? null,
        }
    }

    getById(id: number): TagWithMeta | undefined {
        const tag = this.db.select().from(schema.tags).where(eq(schema.tags.id, id)).get()
        if (!tag) return undefined

        const meta = this.db.select().from(schema.tagMetas).where(eq(schema.tagMetas.tagId, id)).get()

        return {
            ...tag,
            description: meta?.description ?? null,
            icon: meta?.icon ?? null,
            extra: meta?.extra ?? null,
        }
    }

    getByName(projectId: number, name: string, namespace: string = 'user'): TagWithMeta | undefined {
        const tag = this.db
            .select()
            .from(schema.tags)
            .where(and(
                eq(schema.tags.projectId, projectId),
                eq(schema.tags.name, name),
                eq(schema.tags.namespace, namespace)
            ))
            .get()

        if (!tag) return undefined

        const meta = this.db.select().from(schema.tagMetas).where(eq(schema.tagMetas.tagId, tag.id)).get()

        return {
            ...tag,
            description: meta?.description ?? null,
            icon: meta?.icon ?? null,
            extra: meta?.extra ?? null,
        }
    }

    getAllUserTags(projectId: number): TagWithMeta[] {
        const results = this.db
            .select({
                id: schema.tags.id,
                projectId: schema.tags.projectId,
                name: schema.tags.name,
                namespace: schema.tags.namespace,
                color: schema.tags.color,
                createdAt: schema.tags.createdAt,
                description: schema.tagMetas.description,
                icon: schema.tagMetas.icon,
                extra: schema.tagMetas.extra,
            })
            .from(schema.tags)
            .leftJoin(schema.tagMetas, eq(schema.tags.id, schema.tagMetas.tagId))
            .where(and(eq(schema.tags.projectId, projectId), eq(schema.tags.namespace, 'user')))
            .all()

        return results
    }

    getByNamespace(projectId: number, namespace: string): TagWithMeta[] {
        const results = this.db
            .select({
                id: schema.tags.id,
                projectId: schema.tags.projectId,
                name: schema.tags.name,
                namespace: schema.tags.namespace,
                color: schema.tags.color,
                createdAt: schema.tags.createdAt,
                description: schema.tagMetas.description,
                icon: schema.tagMetas.icon,
                extra: schema.tagMetas.extra,
            })
            .from(schema.tags)
            .leftJoin(schema.tagMetas, eq(schema.tags.id, schema.tagMetas.tagId))
            .where(and(eq(schema.tags.projectId, projectId), eq(schema.tags.namespace, namespace)))
            .all()

        return results
    }

    update(id: number, input: UpdateTagInput): Tag | undefined {
        const result = this.db
            .update(schema.tags)
            .set(input)
            .where(eq(schema.tags.id, id))
            .returning()
            .get()

        return result
    }

    updateMeta(tagId: number, meta: UpdateTagMetaInput): TagMeta | undefined {
        const existing = this.db.select().from(schema.tagMetas).where(eq(schema.tagMetas.tagId, tagId)).get()

        let result: typeof schema.tagMetas.$inferSelect
        if (existing) {
            result = this.db
                .update(schema.tagMetas)
                .set(meta)
                .where(eq(schema.tagMetas.tagId, tagId))
                .returning()
                .get()!
        } else {
            result = this.db
                .insert(schema.tagMetas)
                .values({ tagId, ...meta })
                .returning()
                .get()
        }

        return {
            tagId: result.tagId,
            description: result.description,
            icon: result.icon,
            extra: result.extra,
        }
    }

    delete(id: number): boolean {
        this.db.delete(schema.tagMetas).where(eq(schema.tagMetas.tagId, id)).run()
        const result = this.db.delete(schema.tags).where(eq(schema.tags.id, id)).run()
        return result.changes > 0
    }

    deleteByProject(projectId: number): number {
        const tags = this.db.select({ id: schema.tags.id }).from(schema.tags).where(eq(schema.tags.projectId, projectId)).all()
        for (const tag of tags) {
            this.db.delete(schema.tagMetas).where(eq(schema.tagMetas.tagId, tag.id)).run()
        }
        const result = this.db.delete(schema.tags).where(eq(schema.tags.projectId, projectId)).run()
        return result.changes
    }
}
