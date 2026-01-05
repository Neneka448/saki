import type { CardListItem, CardDetail, TagWithUsageCount } from '../../../shared/ipc/types'

export interface ToolSchema {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ToolExecutionResult {
  output: unknown
}

export interface ToolContext {
  projectId: number
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (input: Record<string, unknown>, context: ToolContext) => Promise<ToolExecutionResult>
}

const SEARCH_CONTEXT_RADIUS = 25
const SEARCH_RESULT_LIMIT = 10
const LIST_PREVIEW_LENGTH = 50
const LIST_MAX_PAGE_SIZE = 50

const normalizeText = (value: string) => value.toLowerCase()

const compactText = (value: string) => value.replace(/\s+/g, ' ').trim()

const clampPositiveInt = (value: unknown, fallback: number, max?: number) => {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  const floored = Math.floor(numeric)
  if (typeof max === 'number') return Math.min(floored, max)
  return floored
}

const buildMatchSnippet = (text: string, matchIndex: number, matchLength: number, radius: number) => {
  const start = Math.max(0, matchIndex - radius)
  const end = Math.min(text.length, matchIndex + matchLength + radius)
  return compactText(text.slice(start, end))
}

const buildPreview = (text: string, length: number) => compactText(text.slice(0, length))

const getCurrentTimeTool: ToolDefinition = {
  name: 'get_current_time',
  description: '获取当前时间与时区信息',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    return {
      output: {
        iso: new Date().toISOString(),
        locale: new Date().toLocaleString('zh-CN'),
      },
    }
  },
}

const listTagsTool: ToolDefinition = {
  name: 'list_tags',
  description: '获取当前项目的标签列表及使用次数',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async (_input, context) => {
    const result = await window.tag.getAllWithUsageCount(context.projectId)
    if (!result.success) {
      return { output: { error: result.error } }
    }
    const tags: TagWithUsageCount[] = result.data
    return {
      output: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        usageCount: tag.usageCount,
      })),
    }
  },
}

const searchCardsTool: ToolDefinition = {
  name: 'search_cards',
  description: '根据关键词模糊搜索当前项目卡片（标题与全文），返回前 10 条，包含标题、ID 与命中内容前后 25 个字符',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索关键词' },
      limit: { type: 'number', description: '返回数量上限（默认 10，最大 10）', default: 10 },
    },
    required: ['query'],
  },
  execute: async (input, context) => {
    const rawQuery = String(input.query ?? '').trim()
    const query = normalizeText(rawQuery)
    const limit = clampPositiveInt(input.limit, SEARCH_RESULT_LIMIT, SEARCH_RESULT_LIMIT)
    if (!query) return { output: [] }
    const result = await window.card.getListByProject(context.projectId)
    if (!result.success) {
      return { output: { error: result.error } }
    }
    const cards: CardListItem[] = result.data
    const matched: Array<{ id: number; title: string | null; snippet: string }> = []
    const pending: CardListItem[] = []

    for (const card of cards) {
      if (matched.length >= limit) break
      const title = card.title ?? ''
      const titleIndex = normalizeText(title).indexOf(query)
      if (titleIndex >= 0) {
        matched.push({
          id: card.id,
          title: card.title,
          snippet: buildMatchSnippet(title, titleIndex, query.length, SEARCH_CONTEXT_RADIUS),
        })
        continue
      }
      const summary = card.summary ?? ''
      const summaryIndex = normalizeText(summary).indexOf(query)
      if (summaryIndex >= 0) {
        matched.push({
          id: card.id,
          title: card.title,
          snippet: buildMatchSnippet(summary, summaryIndex, query.length, SEARCH_CONTEXT_RADIUS),
        })
        continue
      }
      pending.push(card)
    }

    if (matched.length < limit && pending.length > 0) {
      const batchSize = 10
      for (let i = 0; i < pending.length && matched.length < limit; i += batchSize) {
        const batch = pending.slice(i, i + batchSize)
        const detailResults = await Promise.all(batch.map((card) => window.card.getById(card.id)))
        detailResults.forEach((detailResult, index) => {
          if (matched.length >= limit) return
          if (!detailResult.success) return
          const detail = detailResult.data
          const content = detail.content ?? ''
          const contentIndex = normalizeText(content).indexOf(query)
          if (contentIndex >= 0) {
            matched.push({
              id: detail.id,
              title: detail.title ?? batch[index]?.title ?? null,
              snippet: buildMatchSnippet(content, contentIndex, query.length, SEARCH_CONTEXT_RADIUS),
            })
          }
        })
      }
    }

    return { output: matched }
  },
}

const listCardsTool: ToolDefinition = {
  name: 'list_cards',
  description: '列出当前项目的卡片分页列表（默认 pageNo=1，pageSize=10），仅返回标题、ID 与前 50 个字符',
  parameters: {
    type: 'object',
    properties: {
      pageNo: { type: 'number', description: '页码，从 1 开始（默认 1）', default: 1 },
      pageSize: { type: 'number', description: '每页数量（默认 10）', default: 10 },
    },
  },
  execute: async (input, context) => {
    const pageNo = clampPositiveInt(input.pageNo, 1)
    const pageSize = clampPositiveInt(input.pageSize, 10, LIST_MAX_PAGE_SIZE)
    const result = await window.card.getListByProject(context.projectId)
    if (!result.success) {
      return { output: { error: result.error } }
    }
    const cards: CardListItem[] = result.data
    const startIndex = (pageNo - 1) * pageSize
    const pageCards = cards.slice(startIndex, startIndex + pageSize)
    const detailResults = await Promise.all(pageCards.map((card) => window.card.getById(card.id)))
    const output = detailResults.map((detailResult, index) => {
      const fallback = pageCards[index]
      if (!detailResult.success) {
        return {
          id: fallback?.id ?? 0,
          title: fallback?.title ?? null,
          preview: fallback?.summary ? buildPreview(fallback.summary, LIST_PREVIEW_LENGTH) : '',
        }
      }
      const detail = detailResult.data
      return {
        id: detail.id,
        title: detail.title ?? fallback?.title ?? null,
        preview: buildPreview(detail.content ?? '', LIST_PREVIEW_LENGTH),
      }
    })
    return { output }
  },
}

const getCardTool: ToolDefinition = {
  name: 'get_card',
  description: '通过卡片 ID 获取详情内容',
  parameters: {
    type: 'object',
    properties: {
      cardId: { type: 'number', description: '卡片 ID' },
    },
    required: ['cardId'],
  },
  execute: async (input) => {
    const cardId = Number(input.cardId)
    if (!cardId) return { output: { error: '无效的卡片 ID' } }
    const result = await window.card.getById(cardId)
    if (!result.success) {
      return { output: { error: result.error } }
    }
    const card: CardDetail = result.data
    return {
      output: {
        id: card.id,
        title: card.title,
        summary: card.summary,
        content: card.content,
      },
    }
  },
}

const proposeOrganizationTool: ToolDefinition = {
  name: 'propose_organization',
  description: '提交卡片整理建议。当用户要求整理卡片时，分析卡片内容，生成添加/移除标签或修改内容的建议。不要直接修改，而是调用此工具。',
  parameters: {
    type: 'object',
    properties: {
      reason: { type: 'string', description: '整理的理由或概述' },
      operations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number', description: '卡片 ID' },
            title: { type: 'string', description: '卡片标题（仅用于展示）' },
            addTags: { type: 'array', items: { type: 'string' }, description: '建议添加的标签名称' },
            removeTags: { type: 'array', items: { type: 'string' }, description: '建议移除的标签名称' },
            content: { type: 'string', description: '建议修改后的内容（可选）' },
          },
          required: ['id'],
        },
      },
    },
    required: ['reason', 'operations'],
  },
  execute: async (input) => {
    // 此工具不执行任何实际操作，只返回输入数据供前端渲染确认 UI
    return {
      output: {
        _isProposal: true,
        type: 'organization',
        data: input,
      },
    }
  },
}

/**
 * activate_skill 工具
 * 让 AI 激活一个特定的 skill，获取其完整指导内容
 */
const activateSkillTool: ToolDefinition = {
  name: 'activate_skill',
  description: '激活一个专业技能（skill）。当你识别到当前任务与某个 skill 的描述匹配时，调用此工具获取该 skill 的详细指导。返回的内容包含在 <ACTIVATED_SKILL> 标签中，你必须严格按照其中的 <INSTRUCTIONS> 执行任务。',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: '要激活的 skill 名称',
      },
    },
    required: ['name'],
  },
  execute: async (input) => {
    const skillName = input.name as string
    if (!skillName) {
      return { output: { error: 'Skill name is required' } }
    }

    try {
      const result = await window.skill.getByName(skillName)
      if (!result.success || !result.data) {
        const namesResult = await window.skill.getNames()
        const names = namesResult.success ? namesResult.data : []
        return {
          output: {
            error: `Skill "${skillName}" not found. Available skills: ${names.join(', ') || 'none'}`,
          },
        }
      }

      const skill = result.data
      // 返回激活的 skill 内容
      const formattedResult = await window.skill.formatActivatedSkill(skill)
      return {
        output: {
          content: formattedResult.success ? formattedResult.data : skill.body,
          tools: skill.tools,
        },
      }
    } catch (e) {
      return { output: { error: `Failed to activate skill: ${e}` } }
    }
  },
}

const deactivateSkillTool: ToolDefinition = {
  name: 'deactivate_skill',
  description: '停用当前激活的专业技能，恢复到默认状态。当你完成特定技能相关的任务后调用此工具。',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    return {
      output: '已停用当前 Skill，恢复默认状态。',
    }
  },
}

export const toolRegistry: ToolDefinition[] = [
  getCurrentTimeTool,
  listTagsTool,
  searchCardsTool,
  listCardsTool,
  getCardTool,
  proposeOrganizationTool,
  activateSkillTool,
  deactivateSkillTool,
]

export const getToolSchemas = (): ToolSchema[] => {
  return toolRegistry.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }))
}

export const getToolNames = (): string[] => {
  return toolRegistry.map((tool) => tool.name)
}

export const findTool = (name: string) => toolRegistry.find((tool) => tool.name === name)

export const runTool = async (
  name: string,
  input: Record<string, unknown>,
  context: ToolContext
): Promise<ToolExecutionResult> => {
  const tool = findTool(name)
  if (!tool) {
    return { output: { error: `Unknown tool: ${name}` } }
  }
  return tool.execute(input, context)
}
