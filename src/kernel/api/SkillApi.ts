import type { SkillService } from '../domain/services/SkillService'
import type { SkillDefinition, SkillSummary, ParsedSkill } from '../../shared/skills/types'
import type { Result } from './Result'

export class SkillApi {
    constructor(private service: SkillService) {}

    getAll(): Result<SkillDefinition[]> {
        return { success: true, data: this.service.getAll() }
    }

    getSummaries(): Result<SkillSummary[]> {
        return { success: true, data: this.service.getSummaries() }
    }

    getById(id: string): Result<SkillDefinition | null> {
        return { success: true, data: this.service.getById(id) }
    }

    getByName(name: string): Result<SkillDefinition | null> {
        return { success: true, data: this.service.getByName(name) }
    }

    validate(content: string, excludeId?: string): Result<ParsedSkill> {
        return this.service.validateContent(content, excludeId)
    }

    create(content: string): Result<SkillDefinition> {
        return this.service.create(content)
    }

    update(id: string, content: string): Result<SkillDefinition> {
        return this.service.update(id, content)
    }

    delete(id: string): Result<void> {
        return this.service.delete(id)
    }

    getPromptXml(): Result<string> {
        return { success: true, data: this.service.getPromptXml() }
    }

    getNames(): Result<string[]> {
        return { success: true, data: this.service.getNames() }
    }

    formatActivatedSkill(skill: SkillDefinition): Result<string> {
        return { success: true, data: this.service.formatActivatedSkill(skill) }
    }
}
