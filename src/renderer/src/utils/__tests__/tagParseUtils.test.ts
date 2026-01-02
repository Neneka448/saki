import { describe, it, expect } from 'vitest'
import {
  parseTagsFromContent,
  extractUniqueTagNames,
  isValidTagName,
  detectTagTrigger,
} from '../tagParseUtils'

describe('tagParseUtils', () => {
  describe('parseTagsFromContent', () => {
    it('should parse simple tag', () => {
      const result = parseTagsFromContent('这是一个 #标签 测试')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('标签')
    })

    it('should parse multiple tags', () => {
      const result = parseTagsFromContent('#tag1 和 #tag2 以及 #tag3')
      expect(result).toHaveLength(3)
      expect(result.map(t => t.name)).toEqual(['tag1', 'tag2', 'tag3'])
    })

    it('should parse nested tags with slash', () => {
      const result = parseTagsFromContent('#src/core/reactivity')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('src/core/reactivity')
    })

    it('should NOT parse Markdown headings', () => {
      const result = parseTagsFromContent('# 这是标题')
      expect(result).toHaveLength(0)
    })

    it('should NOT parse multi-level Markdown headings', () => {
      const result = parseTagsFromContent('## 二级标题\n### 三级标题')
      expect(result).toHaveLength(0)
    })

    it('should parse tag at line start', () => {
      const result = parseTagsFromContent('#mytag 开始')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('mytag')
    })

    it('should parse tag after newline', () => {
      const result = parseTagsFromContent('第一行\n#tag 第二行')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('tag')
    })

    it('should NOT parse # in the middle of word', () => {
      const result = parseTagsFromContent('C#语言')
      expect(result).toHaveLength(0)
    })

    it('should handle mixed content', () => {
      const content = `# 标题

这是正文 #标签1

## 二级标题
内容 #标签2 更多 #嵌套/标签`
      const result = parseTagsFromContent(content)
      expect(result).toHaveLength(3)
      expect(result.map(t => t.name)).toEqual(['标签1', '标签2', '嵌套/标签'])
    })

    it('should return correct positions', () => {
      const content = '测试 #tag 文字'
      const result = parseTagsFromContent(content)
      expect(result).toHaveLength(1)
      expect(content.slice(result[0].start, result[0].end)).toBe('#tag')
    })

    it('should NOT parse tags inside code blocks', () => {
      const content = '```\n#codeTag\n```\n正常 #normalTag'
      const result = parseTagsFromContent(content)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('normalTag')
    })

    it('should NOT parse tags inside inline code', () => {
      const content = '这是 `#inlineCode` 和正常的 #tag'
      const result = parseTagsFromContent(content)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('tag')
    })
  })

  describe('extractUniqueTagNames', () => {
    it('should return unique tag names', () => {
      const result = extractUniqueTagNames('#tag1 #tag2 #tag1 #tag3')
      expect(result).toHaveLength(3)
      expect(result).toContain('tag1')
      expect(result).toContain('tag2')
      expect(result).toContain('tag3')
    })

    it('should return empty array for no tags', () => {
      const result = extractUniqueTagNames('# 这是标题')
      expect(result).toHaveLength(0)
    })
  })

  describe('isValidTagName', () => {
    it('should accept valid tag names', () => {
      expect(isValidTagName('tag')).toBe(true)
      expect(isValidTagName('标签')).toBe(true)
      expect(isValidTagName('tag123')).toBe(true)
      expect(isValidTagName('tag-name')).toBe(true)
      expect(isValidTagName('tag_name')).toBe(true)
      expect(isValidTagName('src/core/reactivity')).toBe(true)
      expect(isValidTagName('v3')).toBe(true)
    })

    it('should reject invalid tag names', () => {
      expect(isValidTagName('')).toBe(false)
      expect(isValidTagName('/tag')).toBe(false)
      expect(isValidTagName('tag/')).toBe(false)
      expect(isValidTagName('tag//name')).toBe(false)
    })

    it('should reject tag names starting with number', () => {
      expect(isValidTagName('3')).toBe(false)
      expect(isValidTagName('123')).toBe(false)
      expect(isValidTagName('0')).toBe(false)
      expect(isValidTagName('2啊')).toBe(false)
      expect(isValidTagName('3d')).toBe(false)
    })

    it('should reject too long tag names', () => {
      expect(isValidTagName('a'.repeat(101))).toBe(false)
    })
  })

  describe('detectTagTrigger', () => {
    it('should detect tag input at cursor', () => {
      const content = '测试 #ta'
      const result = detectTagTrigger(content, content.length)
      expect(result.active).toBe(true)
      expect(result.query).toBe('ta')
    })

    it('should detect empty tag trigger', () => {
      const content = '测试 #'
      const result = detectTagTrigger(content, content.length)
      expect(result.active).toBe(true)
      expect(result.query).toBe('')
    })

    it('should NOT trigger after space', () => {
      const content = '测试 #tag 后面'
      const result = detectTagTrigger(content, content.length)
      expect(result.active).toBe(false)
    })

    it('should trigger at line start', () => {
      const content = '#tag'
      const result = detectTagTrigger(content, content.length)
      expect(result.active).toBe(true)
      expect(result.query).toBe('tag')
    })

    it('should trigger after newline', () => {
      const content = '第一行\n#tag'
      const result = detectTagTrigger(content, content.length)
      expect(result.active).toBe(true)
      expect(result.query).toBe('tag')
    })
  })
})
