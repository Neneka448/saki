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
  description: '根据关键词搜索当前项目卡片（标题与摘要）',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索关键词' },
      limit: { type: 'number', description: '返回数量上限' },
    },
    required: ['query'],
  },
  execute: async (input, context) => {
    const query = String(input.query || '').trim().toLowerCase()
    const limit = typeof input.limit === 'number' ? input.limit : 5
    if (!query) return { output: [] }
    const result = await window.card.getListByProject(context.projectId)
    if (!result.success) {
      return { output: { error: result.error } }
    }
    const cards: CardListItem[] = result.data
    const filtered = cards.filter((card) => {
      const title = (card.title || '').toLowerCase()
      const summary = (card.summary || '').toLowerCase()
      return title.includes(query) || summary.includes(query)
    })
    return {
      output: filtered.slice(0, limit).map((card) => ({
        id: card.id,
        title: card.title,
        summary: card.summary,
      })),
    }
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

export const toolRegistry: ToolDefinition[] = [
  getCurrentTimeTool,
  listTagsTool,
  searchCardsTool,
  getCardTool,
]

export const getToolSchemas = (): ToolSchema[] => {
  return toolRegistry.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }))
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
