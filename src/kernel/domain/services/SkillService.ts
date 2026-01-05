import crypto from 'crypto'
import type { ISkillRepository } from '../repositories/ISkillRepository'
import type { SkillDefinition, SkillSummary, ParsedSkill } from '../../../shared/skills/types'
import { parseSkillContent, isParseError } from '../../../shared/skills/types'
import { type Result, ok, err } from '../../api/Result'

export class SkillService {
    private cachedPromptXml: string | null = null

    constructor(private skillRepo: ISkillRepository) { }

    getAll(): SkillDefinition[] {
        return this.skillRepo.findAll()
    }

    getSummaries(): SkillSummary[] {
        return this.getAll().map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
            tools: s.tools
        }))
    }

    getById(id: string): SkillDefinition | null {
        return this.skillRepo.findById(id)
    }

    getByName(name: string): SkillDefinition | null {
        return this.skillRepo.findByName(name)
    }

    validateContent(content: string, excludeId?: string): Result<ParsedSkill> {
        const result = parseSkillContent(content)

        if (isParseError(result)) {
            return err(result.error)
        }

        const existing = this.skillRepo.findByName(result.name)
        if (existing && existing.id !== excludeId) {
            return err(`名称 "${result.name}" 已被使用`)
        }

        return ok(result)
    }

    create(content: string): Result<SkillDefinition> {
        const validation = this.validateContent(content)
        if (!validation.success) {
            return err(validation.error)
        }

        const now = Date.now()
        const skill: SkillDefinition = {
            id: crypto.randomUUID(),
            name: validation.data.name,
            description: validation.data.description,
            tools: validation.data.tools,
            rawContent: content,
            body: validation.data.body,
            createdAt: now,
            updatedAt: now,
        }

        try {
            this.skillRepo.create(skill)
            this.cachedPromptXml = null
            return ok(skill)
        } catch (e) {
            return err(`创建失败: ${e}`)
        }
    }

    update(id: string, content: string): Result<SkillDefinition> {
        const existing = this.skillRepo.findById(id)
        if (!existing) {
            return err('未找到该 Skill')
        }

        const validation = this.validateContent(content, id)
        if (!validation.success) {
            return err(validation.error)
        }

        const updated: SkillDefinition = {
            ...existing,
            name: validation.data.name,
            description: validation.data.description,
            tools: validation.data.tools,
            rawContent: content,
            body: validation.data.body,
            updatedAt: Date.now(),
        }

        try {
            this.skillRepo.update(updated)
            this.cachedPromptXml = null
            return ok(updated)
        } catch (e) {
            return err(`更新失败: ${e}`)
        }
    }

    delete(id: string): Result<void> {
        try {
            this.skillRepo.delete(id)
            this.cachedPromptXml = null
            return ok(undefined)
        } catch (e) {
            return err(`删除失败: ${e}`)
        }
    }

    getPromptXml(): string {
        if (this.cachedPromptXml === null) {
            this.cachedPromptXml = this.formatSkillsForPrompt(this.getSummaries())
        }
        return this.cachedPromptXml
    }

    getNames(): string[] {
        return this.getAll().map(s => s.name)
    }

    /**
     * 生成 Skill 的 XML 格式（用于系统提示词）
     */
    private formatSkillsForPrompt(skills: SkillSummary[]): string {
        if (skills.length === 0) return ''

        const skillsXml = skills
            .map(
                (skill) => `  <skill>
    <name>${skill.name}</name>
    <description>${skill.description}</description>
  </skill>`
            )
            .join('\n')

        return `<skills>\n${skillsXml}\n</skills>`
    }

    /**
     * 生成激活 Skill 后返回给模型的内容
     */
    formatActivatedSkill(skill: SkillDefinition): string {
        return `<ACTIVATED_SKILL name="${skill.name}">
  <INSTRUCTIONS>
    ${skill.body}
  </INSTRUCTIONS>
</ACTIVATED_SKILL>`
    }
}
