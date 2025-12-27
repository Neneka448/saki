<script setup lang="ts">
import { ref, inject, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import type { Project } from '../../../shared/ipc/types'
import {
  createConversation,
  createMessage,
  deleteConversation,
  getModelsFromSettings,
  listConversations,
  loadChatSettings,
  saveConversation,
  saveChatSettings,
  updateConversationMessages,
  type ChatConversation,
  type ChatMessage,
  type ChatSettings,
} from '../services/chatStorage'
import { sendChatWithTools } from '../services/chatAgent'

const emit = defineEmits<{
  'toggle-collapse': []
}>()

// 注入返回项目选择的函数
const backToProjectSelector = inject<() => void>('backToProjectSelector', () => {})
const currentProject = inject<{ value: Project | null }>('currentProject', { value: null })

const inputText = ref('')
const isLoading = ref(false)
const panelTab = ref<'none' | 'history' | 'settings'>('none')
const expandedToolIds = ref(new Set<string>())

const settings = ref<ChatSettings>(loadChatSettings())
const settingsDraft = ref<ChatSettings>({ ...settings.value })

const conversations = ref<ChatConversation[]>([])
const activeConversationId = ref<string | null>(null)

const modelPickerOpen = ref(false)
const modelPickerRef = ref<HTMLElement | null>(null)
const modelPickerListRef = ref<HTMLElement | null>(null)

const projectId = computed(() => currentProject?.value?.id ?? null)
const modelOptions = computed(() => getModelsFromSettings(settingsDraft.value))
const activeConversation = computed(() => {
  if (!activeConversationId.value) return null
  return conversations.value.find((item) => item.id === activeConversationId.value) || null
})
const messages = computed(() => activeConversation.value?.messages || [])
const activeModel = computed({
  get: () => activeConversation.value?.model || '',
  set: (value: string) => {
    if (!activeConversation.value) return
    const updated: ChatConversation = {
      ...activeConversation.value,
      model: value,
      updatedAt: Date.now(),
    }
    const nextConversation = updateConversationMessages(updated, updated.messages)
    const next = conversations.value.map((item) => (item.id === updated.id ? nextConversation : item))
    conversations.value = next
  },
})

const ensureConversation = () => {
  if (!projectId.value) return
  const existing = listConversations(projectId.value)
  conversations.value = existing
  if (existing.length > 0) {
    activeConversationId.value = existing[0].id
    return
  }

  const defaultModel = modelOptions.value[0] || ''
  const conversation = createConversation(projectId.value, defaultModel)
  const welcome = createMessage('assistant', '你好！我是 Saki，你的知识助手。有什么可以帮你的吗？')
  const next = updateConversationMessages(conversation, [welcome])
  conversations.value = [next]
  activeConversationId.value = next.id
}

const startNewChat = () => {
  if (!projectId.value) return
  const defaultModel = modelOptions.value[0] || activeModel.value || ''
  const conversation = createConversation(projectId.value, defaultModel)
  const welcome = createMessage('assistant', '你好！我是 Saki，你的知识助手。有什么可以帮你的吗？')
  const next = updateConversationMessages(conversation, [welcome])
  conversations.value = [next, ...conversations.value]
  activeConversationId.value = next.id
  inputText.value = ''
}

const selectConversation = (conversationId: string) => {
  activeConversationId.value = conversationId
}

const removeConversation = (conversationId: string) => {
  deleteConversation(conversationId)
  conversations.value = conversations.value.filter((item) => item.id !== conversationId)
  if (activeConversationId.value === conversationId) {
    activeConversationId.value = conversations.value[0]?.id || null
  }
  if (!activeConversationId.value) {
    ensureConversation()
  }
}

const saveSettings = () => {
  settings.value = { ...settingsDraft.value }
  saveChatSettings(settings.value)
  if (activeConversation.value && modelOptions.value.length > 0) {
    if (!modelOptions.value.includes(activeConversation.value.model)) {
      activeModel.value = modelOptions.value[0]
    }
  }
}

const sendMessage = async () => {
  if (!activeConversation.value || !projectId.value) return
  const text = inputText.value.trim()
  if (!text || isLoading.value) return

  const userMessage = createMessage('user', text)
  const baseConversation = activeConversation.value
  const updatedMessages = [...baseConversation.messages, userMessage]
  const updatedConversation = updateConversationMessages(baseConversation, updatedMessages)
  conversations.value = conversations.value.map((item) =>
    item.id === updatedConversation.id ? updatedConversation : item
  )

  inputText.value = ''
  isLoading.value = true

  try {
    const result = await sendChatWithTools({
      settings: settings.value,
      conversation: baseConversation,
      userMessage,
      model: activeModel.value,
      projectId: projectId.value,
    })

    const finalConversation = updateConversationMessages(updatedConversation, result.messages)
    if (finalConversation.title === '新对话') {
      finalConversation.title = text.slice(0, 20)
      saveConversation(finalConversation)
    }
    conversations.value = conversations.value.map((item) =>
      item.id === finalConversation.id ? finalConversation : item
    )
  } catch (error) {
    const err = error instanceof Error ? error.message : '对话失败'
    const fallback = updateConversationMessages(updatedConversation, [
      ...updatedMessages,
      createMessage('assistant', `对话出错：${err}`),
    ])
    conversations.value = conversations.value.map((item) =>
      item.id === fallback.id ? fallback : item
    )
  } finally {
    isLoading.value = false
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

const togglePanel = (tab: 'history' | 'settings') => {
  panelTab.value = panelTab.value === tab ? 'none' : tab
}

const toggleToolDetails = (id: string) => {
  const next = new Set(expandedToolIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expandedToolIds.value = next
}

const isToolExpanded = (id: string) => expandedToolIds.value.has(id)

const formatJson = (value: unknown) => {
  if (value === undefined) return '无'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const toggleModelPicker = () => {
  if (modelOptions.value.length === 0) return
  modelPickerOpen.value = !modelPickerOpen.value
}

const selectModel = (model: string) => {
  activeModel.value = model
  modelPickerOpen.value = false
}

const handleOutsideClick = (event: MouseEvent) => {
  const target = event.target as Node
  if (modelPickerRef.value?.contains(target)) return
  if (modelPickerListRef.value?.contains(target)) return
  modelPickerOpen.value = false
}

onMounted(() => {
  ensureConversation()
  document.addEventListener('click', handleOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick)
})

watch(projectId, () => {
  ensureConversation()
})

watch(() => settingsDraft.value.modelsText, () => {
  if (modelOptions.value.length === 0) {
    activeModel.value = ''
  } else if (activeModel.value && modelOptions.value.includes(activeModel.value)) {
    return
  } else {
    activeModel.value = modelOptions.value[0]
  }
})
</script>

<template>
  <div class="chat-panel">
    <!-- 头部 -->
    <header class="chat-header">
      <button class="chat-header__back" title="返回知识库列表" @click="backToProjectSelector">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </button>
      <div class="chat-header__info">
        <h2 class="chat-header__title">Saki</h2>
        <span class="chat-header__subtitle">知识助手</span>
      </div>
      <div class="chat-header__actions">
        <button class="chat-header__action" title="新对话" @click="startNewChat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button class="chat-header__action" title="收起对话" @click="emit('toggle-collapse')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>
    </header>

    <div class="chat-panel__tabs">
      <button
        class="chat-panel__tab"
        :class="{ 'chat-panel__tab--active': panelTab === 'history' }"
        @click="togglePanel('history')"
      >
        对话历史
      </button>
      <button
        class="chat-panel__tab"
        :class="{ 'chat-panel__tab--active': panelTab === 'settings' }"
        @click="togglePanel('settings')"
      >
        控制面板
      </button>
    </div>

    <div v-if="panelTab === 'history'" class="chat-panel__section">
      <div class="chat-history">
        <div v-if="conversations.length === 0" class="chat-history__empty">暂无历史</div>
        <div
          v-for="item in conversations"
          :key="item.id"
          class="chat-history__item"
          :class="{ 'chat-history__item--active': item.id === activeConversationId }"
        >
          <button class="chat-history__main" @click="selectConversation(item.id)">
            <div class="chat-history__title">{{ item.title }}</div>
            <div class="chat-history__meta">{{ new Date(item.updatedAt).toLocaleString('zh-CN') }}</div>
          </button>
          <button class="chat-history__remove" title="删除" @click="removeConversation(item.id)">×</button>
        </div>
      </div>
    </div>

    <div v-else-if="panelTab === 'settings'" class="chat-panel__section">
      <div class="chat-settings">
        <label class="chat-settings__label">Endpoint</label>
        <input v-model="settingsDraft.endpoint" class="chat-settings__input" type="text" placeholder="https://api.openai.com" />
        <label class="chat-settings__label">Path</label>
        <input v-model="settingsDraft.path" class="chat-settings__input" type="text" placeholder="/v1/chat/completions" />
        <label class="chat-settings__label">API Key</label>
        <input v-model="settingsDraft.apiKey" class="chat-settings__input" type="password" placeholder="sk-..." />
        <label class="chat-settings__label">模型列表（换行分隔）</label>
        <textarea
          v-model="settingsDraft.modelsText"
          class="chat-settings__textarea"
          rows="3"
          placeholder="gpt-4o-mini\nqwen-2.5"
        ></textarea>
        <label class="chat-settings__label">系统提示词</label>
        <textarea
          v-model="settingsDraft.systemPrompt"
          class="chat-settings__textarea"
          rows="3"
          placeholder="你是一个高效、严谨的知识助手..."
        ></textarea>
        <button class="chat-settings__save" @click="saveSettings">保存设置</button>
      </div>
    </div>

    <!-- 消息列表 -->
    <div class="chat-messages">
      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="['chat-message', `chat-message--${msg.role}`]"
      >
        <div class="chat-message__avatar">
          <template v-if="msg.kind === 'tool_call'">🛠️</template>
          <template v-else-if="msg.role === 'assistant'">🤖</template>
          <template v-else>👤</template>
        </div>
        <div class="chat-message__content">
          <div v-if="msg.kind === 'tool_call'" class="chat-tool">
            <button class="chat-tool__summary" @click="toggleToolDetails(msg.id)">
              工具调用：{{ msg.tool?.name || '未知工具' }}
              <span class="chat-tool__toggle">{{ isToolExpanded(msg.id) ? '收起' : '展开' }}</span>
            </button>
            <div v-if="isToolExpanded(msg.id)" class="chat-tool__details">
              <div class="chat-tool__section">
                <span class="chat-tool__label">介绍</span>
                <div class="chat-tool__text">{{ msg.tool?.description || '暂无介绍' }}</div>
              </div>
              <div class="chat-tool__section">
                <span class="chat-tool__label">输入</span>
                <pre class="chat-tool__block">{{ formatJson(msg.tool?.input) }}</pre>
              </div>
              <div class="chat-tool__section">
                <span class="chat-tool__label">输出</span>
                <pre class="chat-tool__block">{{ formatJson(msg.tool?.output) }}</pre>
              </div>
            </div>
          </div>
          <template v-else>
            {{ msg.content }}
          </template>
        </div>
      </div>

      <!-- 加载指示器 -->
      <div v-if="isLoading" class="chat-message chat-message--assistant">
        <div class="chat-message__avatar">🤖</div>
        <div class="chat-message__content chat-message__typing">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="chat-input">
      <div class="chat-input__model">
        <button
          ref="modelPickerRef"
          class="chat-input__model-btn"
          :disabled="modelOptions.length === 0"
          @click="toggleModelPicker"
        >
          <span>{{ activeModel || '选择模型' }}</span>
          <span class="chat-input__model-arrow"></span>
        </button>
        <div v-if="modelPickerOpen" ref="modelPickerListRef" class="chat-input__model-list">
          <button
            v-for="model in modelOptions"
            :key="model"
            class="chat-input__model-item"
            :class="{ 'chat-input__model-item--active': model === activeModel }"
            @click="selectModel(model)"
          >
            {{ model }}
          </button>
        </div>
      </div>
      <textarea
        v-model="inputText"
        class="chat-input__textarea"
        placeholder="输入消息..."
        rows="1"
        @keydown="handleKeydown"
      />
      <button
        class="chat-input__send"
        :disabled="!inputText.trim() || isLoading"
        @click="sendMessage"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  width: var(--chat-width);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-panel);
  border-right: 1px solid var(--color-border);
}

/* 头部 */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  -webkit-app-region: drag;
}

.chat-header__info {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.chat-header__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
}

.chat-header__subtitle {
  font-size: 12px;
  color: var(--color-text-muted);
}

.chat-header__actions {
  display: flex;
  gap: 6px;
  -webkit-app-region: no-drag;
}

.chat-header__back,
.chat-header__action {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  transition: all 0.15s;
  -webkit-app-region: no-drag;
}

.chat-header__back:hover,
.chat-header__action:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

.chat-panel__tabs {
  display: flex;
  gap: 8px;
  padding: 12px 16px 0;
}

.chat-panel__tab {
  flex: 1;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg);
  transition: all 0.15s;
}

.chat-panel__tab--active {
  color: var(--color-text);
  background: white;
  box-shadow: var(--shadow-sm);
}

.chat-panel__section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.chat-history {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-history__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  background: var(--color-bg);
  border: 1px solid transparent;
  transition: all 0.15s;
}

.chat-history__item--active {
  border-color: var(--color-primary);
  background: rgba(59, 130, 246, 0.08);
}

.chat-history__main {
  flex: 1;
  text-align: left;
}

.chat-history__title {
  font-size: 13px;
  color: var(--color-text);
}

.chat-history__meta {
  font-size: 11px;
  color: var(--color-text-muted);
}

.chat-history__remove {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  color: var(--color-text-muted);
}

.chat-history__remove:hover {
  background: var(--color-bg-panel);
}

.chat-history__empty {
  font-size: 12px;
  color: var(--color-text-muted);
}

.chat-settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-settings__label {
  font-size: 12px;
  color: var(--color-text-muted);
}

.chat-settings__input,
.chat-settings__textarea {
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  font-size: 12px;
  background: white;
  color: var(--color-text);
}

.chat-settings__input:focus,
.chat-settings__textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.chat-settings__save {
  align-self: flex-end;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: white;
  font-size: 12px;
}

/* 消息列表 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chat-message {
  display: flex;
  gap: 12px;
  max-width: 90%;
}

.chat-message--user {
  flex-direction: row-reverse;
  align-self: flex-end;
}

.chat-message__avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.chat-message__content {
  padding: 10px 14px;
  border-radius: var(--radius-lg);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-message--assistant .chat-message__content {
  background: var(--color-bg);
  color: var(--color-text);
}

.chat-message--user .chat-message__content {
  background: var(--color-primary);
  color: white;
}

.chat-message__typing {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.chat-message__typing span {
  display: block;
  width: 6px;
  height: 6px;
  background: var(--color-text-muted);
  border-radius: 50%;
  animation: typing 1s infinite;
}

.chat-message__typing span:nth-child(2) {
  animation-delay: 0.2s;
}

.chat-message__typing span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.chat-tool__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.chat-tool__toggle {
  font-size: 11px;
  color: var(--color-text-muted);
}

.chat-tool__details {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-tool__section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chat-tool__label {
  font-size: 11px;
  color: var(--color-text-muted);
}

.chat-tool__text {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.chat-tool__block {
  font-size: 11px;
  padding: 8px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  white-space: pre-wrap;
}

/* 输入区域 */
.chat-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
}

.chat-input__model {
  position: relative;
}

.chat-input__model-btn {
  height: 34px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text-secondary);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.chat-input__model-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-input__model-arrow {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid var(--color-text-muted);
}

.chat-input__model-list {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  min-width: 160px;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  z-index: 10;
}

.chat-input__model-item {
  padding: 6px 8px;
  font-size: 12px;
  text-align: left;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
}

.chat-input__model-item--active {
  background: var(--color-bg);
  color: var(--color-text);
}

.chat-input__textarea {
  flex: 1;
  padding: 10px 12px;
  font-size: 13px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  color: var(--color-text);
  resize: none;
}

.chat-input__textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.chat-input__send {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.chat-input__send:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.chat-input__send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
