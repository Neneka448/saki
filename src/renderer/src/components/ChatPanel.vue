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
const panelTab = ref<'none' | 'history' | 'control'>('none')
const controlTab = ref<'session' | 'shortcuts'>('session')
const expandedToolIds = ref(new Set<string>())

const settings = ref<ChatSettings>(loadChatSettings())
const settingsDraft = ref<ChatSettings>({ ...settings.value })

const conversations = ref<ChatConversation[]>([])
const activeConversationId = ref<string | null>(null)

const modelPickerOpen = ref(false)
const modelPickerRef = ref<HTMLElement | null>(null)
const modelPickerListRef = ref<HTMLElement | null>(null)

const quickCaptureShortcut = ref('')
const defaultQuickCaptureShortcut = ref('CommandOrControl+Shift+N')
const shortcutRecording = ref(false)
const shortcutKeys = ref<string[]>([])
const shortcutError = ref('')

const projectId = computed(() => currentProject?.value?.id ?? null)
const modelOptions = computed(() => getModelsFromSettings(settingsDraft.value))
const shortcutKeysDisplay = computed(() => shortcutKeys.value)
const shortcutPreview = computed(() => {
  if (shortcutRecording.value) {
    return shortcutKeys.value.length > 0 ? shortcutKeys.value.join(' + ') : '等待输入...'
  }
  return quickCaptureShortcut.value || defaultQuickCaptureShortcut.value
})
const shortcutProgress = computed(() => `${shortcutKeys.value.length}/3`)
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
  let streamingConversation = updatedConversation

  inputText.value = ''
  isLoading.value = true

  try {
    const result = await sendChatWithTools({
      settings: settings.value,
      conversation: baseConversation,
      userMessage,
      model: activeModel.value,
      projectId: projectId.value,
      onUpdate: (nextMessages) => {
        const nextConversation = updateConversationMessages(streamingConversation, nextMessages)
        streamingConversation = nextConversation
        conversations.value = conversations.value.map((item) =>
          item.id === nextConversation.id ? nextConversation : item
        )
      },
    })

    const finalConversation = updateConversationMessages(streamingConversation, result.messages)
    if (finalConversation.title === '新对话') {
      finalConversation.title = text.slice(0, 20)
      saveConversation(finalConversation)
    }
    conversations.value = conversations.value.map((item) =>
      item.id === finalConversation.id ? finalConversation : item
    )
  } catch (error) {
    const err = error instanceof Error ? error.message : '对话失败'
    const fallback = updateConversationMessages(streamingConversation, [
      ...streamingConversation.messages,
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

const togglePanel = (tab: 'history' | 'control') => {
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

const normalizeKeyLabel = (key: string) => {
  const normalized = key.trim()
  if (!normalized) return ''
  const map: Record<string, string> = {
    Control: 'Ctrl',
    Meta: 'Meta',
    Alt: 'Alt',
    Shift: 'Shift',
    Escape: 'Esc',
    ' ': 'Space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Enter: 'Enter',
    Tab: 'Tab',
    CapsLock: 'CapsLock',
  }
  if (map[normalized]) return map[normalized]
  if (normalized.length === 1) return normalized.toUpperCase()
  return normalized
}

const buildAccelerator = (keys: string[]) => {
  const modifierMap: Record<string, string> = {
    Ctrl: 'CommandOrControl',
    Meta: 'CommandOrControl',
    Shift: 'Shift',
    Alt: 'Alt',
  }
  const nameMap: Record<string, string> = {
    Esc: 'Escape',
    Space: 'Space',
    Up: 'Up',
    Down: 'Down',
    Left: 'Left',
    Right: 'Right',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Enter: 'Enter',
    Tab: 'Tab',
    CapsLock: 'CapsLock',
  }
  if (keys.some((key) => key.startsWith('Mouse'))) {
    shortcutError.value = '鼠标按键暂不支持全局快捷键'
    return null
  }
  const modifiers = new Set<string>()
  const mainKeys: string[] = []
  keys.forEach((key) => {
    const mappedModifier = modifierMap[key]
    if (mappedModifier) {
      modifiers.add(mappedModifier)
      return
    }
    const mappedKey = nameMap[key] || key
    mainKeys.push(mappedKey)
  })
  if (mainKeys.length !== 1) {
    shortcutError.value = '请只包含一个主键（例如字母或数字）'
    return null
  }
  const orderedModifiers = ['CommandOrControl', 'Shift', 'Alt'].filter((item) => modifiers.has(item))
  return [...orderedModifiers, mainKeys[0]].join('+')
}

const updateQuickCaptureShortcut = async (keys: string[]) => {
  shortcutError.value = ''
  const accelerator = buildAccelerator(keys)
  if (!accelerator) return
  const result = await window.app?.setQuickCaptureShortcut?.(accelerator)
  if (!result?.ok) {
    shortcutError.value = result?.error || '设置快捷键失败'
    return
  }
  quickCaptureShortcut.value = result.shortcut
  defaultQuickCaptureShortcut.value = result.defaultShortcut || defaultQuickCaptureShortcut.value
  shortcutKeys.value = []
}

const appendShortcutKey = async (key: string) => {
  if (!key) return
  if (shortcutKeys.value.includes(key)) return
  const next = [...shortcutKeys.value, key].slice(0, 3)
  shortcutKeys.value = next
  if (next.length >= 3) {
    await updateQuickCaptureShortcut(next)
    stopShortcutRecording()
  }
}

const handleShortcutKeydown = async (event: KeyboardEvent) => {
  if (!shortcutRecording.value) return
  event.preventDefault()
  event.stopPropagation()
  if (event.repeat) return
  const keys: string[] = []
  if (event.ctrlKey) keys.push('Ctrl')
  if (event.metaKey) keys.push('Meta')
  if (event.shiftKey) keys.push('Shift')
  if (event.altKey) keys.push('Alt')
  const mainKey = normalizeKeyLabel(event.key)
  if (mainKey && !['Ctrl', 'Meta', 'Shift', 'Alt'].includes(mainKey)) {
    keys.push(mainKey)
  } else if (keys.length === 0) {
    keys.push(mainKey)
  }
  for (const key of keys) {
    await appendShortcutKey(key)
  }
}

const handleShortcutMousedown = async (event: MouseEvent) => {
  if (!shortcutRecording.value) return
  event.preventDefault()
  event.stopPropagation()
  const buttonMap: Record<number, string> = {
    0: 'MouseLeft',
    1: 'MouseMiddle',
    2: 'MouseRight',
    3: 'MouseBack',
    4: 'MouseForward',
  }
  await appendShortcutKey(buttonMap[event.button] || 'MouseButton')
}

const startShortcutRecording = () => {
  shortcutError.value = ''
  shortcutRecording.value = true
  shortcutKeys.value = []
  window.addEventListener('keydown', handleShortcutKeydown, true)
  window.addEventListener('mousedown', handleShortcutMousedown, true)
}

const stopShortcutRecording = () => {
  if (!shortcutRecording.value) return
  shortcutRecording.value = false
  window.removeEventListener('keydown', handleShortcutKeydown, true)
  window.removeEventListener('mousedown', handleShortcutMousedown, true)
}

const toggleShortcutRecording = () => {
  if (shortcutRecording.value) {
    stopShortcutRecording()
    return
  }
  startShortcutRecording()
}

const resetShortcut = async () => {
  shortcutError.value = ''
  const result = await window.app?.resetQuickCaptureShortcut?.()
  if (!result?.ok) {
    shortcutError.value = result?.error || '重置失败'
    return
  }
  quickCaptureShortcut.value = result.shortcut
  defaultQuickCaptureShortcut.value = result.defaultShortcut || defaultQuickCaptureShortcut.value
  shortcutKeys.value = []
  stopShortcutRecording()
}

const loadShortcutSettings = async () => {
  const result = await window.app?.getQuickCaptureShortcut?.()
  if (!result) return
  quickCaptureShortcut.value = result.shortcut
  defaultQuickCaptureShortcut.value = result.defaultShortcut || defaultQuickCaptureShortcut.value
}

onMounted(() => {
  ensureConversation()
  loadShortcutSettings()
  document.addEventListener('click', handleOutsideClick)
})

onBeforeUnmount(() => {
  stopShortcutRecording()
  document.removeEventListener('click', handleOutsideClick)
})

watch(projectId, () => {
  ensureConversation()
})

watch(panelTab, (value) => {
  if (value !== 'control') {
    stopShortcutRecording()
  }
})

watch(controlTab, (value) => {
  if (value !== 'shortcuts') {
    stopShortcutRecording()
  }
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
      <div class="chat-header__left">
        <button class="chat-header__back" title="返回知识库列表" @click="backToProjectSelector">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>
        <button
          class="chat-header__control"
          :class="{ 'chat-header__control--active': panelTab === 'control' }"
          title="控制面板"
          @click="togglePanel('control')"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </button>
      </div>
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

    <div v-else-if="panelTab === 'control'" class="chat-panel__section">
      <div class="chat-control">
        <div class="chat-control__tabs">
          <button
            class="chat-control__tab"
            :class="{ 'chat-control__tab--active': controlTab === 'session' }"
            @click="controlTab = 'session'"
          >
            会话设置
          </button>
          <button
            class="chat-control__tab"
            :class="{ 'chat-control__tab--active': controlTab === 'shortcuts' }"
            @click="controlTab = 'shortcuts'"
          >
            快捷键
          </button>
        </div>

        <div v-if="controlTab === 'session'" class="chat-settings">
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
          <label class="chat-settings__label">工具迭代轮数</label>
          <input
            v-model.number="settingsDraft.maxToolRounds"
            class="chat-settings__input"
            type="number"
            min="1"
            max="50"
            placeholder="25"
          />
          <button class="chat-settings__save" @click="saveSettings">保存设置</button>
        </div>

        <div v-else class="chat-hotkey">
          <div class="chat-hotkey__row">
            <button
              class="chat-hotkey__capture"
              :class="{ 'chat-hotkey__capture--active': shortcutRecording }"
              @click="toggleShortcutRecording"
            >
              <span class="chat-hotkey__capture-label">
                {{ shortcutRecording ? '录制中' : '点击录制' }}
              </span>
              <span class="chat-hotkey__capture-keys">
                <span v-if="shortcutKeysDisplay.length === 0" class="chat-hotkey__capture-placeholder">
                  {{ shortcutPreview }}
                </span>
                <span v-else class="chat-hotkey__capture-list">
                  <span
                    v-for="key in shortcutKeysDisplay"
                    :key="key"
                    class="chat-hotkey__key"
                  >
                    {{ key }}
                  </span>
                </span>
              </span>
              <span v-if="shortcutRecording" class="chat-hotkey__progress">{{ shortcutProgress }}</span>
            </button>
            <button class="chat-hotkey__reset" @click="resetShortcut">恢复默认</button>
          </div>
          <div class="chat-hotkey__hint">点击后输入 3 个按键，自动保存为快捷键。</div>
          <div v-if="shortcutError" class="chat-hotkey__error">{{ shortcutError }}</div>
          <div class="chat-hotkey__current">当前快捷键：{{ quickCaptureShortcut || defaultQuickCaptureShortcut }}</div>
        </div>
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
      <textarea
        v-model="inputText"
        class="chat-input__textarea"
        placeholder="输入消息..."
        rows="3"
        @keydown="handleKeydown"
      />
      <div class="chat-input__actions">
        <div class="chat-input__model">
          <button
            ref="modelPickerRef"
            class="chat-input__model-btn"
            :class="{ 'chat-input__model-btn--active': modelPickerOpen }"
            :disabled="modelOptions.length === 0"
            :title="activeModel ? `当前模型：${activeModel}` : '选择模型'"
            :aria-label="activeModel ? `当前模型：${activeModel}` : '选择模型'"
            @click="toggleModelPicker"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 3l9 5-9 5-9-5 9-5z" />
              <path d="M3 12l9 5 9-5" />
              <path d="M3 17l9 5 9-5" />
            </svg>
          </button>
          <div v-if="modelPickerOpen" ref="modelPickerListRef" class="chat-input__model-list">
            <button
              v-for="model in modelOptions"
              :key="model"
              class="chat-input__model-item"
              :class="{ 'chat-input__model-item--active': model === activeModel }"
              @click="selectModel(model)"
            >
              <span class="chat-input__model-item-name">{{ model }}</span>
              <span v-if="model === activeModel" class="chat-input__model-item-check">✓</span>
            </button>
          </div>
        </div>
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
  </div>
</template>

<style scoped>
.chat-panel {
  width: var(--chat-width);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  backdrop-filter: blur(12px);
  animation: panel-rise 0.35s ease both;
}

/* 头部 */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--color-border);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.7));
  -webkit-app-region: drag;
}

.chat-header__left {
  display: flex;
  align-items: center;
  gap: 6px;
  -webkit-app-region: no-drag;
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
  letter-spacing: -0.02em;
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
.chat-header__control,
.chat-header__action {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  border: 1px solid transparent;
  color: var(--color-text-secondary);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
  -webkit-app-region: no-drag;
}

.chat-header__back:hover,
.chat-header__control:hover,
.chat-header__action:hover {
  background: white;
  border-color: var(--color-border);
  color: var(--color-text);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.chat-header__control--active {
  border-color: var(--color-primary);
  color: var(--color-text);
  box-shadow: 0 0 0 3px rgba(58, 109, 246, 0.12);
}

.chat-panel__tabs {
  display: flex;
  gap: 6px;
  padding: 12px 16px 8px;
}

.chat-panel__tab {
  flex: 1;
  padding: 7px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg-elevated);
  transition: all 0.2s ease;
}

.chat-panel__tab:hover {
  color: var(--color-text);
  border-color: var(--color-border-strong);
  background: white;
}

.chat-panel__tab--active {
  color: var(--color-text);
  background: linear-gradient(135deg, rgba(58, 109, 246, 0.18), rgba(17, 183, 165, 0.12));
  border-color: rgba(58, 109, 246, 0.45);
  box-shadow: var(--shadow-sm);
}

.chat-panel__section {
  padding: 10px 16px 14px;
  border-bottom: 1px solid var(--color-border);
}

.chat-control {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-control__tabs {
  display: flex;
  gap: 6px;
}

.chat-control__tab {
  flex: 1;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  font-size: 12px;
  color: var(--color-text-secondary);
  transition: all 0.2s ease;
}

.chat-control__tab:hover {
  color: var(--color-text);
  border-color: var(--color-border-strong);
  background: white;
}

.chat-control__tab--active {
  color: var(--color-text);
  background: linear-gradient(135deg, rgba(58, 109, 246, 0.18), rgba(17, 183, 165, 0.12));
  border-color: rgba(58, 109, 246, 0.45);
  box-shadow: var(--shadow-sm);
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
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.chat-history__item:hover {
  border-color: var(--color-border-strong);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.chat-history__item--active {
  border-color: rgba(58, 109, 246, 0.45);
  background: linear-gradient(135deg, rgba(58, 109, 246, 0.16), rgba(17, 183, 165, 0.1));
  box-shadow: var(--shadow-glow);
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
  background: var(--color-bg-elevated);
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
  background: var(--color-bg-elevated);
  color: var(--color-text);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.chat-settings__input:focus,
.chat-settings__textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(58, 109, 246, 0.15);
}

.chat-settings__save {
  align-self: flex-end;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  color: white;
  font-size: 12px;
  box-shadow: 0 8px 16px rgba(58, 109, 246, 0.25);
}

.chat-hotkey {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-hotkey__row {
  display: flex;
  align-items: stretch;
  gap: 10px;
}

.chat-hotkey__capture {
  flex: 1;
  min-height: 52px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  color: var(--color-text);
  transition: all 0.2s ease;
}

.chat-hotkey__capture:hover {
  border-color: var(--color-border-strong);
  background: white;
}

.chat-hotkey__capture--active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(58, 109, 246, 0.12);
}

.chat-hotkey__capture-label {
  font-size: 12px;
  color: var(--color-text-muted);
  min-width: 56px;
}

.chat-hotkey__capture-keys {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.chat-hotkey__capture-placeholder {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.chat-hotkey__capture-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chat-hotkey__key {
  padding: 4px 8px;
  border-radius: 8px;
  background: rgba(58, 109, 246, 0.12);
  border: 1px solid rgba(58, 109, 246, 0.3);
  font-size: 12px;
  color: var(--color-text);
}

.chat-hotkey__progress {
  font-size: 12px;
  color: var(--color-text-muted);
}

.chat-hotkey__reset {
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: white;
  font-size: 12px;
  color: var(--color-text-secondary);
  min-width: 96px;
  transition: all 0.2s ease;
}

.chat-hotkey__reset:hover {
  color: var(--color-text);
  border-color: var(--color-border-strong);
  background: var(--color-bg-elevated);
}

.chat-hotkey__hint {
  font-size: 12px;
  color: var(--color-text-muted);
}

.chat-hotkey__error {
  font-size: 12px;
  color: var(--color-error);
}

.chat-hotkey__current {
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* 消息列表 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chat-message {
  display: flex;
  gap: 12px;
  max-width: 88%;
  animation: message-rise 0.2s ease both;
}

.chat-message--user {
  flex-direction: row-reverse;
  align-self: flex-end;
}

.chat-message__avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.chat-message__content {
  padding: 10px 14px;
  border-radius: var(--radius-lg);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid transparent;
  box-shadow: var(--shadow-sm);
}

.chat-message--assistant .chat-message__content {
  background: rgba(255, 255, 255, 0.92);
  border-color: var(--color-border);
  color: var(--color-text);
}

.chat-message--user .chat-message__content {
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  color: white;
  box-shadow: 0 12px 24px rgba(58, 109, 246, 0.3);
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
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
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
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.7);
  border: 1px dashed var(--color-border);
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
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border);
  white-space: pre-wrap;
}

/* 输入区域 */
.chat-input {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  padding: 14px 18px;
  border-top: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(10px);
}

.chat-input__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.chat-input__model {
  position: relative;
}

.chat-input__model-btn {
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.chat-input__model-btn:hover:not(:disabled) {
  background: white;
  color: var(--color-text);
  border-color: var(--color-border-strong);
}

.chat-input__model-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-input__model-btn--active {
  border-color: var(--color-primary);
  color: var(--color-text);
  box-shadow: 0 0 0 3px rgba(58, 109, 246, 0.12);
}

.chat-input__model-list {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  min-width: 180px;
  max-height: 240px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  z-index: 10;
  backdrop-filter: blur(10px);
  overflow-y: auto;
}

.chat-input__model-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 8px;
  font-size: 12px;
  text-align: left;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.chat-input__model-item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-input__model-item:hover {
  background: var(--color-bg-soft);
  color: var(--color-text);
}

.chat-input__model-item--active {
  background: var(--color-bg-soft);
  color: var(--color-text);
}

.chat-input__model-item-check {
  font-size: 12px;
  color: var(--color-primary);
}

.chat-input__textarea {
  width: 100%;
  min-height: 84px;
  max-height: 180px;
  padding: 10px 12px;
  font-size: 13px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  color: var(--color-text);
  resize: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.chat-input__textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(58, 109, 246, 0.12);
}

.chat-input__send {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 10px 20px rgba(58, 109, 246, 0.25);
}

.chat-input__send:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(58, 109, 246, 0.3);
}

.chat-input__send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes panel-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes message-rise {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
