import type { SkillDefinition } from '../../../shared/skills/types'

export interface ISkillRepository {
    create(skill: SkillDefinition): void
    update(skill: SkillDefinition): void
    delete(id: string): void
    findById(id: string): SkillDefinition | null
    findByName(name: string): SkillDefinition | null
    findAll(): SkillDefinition[]
}
