import { eq } from 'drizzle-orm'
import type { DrizzleDB } from '../database'
import { skills } from '../schema'
import type { ISkillRepository } from '../../../domain/repositories/ISkillRepository'
import type { SkillDefinition } from '../../../../shared/skills/types'

export class DrizzleSkillRepository implements ISkillRepository {
    constructor(private db: DrizzleDB) {}

    create(skill: SkillDefinition): void {
        this.db.insert(skills).values({
            id: skill.id,
            name: skill.name,
            description: skill.description,
            rawContent: skill.rawContent,
            body: skill.body,
            createdAt: new Date(skill.createdAt),
            updatedAt: new Date(skill.updatedAt),
        }).run()
    }

    update(skill: SkillDefinition): void {
        this.db.update(skills)
            .set({
                name: skill.name,
                description: skill.description,
                rawContent: skill.rawContent,
                body: skill.body,
                updatedAt: new Date(skill.updatedAt),
            })
            .where(eq(skills.id, skill.id))
            .run()
    }

    delete(id: string): void {
        this.db.delete(skills).where(eq(skills.id, id)).run()
    }

    findById(id: string): SkillDefinition | null {
        const result = this.db.select().from(skills).where(eq(skills.id, id)).get()
        if (!result) return null
        return this.mapToDomain(result)
    }

    findByName(name: string): SkillDefinition | null {
        const result = this.db.select().from(skills).where(eq(skills.name, name)).get()
        if (!result) return null
        return this.mapToDomain(result)
    }

    findAll(): SkillDefinition[] {
        const results = this.db.select().from(skills).all()
        return results.map(this.mapToDomain)
    }

    private mapToDomain(row: typeof skills.$inferSelect): SkillDefinition {
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            rawContent: row.rawContent,
            body: row.body,
            createdAt: row.createdAt.getTime(),
            updatedAt: row.updatedAt.getTime(),
        }
    }
}
