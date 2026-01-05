/**
 * Skill 类型定义
 */

/**
 * Skill 定义接口
 */
export interface SkillDefinition {
  /** 唯一标识符 */
  id: string
  /** Skill 名称（从 frontmatter 解析） */
  name: string
  /** Skill 描述（从 frontmatter 解析） */
  description: string
  /** 准入工具列表（从 frontmatter 解析，可选） */
  tools?: string[]
  /** 完整的原始内容（包含 frontmatter） */
  rawContent: string
  /** Skill 正文（frontmatter 之后的内容） */
  body: string
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

/**
 * Skill 摘要（用于列表展示）
 */
export interface SkillSummary {
  id: string
  name: string
  description: string
  tools?: string[]
}

/**
 * 解析 Skill 内容的结果
 */
export interface ParsedSkill {
  name: string
  description: string
  tools?: string[]
  body: string
}

/**
 * Frontmatter 正则表达式
 * 匹配格式：
 * ---
 * name: xxx
 * description: xxx
 * ---
 */
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)/

/**
 * 解析 Skill 的 frontmatter 和正文
 */
export function parseSkillContent(content: string): ParsedSkill | { error: string } {
  const trimmed = content.trim()
  
  if (!trimmed.startsWith('---')) {
    return { error: '内容必须以 "---" 开头' }
  }

  const match = trimmed.match(FRONTMATTER_REGEX)
  if (!match) {
    return { error: '无法解析 frontmatter，请确保格式正确（需要有开始和结束的 ---）' }
  }

  const frontmatter = match[1]
  const body = match[2]?.trim() || ''

  // 解析 YAML 格式的 frontmatter
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m)
  const toolsMatch = frontmatter.match(/^tools:\s*(.+)$/m)

  if (!nameMatch) {
    return { error: 'frontmatter 中缺少 name 字段' }
  }

  if (!descMatch) {
    return { error: 'frontmatter 中缺少 description 字段' }
  }

  const name = nameMatch[1].trim()
  const description = descMatch[1].trim()
  const tools = toolsMatch ? toolsMatch[1].split(',').map(t => t.trim()).filter(t => !!t) : undefined

  if (!name) {
    return { error: 'name 不能为空' }
  }

  if (!description) {
    return { error: 'description 不能为空' }
  }

  return { name, description, tools, body }
}

/**
 * 验证解析结果是否有错误
 */
export function isParseError(result: ParsedSkill | { error: string }): result is { error: string } {
  return 'error' in result
}

