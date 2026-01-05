import type { ISkillRepository } from '../../domain/repositories/ISkillRepository'
import type { SkillDefinition } from '../../../shared/skills/types'

export class MockSkillRepository implements ISkillRepository {
    private skills: Map<string, SkillDefinition> = new Map()

    create(skill: SkillDefinition): void {
        this.skills.set(skill.id, skill)
    }

    update(skill: SkillDefinition): void {
        this.skills.set(skill.id, skill)
    }

    delete(id: string): void {
        this.skills.delete(id)
    }

    findById(id: string): SkillDefinition | null {
        return this.skills.get(id) || null
    }

    findByName(name: string): SkillDefinition | null {
        for (const skill of this.skills.values()) {
            if (skill.name === name) return skill
        }
        return null
    }

    findAll(): SkillDefinition[] {
        return Array.from(this.skills.values())
    }
}
