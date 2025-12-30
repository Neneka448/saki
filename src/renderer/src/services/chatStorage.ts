export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

export type ChatMessageKind = 'text' | 'tool_call' | 'tool_result'

export interface ToolPayload {
  name: string
  description?: string
  input?: unknown
  output?: unknown
  callId?: string
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  kind?: ChatMessageKind
  tool?: ToolPayload
  createdAt: number
}

export interface ChatConversation {
  id: string
  projectId: number
  title: string
  model: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

export interface ChatSettings {
  endpoint: string
  path: string
  apiKey: string
  modelsText: string
  systemPrompt: string
  maxToolRounds: number
}

const SETTINGS_KEY = 'saki.chat.settings.v1'
const CONVERSATIONS_KEY = 'saki.chat.conversations.v1'

const defaultSettings: ChatSettings = {
  endpoint: '',
  path: '/v1/chat/completions',
  apiKey: '',
  modelsText: '',
  systemPrompt: '',
  maxToolRounds: 25,
}

const memoryStore = new Map<string, string>()

const getStorageItem = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return memoryStore.get(key) ?? null
  }
}

const setStorageItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    memoryStore.set(key, value)
  }
}

const removeStorageItem = (key: string) => {
  try {
    localStorage.removeItem(key)
  } catch {
    memoryStore.delete(key)
  }
}

const safeParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

const getNow = () => Date.now()

export const loadChatSettings = (): ChatSettings => {
  const stored = safeParse<ChatSettings>(getStorageItem(SETTINGS_KEY), defaultSettings)
  return { ...defaultSettings, ...stored }
}

export const saveChatSettings = (settings: ChatSettings) => {
  setStorageItem(SETTINGS_KEY, JSON.stringify(settings))
}

export const listConversations = (projectId?: number): ChatConversation[] => {
  const stored = safeParse<ChatConversation[]>(getStorageItem(CONVERSATIONS_KEY), [])
  const filtered = projectId !== undefined
    ? stored.filter((item) => item.projectId === projectId)
    : stored
  return filtered.sort((a, b) => b.updatedAt - a.updatedAt)
}

export const saveConversation = (conversation: ChatConversation) => {
  const stored = safeParse<ChatConversation[]>(getStorageItem(CONVERSATIONS_KEY), [])
  const next = stored.filter((item) => item.id !== conversation.id)
  next.push(conversation)
  setStorageItem(CONVERSATIONS_KEY, JSON.stringify(next))
}

export const deleteConversation = (conversationId: string) => {
  const stored = safeParse<ChatConversation[]>(getStorageItem(CONVERSATIONS_KEY), [])
  const next = stored.filter((item) => item.id !== conversationId)
  if (next.length === 0) {
    removeStorageItem(CONVERSATIONS_KEY)
    return
  }
  setStorageItem(CONVERSATIONS_KEY, JSON.stringify(next))
}

export const createConversation = (projectId: number, model: string, title?: string): ChatConversation => {
  const now = getNow()
  const conversation: ChatConversation = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    projectId,
    title: title || '新对话',
    model,
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
  saveConversation(conversation)
  return conversation
}

export const updateConversationMessages = (
  conversation: ChatConversation,
  messages: ChatMessage[]
): ChatConversation => {
  const next: ChatConversation = {
    ...conversation,
    messages,
    updatedAt: getNow(),
  }
  saveConversation(next)
  return next
}

export const createMessage = (
  role: ChatRole,
  content: string,
  kind: ChatMessageKind = 'text',
  tool?: ToolPayload
): ChatMessage => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  content,
  kind,
  tool,
  createdAt: Date.now(),
})

export const getModelsFromSettings = (settings: ChatSettings): string[] => {
  return settings.modelsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}
