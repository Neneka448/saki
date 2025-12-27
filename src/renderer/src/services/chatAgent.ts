import type { ChatConversation, ChatMessage, ChatSettings, ToolPayload } from './chatStorage'
import { createMessage } from './chatStorage'
import { findTool, getToolSchemas, runTool } from './toolRegistry'

interface ToolCall {
  id: string
  type: string
  function: {
    name: string
    arguments: string
  }
}

interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

interface LLMResponse {
  content: string
  toolCalls: ToolCall[]
}

interface ChatRequestOptions {
  settings: ChatSettings
  conversation: ChatConversation
  userMessage: ChatMessage
  model: string
  projectId: number
}

const parseToolArguments = (value: string) => {
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return { raw: value }
  }
}

const buildUrl = (endpoint: string, path: string) => {
  const trimmedEndpoint = endpoint.trim().replace(/\/+$/, '')
  const trimmedPath = path.trim()
  if (!trimmedEndpoint) return ''
  if (trimmedPath.startsWith('http')) return trimmedPath
  const normalizedPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`
  return `${trimmedEndpoint}${normalizedPath}`
}

const buildLLMMessages = (messages: ChatMessage[], systemPrompt?: string): LLMMessage[] => {
  const result: LLMMessage[] = []
  if (systemPrompt && systemPrompt.trim()) {
    result.push({ role: 'system', content: systemPrompt.trim() })
  }

  messages.forEach((message) => {
    if (message.kind === 'tool_call' && message.tool?.callId) {
      const tool = message.tool
      const input = tool.input ?? {}
      const toolCall: ToolCall = {
        id: tool.callId,
        type: 'function',
        function: {
          name: tool.name,
          arguments: JSON.stringify(input),
        },
      }
      result.push({
        role: 'assistant',
        content: '',
        tool_calls: [toolCall],
      })
      result.push({
        role: 'tool',
        tool_call_id: tool.callId,
        content: JSON.stringify(tool.output ?? ''),
        name: tool.name,
      })
      return
    }

    result.push({
      role: message.role === 'tool' ? 'tool' : message.role,
      content: message.content,
    })
  })

  return result
}

const requestLLM = async (
  settings: ChatSettings,
  model: string,
  messages: LLMMessage[],
  enableTools: boolean
): Promise<LLMResponse> => {
  const url = buildUrl(settings.endpoint, settings.path)
  if (!url) {
    return { content: '', toolCalls: [] }
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.7,
  }
  if (enableTools) {
    body.tools = getToolSchemas().map((tool) => ({
      type: 'function',
      function: tool,
    }))
    body.tool_choice = 'auto'
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (settings.apiKey.trim()) {
    headers.Authorization = `Bearer ${settings.apiKey.trim()}`
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `HTTP ${response.status}`)
  }

  const data = await response.json()
  const message = data?.choices?.[0]?.message
  const content = message?.content ?? ''
  const toolCalls = message?.tool_calls ?? []
  return { content, toolCalls }
}

export const sendChatWithTools = async (options: ChatRequestOptions) => {
  const { settings, conversation, userMessage, model, projectId } = options
  const messages: ChatMessage[] = [...conversation.messages, userMessage]

  const url = buildUrl(settings.endpoint, settings.path)
  if (!url) {
    return {
      messages: [
        ...messages,
        createMessage('assistant', '请先在控制面板配置模型 endpoint/path 与 API Key。'),
      ],
    }
  }
  if (!model) {
    return {
      messages: [
        ...messages,
        createMessage('assistant', '请先在控制面板配置模型列表并选择模型。'),
      ],
    }
  }

  let loop = 0
  let lastResponse: LLMResponse | null = null
  while (loop < 2) {
    loop += 1
    const llmMessages = buildLLMMessages(messages, settings.systemPrompt)
    const response = await requestLLM(settings, model, llmMessages, true)
    lastResponse = response
    if (!response.toolCalls || response.toolCalls.length === 0) {
      break
    }

    const toolMessages: ChatMessage[] = []
    for (const call of response.toolCalls) {
      const toolDef = findTool(call.function.name)
      const input = parseToolArguments(call.function.arguments || '')
      const result = await runTool(call.function.name, input, { projectId })
      const toolPayload: ToolPayload = {
        name: call.function.name,
        description: toolDef?.description || '未找到工具描述',
        input,
        output: result.output,
        callId: call.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      }
      toolMessages.push(createMessage('assistant', '', 'tool_call', toolPayload))
    }
    messages.push(...toolMessages)
  }

  if (lastResponse && lastResponse.content) {
    messages.push(createMessage('assistant', lastResponse.content))
  }

  return { messages }
}
