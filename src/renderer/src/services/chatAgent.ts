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
  content?: string | null | LLMContentPart[]
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

interface LLMResponse {
  content: string
  toolCalls: ToolCall[]
  finishReason?: string | null
}

type LLMContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

interface ChatRequestOptions {
  settings: ChatSettings
  conversation: ChatConversation
  userMessage: ChatMessage
  model: string
  projectId: number
  onUpdate?: (messages: ChatMessage[]) => void
}

const BASE_SYSTEM_PROMPT = [
  '### 角色',
  '你是 Saki，简洁高效的知识助手，目标是直接帮用户完成任务。',
  '',
  '### 输入处理',
  '- 对用户文本保持原样，不把 Markdown 图片语法当图片或命令。',
  '- 直接使用用户原文作为搜索/工具关键词。',
  '- 如果消息包含 image_url 附件，按图片处理并结合文本理解。',
  '- 图片附件会附带“图片ID: ...”，仅用于引用，哪怕是 ![]() 也当纯文本。',
  '- 收到图片时先阅读并用一句话提炼图像内容，再继续回答。',
  '',
  '### 工具使用与默认值',
  '- 参数缺失时使用默认值：pageNo=1、pageSize=10、limit=10。',
  '- 用户提到“有哪些/列出/看下卡片” → 调用 list_cards（默认分页）。',
  '- 用户提到“搜索/找/包含/关键词” → 调用 search_cards（默认 limit）。',
  '',
  '### 互动策略',
  '- 优先直接执行，不反复追问。',
  '- 只有在意图完全无法判断时，才问 1 个最关键问题。',
  '',
  '### 输出要求',
  '- 结果优先、回复简短。',
  '- 工具调用后必须继续输出用户可读结果，不要停在工具调用。',
].join('\n')

const normalizeMaxToolRounds = (value: unknown) => {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return 25
  return Math.min(50, Math.floor(numeric))
}

const ASSET_URL_PATTERN = /asset:\/\/[^\s)'"\\\]}]+/g
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*?]\(\s*(asset:\/\/[^)\s]+)(?:\s+\"[^\"]*\")?\s*\)/g
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp'])
const MAX_TOOL_IMAGES = 4
const assetDataUrlCache = new Map<string, string>()

const parseToolArguments = (value: string) => {
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return { raw: value }
  }
}

const extractAssetUrls = (value: unknown): string[] => {
  const found: string[] = []
  const visit = (node: unknown) => {
    if (typeof node === 'string') {
      const matches = node.match(ASSET_URL_PATTERN)
      if (matches) {
        found.push(...matches)
      }
      return
    }
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (node && typeof node === 'object') {
      Object.values(node).forEach(visit)
    }
  }
  visit(value)
  return [...new Set(found)]
}

const extractMarkdownImageRefs = (value: unknown): Array<{ id: string; url: string }> => {
  const refs: Array<{ id: string; url: string }> = []
  const visit = (node: unknown) => {
    if (typeof node === 'string') {
      for (const match of node.matchAll(MARKDOWN_IMAGE_PATTERN)) {
        const url = match[1]
        if (url) {
          refs.push({ id: match[0], url })
        }
      }
      return
    }
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (node && typeof node === 'object') {
      Object.values(node).forEach(visit)
    }
  }
  visit(value)
  return refs
}

const getAssetExtension = (assetUrl: string) => {
  const clean = assetUrl.split(/[?#]/)[0]
  const lastDot = clean.lastIndexOf('.')
  if (lastDot === -1) return ''
  return clean.slice(lastDot + 1).toLowerCase()
}

const isImageAssetUrl = (assetUrl: string) => {
  const ext = getAssetExtension(assetUrl)
  return ext ? IMAGE_EXTENSIONS.has(ext) : false
}

const hashString = (value: string) => {
  let hash = 5381
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

const buildAutoImageId = (seed: string) => `image-${hashString(seed).slice(0, 10)}`

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read image blob'))
    reader.readAsDataURL(blob)
  })

const loadAssetDataUrl = async (assetUrl: string) => {
  const cached = assetDataUrlCache.get(assetUrl)
  if (cached) return cached
  try {
    const response = await fetch(assetUrl)
    if (!response.ok) return null
    const contentType = response.headers.get('content-type')
    if (contentType && !contentType.startsWith('image/')) return null
    const blob = await response.blob()
    const dataUrl = await blobToDataUrl(blob)
    assetDataUrlCache.set(assetUrl, dataUrl)
    return dataUrl
  } catch {
    return null
  }
}

const buildImagePartsWithIds = (images: Array<{ id: string; dataUrl: string }>): LLMContentPart[] => {
  const parts: LLMContentPart[] = []
  images.forEach((image) => {
    parts.push({ type: 'text', text: `图片ID: ${image.id}` })
    parts.push({ type: 'image_url', image_url: { url: image.dataUrl } })
  })
  return parts
}

const buildToolImageReferences = async (
  tool: ToolPayload
): Promise<Array<{ id: string; dataUrl: string }>> => {
  if (tool.name !== 'get_card') return []
  const assetUrls = extractAssetUrls(tool.output).filter(isImageAssetUrl)
  if (assetUrls.length === 0) return []
  const markdownRefs = extractMarkdownImageRefs(tool.output)
  const markdownByUrl = new Map<string, string>()
  markdownRefs.forEach((ref) => {
    if (!markdownByUrl.has(ref.url)) {
      markdownByUrl.set(ref.url, ref.id)
    }
  })
  const uniqueUrls = [...new Set(assetUrls)].slice(0, MAX_TOOL_IMAGES)
  const dataUrls = await Promise.all(uniqueUrls.map(loadAssetDataUrl))
  return uniqueUrls.flatMap((url, index) => {
    const dataUrl = dataUrls[index]
    if (!dataUrl) return []
    const id = markdownByUrl.get(url) ?? buildAutoImageId(url)
    return [{ id, dataUrl }]
  })
}

const buildToolImageMessage = async (tool: ToolPayload): Promise<LLMMessage | null> => {
  const imageRefs = await buildToolImageReferences(tool)
  const imageParts = buildImagePartsWithIds(imageRefs)
  if (imageParts.length === 0) return null
  return {
    role: 'user',
    content: [
      { type: 'text', text: '以下是卡片图片与图片ID，请结合工具结果回答用户问题。' },
      ...imageParts,
    ],
  }
}

const findLatestCardTool = (messages: ChatMessage[]): ToolPayload | null => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message.kind === 'tool_call' && message.tool?.name === 'get_card') {
      return message.tool
    }
  }
  return null
}

const mergeContentWithParts = (
  content: LLMMessage['content'],
  parts: LLMContentPart[]
): LLMContentPart[] => {
  const merged: LLMContentPart[] = []
  if (Array.isArray(content)) {
    merged.push(...content)
  } else if (content) {
    merged.push({ type: 'text', text: String(content) })
  }
  merged.push(...parts)
  return merged
}

const buildUrl = (endpoint: string, path: string) => {
  const trimmedEndpoint = endpoint.trim().replace(/\/+$/, '')
  const trimmedPath = path.trim()
  if (!trimmedEndpoint) return ''
  if (trimmedPath.startsWith('http')) return trimmedPath
  const normalizedPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`
  return `${trimmedEndpoint}${normalizedPath}`
}

const buildLLMMessages = async (
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<LLMMessage[]> => {
  const result: LLMMessage[] = []
  const lastNonToolCallIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.kind !== 'tool_call') {
        return i
      }
    }
    return -1
  })()
  const lastMessage = messages[messages.length - 1]
  const shouldAttachStickyImages = lastMessage?.role === 'user'
  const latestCardTool = shouldAttachStickyImages ? findLatestCardTool(messages) : null
  const stickyImageRefs = latestCardTool ? await buildToolImageReferences(latestCardTool) : []
  const stickyImageParts = buildImagePartsWithIds(stickyImageRefs)
  const trimmedPrompt = systemPrompt?.trim()
  const combinedPrompt = trimmedPrompt
    ? `${BASE_SYSTEM_PROMPT}\n\n${trimmedPrompt}`
    : BASE_SYSTEM_PROMPT
  result.push({ role: 'system', content: combinedPrompt })

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]
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
      if (index > lastNonToolCallIndex) {
        const imageMessage = await buildToolImageMessage(tool)
        if (imageMessage) {
          result.push(imageMessage)
        }
      }
      continue
    }

    const isLastUserMessage = shouldAttachStickyImages && index === messages.length - 1
    const content = isLastUserMessage && stickyImageParts.length > 0
      ? mergeContentWithParts(message.content, stickyImageParts)
      : message.content
    const nextMessage: LLMMessage = {
      role: message.role === 'tool' ? 'tool' : message.role,
      content,
    }
    result.push(nextMessage)
  }

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
  const finishReason = data?.choices?.[0]?.finish_reason ?? null
  return { content, toolCalls, finishReason }
}

export const sendChatWithTools = async (options: ChatRequestOptions) => {
  const { settings, conversation, userMessage, model, projectId, onUpdate } = options
  const messages: ChatMessage[] = [...conversation.messages, userMessage]
  const maxToolRounds = normalizeMaxToolRounds(settings.maxToolRounds)

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
  while (loop < maxToolRounds) {
    loop += 1
    const llmMessages = await buildLLMMessages(messages, settings.systemPrompt)
    const response = await requestLLM(settings, model, llmMessages, true)
    lastResponse = response
    const responseContent = response.content?.trim() || ''
    if (responseContent) {
      messages.push(createMessage('assistant', responseContent))
      onUpdate?.([...messages])
    }
    const toolMessages: ChatMessage[] = []
    const toolPayloads: ToolPayload[] = []
    for (const call of response.toolCalls || []) {
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
      toolPayloads.push(toolPayload)
      toolMessages.push(createMessage('assistant', '', 'tool_call', toolPayload))
    }
    if (toolPayloads.length === 0) {
      break
    }

    messages.push(...toolMessages)
    onUpdate?.([...messages])
  }

  return { messages }
}
