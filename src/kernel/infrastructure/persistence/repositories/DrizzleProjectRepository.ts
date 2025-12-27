import { eq } from 'drizzle-orm'
import type { DrizzleDB } from '../database'
import { schema } from '../database'
import type { IProjectRepository } from '../../../domain/repositories/IProjectRepository'
import type { Project, CreateProjectInput, UpdateProjectInput } from '../../../domain/entities/Project'

export class DrizzleProjectRepository implements IProjectRepository {
    constructor(private db: DrizzleDB) { }

    create(input: CreateProjectInput): Project {
        const now = new Date()

        const project = this.db
            .insert(schema.projects)
            .values({
                name: input.name,
                description: input.description ?? null,
                color: input.color ?? null,
                icon: input.icon ?? null,
                extra: input.extra ?? null,
                createdAt: now,
                updatedAt: now,
            })
            .returning()
            .get()

        return project
    }

    getById(id: number): Project | undefined {
        return this.db
            .select()
            .from(schema.projects)
            .where(eq(schema.projects.id, id))
            .get()
    }

    getAll(): Project[] {
        return this.db
            .select()
            .from(schema.projects)
            .orderBy(schema.projects.updatedAt)
            .all()
    }

    update(input: UpdateProjectInput): Project | undefined {
        const existing = this.getById(input.id)
        if (!existing) return undefined

        const updateData: Partial<typeof schema.projects.$inferInsert> = {
            updatedAt: new Date(),
        }

        if (input.name !== undefined) updateData.name = input.name
        if (input.description !== undefined) updateData.description = input.description
        if (input.color !== undefined) updateData.color = input.color
        if (input.icon !== undefined) updateData.icon = input.icon
        if (input.extra !== undefined) updateData.extra = input.extra

        return this.db
            .update(schema.projects)
            .set(updateData)
            .where(eq(schema.projects.id, input.id))
            .returning()
            .get()
    }

    delete(id: number): boolean {
        const result = this.db
            .delete(schema.projects)
            .where(eq(schema.projects.id, id))
            .returning()
            .get()
        return !!result
    }
}
