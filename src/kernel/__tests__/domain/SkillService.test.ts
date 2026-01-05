import { describe, it, expect, beforeEach } from 'vitest'
import { SkillService } from '../../domain/services/SkillService'
import { MockSkillRepository } from '../mocks/MockSkillRepository'

describe('SkillService', () => {
    let service: SkillService
    let repo: MockSkillRepository

    beforeEach(() => {
        repo = new MockSkillRepository()
        service = new SkillService(repo)
    })

    it('should create a skill', () => {
        const content = '---\nname: test-skill\ndescription: test desc\n---\nbody content'
        const result = service.create(content)
        
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.name).toBe('test-skill')
            expect(result.data.description).toBe('test desc')
            expect(result.data.body).toBe('body content')
        }
    })

    it('should fail if name is duplicate', () => {
        const content = '---\nname: test-skill\ndescription: test desc\n---\nbody content'
        service.create(content)
        
        const result = service.create(content)
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error).toContain('已被使用')
        }
    })

    it('should update a skill', () => {
        const content = '---\nname: test-skill\ndescription: test desc\n---\nbody content'
        const createResult = service.create(content)
        
        if (createResult.success) {
            const newContent = '---\nname: updated-skill\ndescription: updated desc\n---\nupdated body'
            const updateResult = service.update(createResult.data.id, newContent)
            
            expect(updateResult.success).toBe(true)
            if (updateResult.success) {
                expect(updateResult.data.name).toBe('updated-skill')
                expect(updateResult.data.body).toBe('updated body')
            }
        }
    })

    it('should generate prompt XML with multiple skills and correct structure', () => {
        service.create('---\nname: skill-1\ndescription: desc 1\n---\nbody 1')
        service.create('---\nname: skill-2\ndescription: desc 2\n---\nbody 2')
        service.create('---\nname: skill-3\ndescription: desc 3\n---\nbody 3')
        
        const xml = service.getPromptXml()
        
        // 严格校验结构
        const expected = 
`<skills>
  <skill>
    <name>skill-1</name>
    <description>desc 1</description>
  </skill>
  <skill>
    <name>skill-2</name>
    <description>desc 2</description>
  </skill>
  <skill>
    <name>skill-3</name>
    <description>desc 3</description>
  </skill>
</skills>`
        
        expect(xml).toBe(expected)
        
        // 进一步确保 XML 标签成对出现且顺序正确
        expect(xml.startsWith('<skills>')).toBe(true)
        expect(xml.endsWith('</skills>')).toBe(true)
        const skillMatches = xml.match(/<skill>/g)
        expect(skillMatches).toHaveLength(3)
    })

    it('should return empty string for prompt XML when no skills exist', () => {
        const xml = service.getPromptXml()
        expect(xml).toBe('')
    })

    it('should handle special characters in prompt XML', () => {
        service.create('---\nname: <special>\ndescription: "quoted" & text\n---\nbody')
        const xml = service.getPromptXml()
        expect(xml).toContain('<name><special></name>')
        expect(xml).toContain('<description>"quoted" & text</description>')
    })

    it('should format activated skill', () => {
        const result = service.create('---\nname: test-skill\ndescription: test desc\n---\nbody content')
        if (result.success) {
            const formatted = service.formatActivatedSkill(result.data)
            expect(formatted).toBe('<ACTIVATED_SKILL name="test-skill">\n  <INSTRUCTIONS>\n    body content\n  </INSTRUCTIONS>\n</ACTIVATED_SKILL>')
        }
    })

    it('should return all skill names', () => {
        service.create('---\nname: skill-a\ndescription: desc a\n---\nbody a')
        service.create('---\nname: skill-b\ndescription: desc b\n---\nbody b')
        
        const names = service.getNames()
        expect(names).toHaveLength(2)
        expect(names).toContain('skill-a')
        expect(names).toContain('skill-b')
    })
})
