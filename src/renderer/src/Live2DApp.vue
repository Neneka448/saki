<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Live2DController, live2DModelManager } from './live2d'
import { loadChatSettings } from './services/chatStorage'

// 状态
const canvasRef = ref<HTMLDivElement>()
const controller = ref<Live2DController | null>(null)
const isLoading = ref(false)
const showMenu = ref(false)
const menuPosition = ref({ x: 0, y: 0 })

// 悬浮按钮
const isHovering = ref(false)
const hoverTimer = ref<number | null>(null)

// 对话功能
const showChatInput = ref(false)
const chatInputText = ref('')
const chatInputRef = ref<HTMLTextAreaElement>()
const sakiMessage = ref('')
const showSakiMessage = ref(false)
const sakiMessageTimer = ref<number | null>(null)
const isThinking = ref(false)
const isBottomHover = ref(false)
const isChatFocused = ref(false)

const isChatBarVisible = computed(() => isBottomHover.value || isChatFocused.value || showChatInput.value)

// 模型列表
const models = computed(() => live2DModelManager.getModels())
const selectedModelId = ref<string | null>(null)

// 拖动相关
const isDragging = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })

// 初始化
onMounted(async () => {
  if (canvasRef.value) {
    controller.value = new Live2DController()
    await controller.value.initialize(canvasRef.value)
    
    // 自动加载第一个模型
    const modelList = live2DModelManager.getModels()
    if (modelList.length > 0) {
      selectedModelId.value = modelList[0].id
      await loadModel(modelList[0].modelJsonPath)
    }
  }

  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  controller.value?.destroy()
})

function handleResize() {
  controller.value?.resize()
}

async function loadModel(modelJsonPath: string) {
  if (!controller.value) return
  isLoading.value = true
  await controller.value.loadModel(modelJsonPath)
  isLoading.value = false
}

// 右键菜单
function handleContextMenu(e: MouseEvent) {
  e.preventDefault()
  menuPosition.value = { x: e.clientX, y: e.clientY }
  showMenu.value = true
}

function hideMenu() {
  showMenu.value = false
}

// 导入模型
async function importModel() {
  hideMenu()
  // @ts-ignore
  const folderPath = await window.app?.selectFolder?.()
  if (!folderPath) return

  const asset = await live2DModelManager.importModel(folderPath)
  if (asset) {
    selectedModelId.value = asset.id
    await loadModel(asset.modelJsonPath)
  }
}

// 切换模型
async function selectModel(id: string) {
  hideMenu()
  const model = models.value.find(m => m.id === id)
  if (model) {
    selectedModelId.value = id
    await loadModel(model.modelJsonPath)
  }
}

// 关闭窗口
function closeWindow() {
  window.close()
}

// 拖动窗口（在无边框窗口中）
function startDrag(e: MouseEvent) {
  if (e.button !== 0) return // 只响应左键
  isDragging.value = true
  dragStartPos.value = { x: e.screenX, y: e.screenY }
  
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value) return
  
  const deltaX = e.screenX - dragStartPos.value.x
  const deltaY = e.screenY - dragStartPos.value.y
  
  // 通过 IPC 移动窗口
  // @ts-ignore
  window.app?.moveWindow?.(deltaX, deltaY)
  
  dragStartPos.value = { x: e.screenX, y: e.screenY }
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// 播放随机动作
function playRandomMotion() {
  hideMenu()
  if (!controller.value) return
  const motions = controller.value.getMotionList()
  if (motions.length > 0) {
    const randomMotion = motions[Math.floor(Math.random() * motions.length)]
    controller.value.playMotion(randomMotion)
  }
}

// 悬浮处理
function onMouseEnter() {
  if (hoverTimer.value) {
    clearTimeout(hoverTimer.value)
  }
  isHovering.value = true
}

function onMouseLeave() {
  hoverTimer.value = window.setTimeout(() => {
    isHovering.value = false
  }, 300)
}

// 快速记录
function openQuickCapture() {
  // @ts-ignore
  window.app?.showQuickCapture?.()
}

// 快速对话
function openChatInput() {
  showChatInput.value = true
  setTimeout(() => {
    chatInputRef.value?.focus()
    autoResizeTextarea()
  }, 100)
}

function closeChatInput() {
  showChatInput.value = false
  chatInputText.value = ''
  chatInputRef.value?.blur()
}

function handleMouseMoveInWindow(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement | null
  if (!target) return
  const rect = target.getBoundingClientRect()
  const y = e.clientY - rect.top
  // 迟滞阈值：避免在 80% 附近来回抖动导致闪烁
  const showAt = rect.height * 0.82
  const hideAt = rect.height * 0.78
  if (showChatInput.value || isChatFocused.value) {
    isBottomHover.value = false
    return
  }
  if (!isBottomHover.value) {
    isBottomHover.value = y >= showAt
    return
  }
  isBottomHover.value = y >= hideAt
}

function handleContainerMouseLeave() {
  onMouseLeave()
  isBottomHover.value = false
}

// 简化版的 AI 对话系统提示
const SAKI_SYSTEM_PROMPT = `你是 Saki，一个可爱的桌宠助手。你的回复需要：
1. 简短友好，像朋友聊天一样（最多 2-3 句话）
2. 偶尔加入可爱的语气词或表情
3. 如果用户问复杂问题，可以建议他们去主界面找你详聊
4. 保持积极乐观的态度`

async function sendChat() {
  const text = chatInputText.value.trim()
  if (!text || isThinking.value) return
  
  closeChatInput()
  isThinking.value = true
  
  // 显示思考中
  showSakiReply('让我想想...')
  playThinkingMotion()
  
  try {
    const settings = loadChatSettings()
    
    // 检查是否配置了 API
    if (!settings.endpoint || !settings.apiKey) {
      showSakiReply('主人还没有配置 API 呢，去设置里配置一下吧~')
      playHappyMotion()
      return
    }
    
    // 调用 AI API
    const response = await callSakiAI(settings, text)
    showSakiReply(response)
    playHappyMotion()
  } catch (error) {
    console.error('Saki chat error:', error)
    showSakiReply('呜...出了点问题，待会再试试吧~')
  } finally {
    isThinking.value = false
  }
}

async function callSakiAI(settings: { endpoint: string; path: string; apiKey: string; modelsText: string }, userMessage: string): Promise<string> {
  const url = buildUrl(settings.endpoint, settings.path)
  
  // 解析模型列表，使用第一个模型
  const models = settings.modelsText.split('\n').map(s => s.trim()).filter(Boolean)
  const model = models[0] || 'gpt-3.5-turbo'
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SAKI_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.8,
      max_tokens: 150,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }
  
  const data = await response.json()
  return data.choices?.[0]?.message?.content || '嗯...我不知道该说什么~'
}

function buildUrl(endpoint: string, path: string): string {
  const trimmedEndpoint = endpoint.trim().replace(/\/+$/, '')
  const trimmedPath = path.trim()
  if (!trimmedEndpoint) return ''
  if (trimmedPath.startsWith('http')) return trimmedPath
  const normalizedPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`
  return `${trimmedEndpoint}${normalizedPath}`
}

function showSakiReply(message: string) {
  sakiMessage.value = message
  showSakiMessage.value = true
  
  // 清除之前的定时器（如果有）
  if (sakiMessageTimer.value) {
    clearTimeout(sakiMessageTimer.value)
    sakiMessageTimer.value = null
  }
  // 不再自动隐藏，用户点击关闭按钮才隐藏
}

function hideSakiMessage() {
  showSakiMessage.value = false
  if (sakiMessageTimer.value) {
    clearTimeout(sakiMessageTimer.value)
    sakiMessageTimer.value = null
  }
}

function playThinkingMotion() {
  if (!controller.value) return
  const motions = controller.value.getMotionList()
  const thinkingMotion = motions.find(m => m.toLowerCase().includes('think'))
  if (thinkingMotion) {
    controller.value.playMotion(thinkingMotion)
  }
}

function playHappyMotion() {
  if (!controller.value) return
  const motions = controller.value.getMotionList()
  const happyMotion = motions.find(m => m.toLowerCase().includes('smile') || m.toLowerCase().includes('happy'))
  if (happyMotion) {
    controller.value.playMotion(happyMotion)
  }
}

function handleChatKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    sendChat()
  } else if (e.key === 'Escape') {
    closeChatInput()
  }
}

// 自动调整输入框高度
function autoResizeTextarea() {
  const textarea = chatInputRef.value
  if (!textarea) return
  // 让默认高度严格为 1 行（避免初始就像两行）
  const minHeight = 20
  const maxHeight = 80
  textarea.style.height = 'auto'
  const nextHeight = Math.min(maxHeight, Math.max(minHeight, textarea.scrollHeight))
  textarea.style.height = nextHeight + 'px'
}

function handleChatFocus() {
  isChatFocused.value = true
  showChatInput.value = true
}

function handleChatBlur() {
  isChatFocused.value = false
  if (!isBottomHover.value) {
    showChatInput.value = false
  }
}

function handleChatBarClick() {
  showChatInput.value = true
  setTimeout(() => {
    chatInputRef.value?.focus()
    autoResizeTextarea()
  }, 0)
}
</script>

<template>
  <div 
    class="pet-container"
    @mouseenter="onMouseEnter"
    @mouseleave="handleContainerMouseLeave"
    @mousemove="handleMouseMoveInWindow"
    @contextmenu="handleContextMenu"
    @click="hideMenu"
  >
    <!-- 拖动区域 -->
    <div class="drag-area" @mousedown="startDrag"></div>
    
    <div ref="canvasRef" class="canvas-container"></div>

    <!-- Saki 对话气泡 -->
    <div v-if="showSakiMessage" class="saki-bubble">
      <button class="saki-bubble__close" @click="hideSakiMessage" title="关闭">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <div class="saki-bubble__content">{{ sakiMessage }}</div>
      <div class="saki-bubble__arrow"></div>
    </div>

    <!-- 悬浮操作按钮（都放左边） -->
    <div v-if="isHovering && !showChatInput" class="action-buttons">
      <button class="action-btn action-btn--top" @click="openQuickCapture" title="快速记录">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button class="action-btn action-btn--bottom" @click="openChatInput" title="快速对话">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    </div>

    <!-- 对话输入条：底部悬停/聚焦时显示；点击即可输入 -->
    <div
      class="chat-input-container"
      :class="{ 'chat-input-container--visible': isChatBarVisible }"
      @click.stop="handleChatBarClick"
    >
      <textarea
        ref="chatInputRef"
        v-model="chatInputText"
        class="chat-input"
        rows="1"
        placeholder="点一下开始输入…（⌘+Enter 发送）"
        @keydown="handleChatKeydown"
        @input="autoResizeTextarea"
        @focus="handleChatFocus"
        @blur="handleChatBlur"
      ></textarea>
      <button class="chat-send-btn" @click="sendChat" :disabled="!chatInputText.trim()" title="⌘+Enter 发送">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
      <button class="chat-close-btn" @click="closeChatInput">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- 加载指示器 -->
    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
    </div>

    <!-- 右键菜单 -->
    <div 
      v-if="showMenu" 
      class="context-menu"
      :style="{ left: menuPosition.x + 'px', top: menuPosition.y + 'px' }"
      @click.stop
    >
      <div class="menu-item" @click="playRandomMotion">🎭 随机动作</div>
      <div class="menu-divider"></div>
      <div class="menu-label">切换模型</div>
      <div 
        v-for="model in models" 
        :key="model.id"
        class="menu-item"
        :class="{ active: selectedModelId === model.id }"
        @click="selectModel(model.id)"
      >
        {{ model.name }}
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item" @click="importModel">📁 导入模型...</div>
      <div class="menu-divider"></div>
      <div class="menu-item danger" @click="closeWindow">✕ 关闭</div>
    </div>
  </div>
</template>

<style scoped>
.pet-container {
  width: 100vw;
  height: 100vh;
  background: transparent;
  cursor: grab;
  user-select: none;
}

.drag-area {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  cursor: grab;
  z-index: 5;
}

.drag-area:active {
  cursor: grabbing;
}

.canvas-container {
  width: 100%;
  height: 100%;
  /* 让 canvas 可以接收鼠标事件，用于检测是否在角色上 */
}

/* Saki 对话气泡 - 贴近人物头顶，文字多时往上延伸 */
.saki-bubble {
  position: absolute;
  bottom: calc(100% - 110px);  /* 上移 40px，更贴近人物头顶 */
  left: 5px;
  right: 5px;
  max-height: 160px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 10px;
  padding: 8px 12px;
  padding-right: 28px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  animation: bubble-in 0.3s ease;
  z-index: 30;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.saki-bubble__close {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 16px;
  height: 16px;
  border: none;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  cursor: pointer;
  transition: all 0.15s ease;
}

.saki-bubble__close:hover {
  background: rgba(0, 0, 0, 0.2);
  color: #333;
}

.saki-bubble__content {
  font-size: 12px;
  color: #1d1d1f;
  line-height: 1.4;
  max-height: 120px;
  overflow-y: auto;
}

.saki-bubble__content::-webkit-scrollbar {
  width: 4px;
}

.saki-bubble__content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}

.saki-bubble__arrow {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid rgba(255, 255, 255, 0.95);
}

@keyframes bubble-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 悬浮操作按钮 - 都放左边垂直排列 */
.action-buttons {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
  z-index: 20;
}

.action-btn {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0071e3;
  cursor: pointer;
  pointer-events: auto;
  transition: all 0.2s ease;
  animation: btn-fade-in 0.2s ease;
}

.action-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 16px rgba(0, 113, 227, 0.3);
}

@keyframes btn-fade-in {
  from {
    opacity: 0;
    transform: scale(0.5);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 对话输入框 */
.chat-input-container {
  position: absolute;
  left: 50%;
  /* 与提示条同位置：底部 20% 区域内 */
  top: 88%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 14px;
  padding: 4px 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  animation: input-slide-up 0.2s ease;
  z-index: 20;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
}

.chat-input-container--visible {
  opacity: 1;
  pointer-events: auto;
}

.chat-input {
  width: 200px;
  height: 20px;
  min-height: 20px;
  max-height: 80px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: #1d1d1f;
  outline: none;
  resize: none;
  font-family: inherit;
  line-height: 20px;
  padding: 0;
  margin: 0;
  overflow: hidden;
}

.chat-input::placeholder {
  color: #86868b;
}

.chat-send-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: #0071e3;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease;
}

.chat-send-btn:hover:not(:disabled) {
  background: #0077ed;
}

.chat-send-btn:disabled {
  background: #c7c7cc;
  cursor: not-allowed;
}

.chat-close-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #86868b;
  cursor: pointer;
}

.chat-close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #1d1d1f;
}

@keyframes input-slide-up {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.context-menu {
  position: fixed;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 6px 0;
  min-width: 160px;
  z-index: 1000;
}

.menu-item {
  padding: 8px 16px;
  font-size: 13px;
  color: #1d1d1f;
  cursor: pointer;
  transition: background 0.15s ease;
}

.menu-item:hover {
  background: rgba(0, 113, 227, 0.1);
}

.menu-item.active {
  color: #0071e3;
  font-weight: 500;
}

.menu-item.danger {
  color: #ff3b30;
}

.menu-item.danger:hover {
  background: rgba(255, 59, 48, 0.1);
}

.menu-label {
  padding: 6px 16px 4px;
  font-size: 11px;
  color: #86868b;
  font-weight: 600;
  text-transform: uppercase;
}

.menu-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.1);
  margin: 4px 0;
}
</style>
