<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { Live2DController, live2DModelManager, type Live2DModelAsset } from '../live2d'

const emit = defineEmits<{
  (e: 'close'): void
}>()

// 状态
const canvasRef = ref<HTMLDivElement>()
const controller = ref<Live2DController | null>(null)
const isInitialized = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')

// 模型列表
const models = ref<Live2DModelAsset[]>([])
const selectedModelId = ref<string | null>(null)

// 动作和表情
const motionList = ref<string[]>([])
const expressionList = ref<string[]>([])
const currentMotion = ref('')
const currentExpression = ref('')

// 搜索过滤
const motionSearch = ref('')
const expressionSearch = ref('')

// 计算属性：过滤后的动作列表
const filteredMotions = computed(() => {
  if (!motionSearch.value.trim()) {
    return motionList.value
  }
  const query = motionSearch.value.toLowerCase()
  return motionList.value.filter((m) => m.toLowerCase().includes(query))
})

// 计算属性：过滤后的表情列表
const filteredExpressions = computed(() => {
  if (!expressionSearch.value.trim()) {
    return expressionList.value
  }
  const query = expressionSearch.value.toLowerCase()
  return expressionList.value.filter((e) => e.toLowerCase().includes(query))
})

// 选中的模型
const selectedModel = computed(() => {
  if (!selectedModelId.value) return null
  return models.value.find((m) => m.id === selectedModelId.value) || null
})

// 初始化
onMounted(async () => {
  loadModels()

  if (canvasRef.value) {
    controller.value = new Live2DController()
    const success = await controller.value.initialize(canvasRef.value)
    isInitialized.value = success

    if (!success) {
      errorMessage.value = 'Live2D 初始化失败，请检查依赖是否正确安装'
    }
  }

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  controller.value?.destroy()
})

// 加载模型列表
function loadModels() {
  models.value = live2DModelManager.getModels()
}

// 处理窗口大小变化
function handleResize() {
  controller.value?.resize()
}

// 导入模型文件夹
async function importModelFolder() {
  try {
    // 使用 Electron 的文件对话框
    // @ts-ignore - window.app 是 preload 注入的
    const result = await window.app?.selectFolder?.()
    if (!result) {
      return
    }

    isLoading.value = true
    errorMessage.value = ''

    const asset = await live2DModelManager.importModel(result)
    if (asset) {
      loadModels()
      selectedModelId.value = asset.id
      await loadSelectedModel()
    } else {
      errorMessage.value = '导入失败，请确保文件夹包含有效的 model.json'
    }
  } catch (error) {
    console.error('Import failed:', error)
    errorMessage.value = '导入失败: ' + (error as Error).message
  } finally {
    isLoading.value = false
  }
}

// 加载选中的模型
async function loadSelectedModel() {
  if (!controller.value || !selectedModel.value) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const success = await controller.value.loadModel(selectedModel.value.modelJsonPath)
    if (success) {
      motionList.value = controller.value.getMotionList()
      expressionList.value = controller.value.getExpressionList()
      currentMotion.value = ''
      currentExpression.value = ''

      // 如果从 model.json 解析的列表更完整，使用那个
      if (selectedModel.value.motions.length > motionList.value.length) {
        motionList.value = selectedModel.value.motions
      }
      if (selectedModel.value.expressions.length > expressionList.value.length) {
        expressionList.value = selectedModel.value.expressions
      }
    } else {
      errorMessage.value = '模型加载失败'
    }
  } catch (error) {
    console.error('Load model failed:', error)
    errorMessage.value = '加载失败: ' + (error as Error).message
  } finally {
    isLoading.value = false
  }
}

// 播放动作
function playMotion(motion: string) {
  if (controller.value?.playMotion(motion)) {
    currentMotion.value = motion
  }
}

// 设置表情
function setExpression(expression: string) {
  if (controller.value?.setExpression(expression)) {
    currentExpression.value = expression
  }
}

// 删除模型
function removeModel(id: string) {
  if (confirm('确定要移除这个模型吗？（不会删除原文件）')) {
    live2DModelManager.removeModel(id)
    loadModels()

    if (selectedModelId.value === id) {
      selectedModelId.value = null
      motionList.value = []
      expressionList.value = []
    }
  }
}

// 监听模型选择变化
watch(selectedModelId, () => {
  if (selectedModelId.value) {
    loadSelectedModel()
  }
})
</script>

<template>
  <div class="live2d-viewer">
    <!-- 头部 -->
    <header class="viewer-header">
      <h2>Live2D 角色查看器</h2>
      <button class="close-btn" @click="emit('close')" title="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </header>

    <div class="viewer-body">
      <!-- 左侧：模型列表 -->
      <aside class="model-sidebar">
        <div class="sidebar-header">
          <span>模型列表</span>
          <button class="import-btn" @click="importModelFolder" :disabled="isLoading">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            导入
          </button>
        </div>

        <div class="model-list">
          <div
            v-for="model in models"
            :key="model.id"
            class="model-item"
            :class="{ active: selectedModelId === model.id }"
            @click="selectedModelId = model.id"
          >
            <div class="model-info">
              <div class="model-name">{{ model.name }}</div>
              <div class="model-meta">
                {{ model.motions.length }} 动作 · {{ model.expressions.length }} 表情
              </div>
            </div>
            <button class="remove-btn" @click.stop="removeModel(model.id)" title="移除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div v-if="models.length === 0" class="empty-hint">
            点击"导入"按钮<br />添加 Live2D 模型文件夹
          </div>
        </div>
      </aside>

      <!-- 中间：Canvas 渲染区 -->
      <main class="canvas-area">
        <div ref="canvasRef" class="canvas-container"></div>

        <!-- 加载中 -->
        <div v-if="isLoading" class="loading-overlay">
          <div class="spinner"></div>
          <span>加载中...</span>
        </div>

        <!-- 错误提示 -->
        <div v-if="errorMessage" class="error-overlay">
          <span>{{ errorMessage }}</span>
        </div>

        <!-- 空状态 -->
        <div v-if="!selectedModel && !isLoading" class="empty-overlay">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
          </svg>
          <span>选择或导入一个模型</span>
        </div>
      </main>

      <!-- 右侧：控制面板 -->
      <aside class="control-sidebar" v-if="selectedModel">
        <!-- 动作列表 -->
        <div class="control-section">
          <div class="section-header">
            <span>动作 ({{ filteredMotions.length }})</span>
          </div>
          <input
            v-model="motionSearch"
            type="text"
            class="search-input"
            placeholder="搜索动作..."
          />
          <div class="action-list">
            <button
              v-for="motion in filteredMotions"
              :key="motion"
              class="action-btn"
              :class="{ active: currentMotion === motion }"
              @click="playMotion(motion)"
            >
              {{ motion }}
            </button>
          </div>
        </div>

        <!-- 表情列表 -->
        <div class="control-section">
          <div class="section-header">
            <span>表情 ({{ filteredExpressions.length }})</span>
          </div>
          <input
            v-model="expressionSearch"
            type="text"
            class="search-input"
            placeholder="搜索表情..."
          />
          <div class="action-list">
            <button
              v-for="expression in filteredExpressions"
              :key="expression"
              class="action-btn"
              :class="{ active: currentExpression === expression }"
              @click="setExpression(expression)"
            >
              {{ expression }}
            </button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.live2d-viewer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg, #f5f5f7);
  display: flex;
  flex-direction: column;
  z-index: 1000;
}

.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.9);
  border-bottom: 1px solid var(--color-border, #e5e5e5);
  backdrop-filter: blur(12px);
  -webkit-app-region: drag;
}

.viewer-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text, #1d1d1f);
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary, #86868b);
  cursor: pointer;
  -webkit-app-region: no-drag;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-text, #1d1d1f);
}

.viewer-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧模型列表 */
.model-sidebar {
  width: 240px;
  background: rgba(255, 255, 255, 0.9);
  border-right: 1px solid var(--color-border, #e5e5e5);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary, #86868b);
  border-bottom: 1px solid var(--color-border, #e5e5e5);
}

.import-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: none;
  background: var(--color-primary, #0071e3);
  color: white;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.import-btn:hover {
  background: var(--color-primary-hover, #0077ed);
}

.import-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.model-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.model-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  margin-bottom: 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.model-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

.model-item.active {
  background: rgba(0, 113, 227, 0.1);
}

.model-info {
  flex: 1;
  min-width: 0;
}

.model-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text, #1d1d1f);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.model-meta {
  font-size: 11px;
  color: var(--color-text-tertiary, #aeaeb2);
  margin-top: 2px;
}

.remove-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary, #aeaeb2);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.model-item:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background: rgba(255, 59, 48, 0.1);
  color: #ff3b30;
}

.empty-hint {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-text-tertiary, #aeaeb2);
  font-size: 13px;
  line-height: 1.6;
}

/* 中间 Canvas 区域 */
.canvas-area {
  flex: 1;
  position: relative;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  overflow: hidden;
}

.canvas-container {
  width: 100%;
  height: 100%;
}

.loading-overlay,
.error-overlay,
.empty-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.9);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border, #e5e5e5);
  border-top-color: var(--color-primary, #0071e3);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-overlay {
  color: #ff3b30;
}

.empty-overlay {
  color: var(--color-text-tertiary, #aeaeb2);
}

/* 右侧控制面板 */
.control-sidebar {
  width: 280px;
  background: rgba(255, 255, 255, 0.9);
  border-left: 1px solid var(--color-border, #e5e5e5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.control-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-bottom: 1px solid var(--color-border, #e5e5e5);
}

.control-section:last-child {
  border-bottom: none;
}

.section-header {
  padding: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary, #86868b);
  flex-shrink: 0;
}

.search-input {
  margin: 0 12px 8px;
  padding: 8px 10px;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 6px;
  font-size: 12px;
  outline: none;
  flex-shrink: 0;
}

.search-input:focus {
  border-color: var(--color-primary, #0071e3);
}

.action-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-content: flex-start;
}

.action-btn {
  padding: 6px 10px;
  border: 1px solid var(--color-border, #e5e5e5);
  background: white;
  border-radius: 6px;
  font-size: 11px;
  color: var(--color-text, #1d1d1f);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.action-btn:hover {
  background: var(--color-bg-elevated, #f5f5f7);
  border-color: var(--color-primary, #0071e3);
}

.action-btn.active {
  background: var(--color-primary, #0071e3);
  border-color: var(--color-primary, #0071e3);
  color: white;
}
</style>
