<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { keymap } from '@codemirror/view'
import { CodeMirrorEditor } from '../editor'
import TagPicker from './components/TagPicker.vue'
import MetadataPicker, { type MetadataFields } from './components/MetadataPicker.vue'
import MarkdownRenderer from '../components/card/MarkdownRenderer.vue'
import type { CardListItem, Project, TagWithMeta } from '../../../shared/ipc/types'
import { normalizeCardReferences } from '../utils/referenceUtils'
import { syncCardReferences } from '../services/referenceSync'

const editorRef = ref<InstanceType<typeof CodeMirrorEditor> | null>(null)
const activeProjectId = ref<number | null>(null)
const project = ref<Project | null>(null)
const allTags = ref<TagWithMeta[]>([])
const referenceCandidates = ref<CardListItem[]>([])
const selectedTagIds = ref<number[]>([])
const metadata = ref<MetadataFields>({})
const content = ref('')
const isLoading = ref(false)
const isSaving = ref(false)
const saveError = ref('')
const loadError = ref('')
const lastProjectId = ref<number | null>(null)
const isPinned = ref(false)
const isPreviewMode = ref(false)

const togglePreview = () => {
  isPreviewMode.value = !isPreviewMode.value
  if (!isPreviewMode.value) {
    focusEditor()
  }
}

const isReady = computed(() => Boolean(activeProjectId.value && project.value))
const canSave = computed(() => Boolean(isReady.value && content.value.trim() && !isSaving.value && !isLoading.value))
const statusText = computed(() => {
  if (isSaving.value) return '保存中...'
  if (saveError.value) return saveError.value
  return content.value.trim() ? '未保存' : '等待输入'
})

watch(content, () => {
  if (saveError.value) {
    saveError.value = ''
  }
})

const togglePin = async () => {
  isPinned.value = !isPinned.value
  await window.app.setQuickCapturePinned(isPinned.value)
}

const focusEditor = async () => {
  await nextTick()
  editorRef.value?.focus()
}

const loadProjectContext = async (projectId: number) => {
  isLoading.value = true
  loadError.value = ''
  try {
    const [projectResult, tagsResult, cardsResult] = await Promise.all([
      window.project.getById(projectId),
      window.tag.getAllUserTags(projectId),
      window.card.getListByProject(projectId),
    ])

    project.value = projectResult.success ? projectResult.data : null
    allTags.value = tagsResult.success ? tagsResult.data : []
    referenceCandidates.value = cardsResult.success ? cardsResult.data : []

    if (!projectResult.success) {
      loadError.value = '无法加载项目，请确认主窗口状态'
    }
  } catch (e) {
    console.error('Failed to load quick capture context:', e)
    loadError.value = '加载失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

const applyProjectId = async (projectId: number | null) => {
  activeProjectId.value = projectId
  if (!projectId) {
    project.value = null
    allTags.value = []
    referenceCandidates.value = []
    loadError.value = ''
    content.value = ''
    selectedTagIds.value = []
    metadata.value = {}
    lastProjectId.value = null
    return
  }

  if (projectId !== lastProjectId.value) {
    content.value = ''
    selectedTagIds.value = []
    metadata.value = {}
  }
  lastProjectId.value = projectId
  await loadProjectContext(projectId)
}

const requestClose = () => {
  if (window.app?.hideQuickCapture) {
    window.app.hideQuickCapture()
    return
  }
  window.close()
}

const saveCard = async () => {
  if (!activeProjectId.value) return
  if (!content.value.trim()) return

  saveError.value = ''
  let normalizedContent = content.value
  try {
    const normalized = normalizeCardReferences(content.value)
    normalizedContent = normalized.content
    if (normalizedContent !== content.value) {
      content.value = normalizedContent
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : '引用结构错误'
    saveError.value = `引用结构错误：${message}`
    return
  }

  isSaving.value = true
  try {
    // Prepare metadata with source information
    const metaExtra: Record<string, unknown> = {}
    if (metadata.value.sourceUrl) {
      metaExtra.sourceUrl = metadata.value.sourceUrl
    }
    if (metadata.value.sourcePath) {
      metaExtra.sourcePath = metadata.value.sourcePath
    }

    const result = await window.card.create({
      projectId: activeProjectId.value,
      content: normalizedContent,
      meta: Object.keys(metaExtra).length > 0 ? { extra: metaExtra } : undefined,
    })

    if (!result.success) {
      saveError.value = result.error || '保存失败'
      return
    }

    const cardId = result.data.id
    await syncCardReferences(cardId, activeProjectId.value, normalizedContent)

    if (selectedTagIds.value.length > 0) {
      await Promise.all(selectedTagIds.value.map((tagId) => window.card.addTag(cardId, tagId)))
    }

    content.value = ''
    selectedTagIds.value = []
    metadata.value = {}
    requestClose()
  } catch (e) {
    console.error('Failed to save quick capture card:', e)
    saveError.value = '保存失败，请稍后重试'
  } finally {
    isSaving.value = false
  }
}

const handleCreateTag = async (name: string) => {
  if (!activeProjectId.value) return
  const trimmed = name.trim()
  if (!trimmed) return

  try {
    const result = await window.tag.getOrCreate(activeProjectId.value, trimmed)
    if (!result.success) return

    const exists = allTags.value.some((tag) => tag.id === result.data.id)
    if (!exists) {
      allTags.value = [...allTags.value, result.data]
    }
    if (!selectedTagIds.value.includes(result.data.id)) {
      selectedTagIds.value = [...selectedTagIds.value, result.data.id]
    }
  } catch (e) {
    console.error('Failed to create tag:', e)
  }
}

const editorExtensions = [
  keymap.of([
    {
      key: 'Mod-Enter',
      run: () => {
        saveCard()
        return true
      },
    },
    {
      key: 'Escape',
      run: () => {
        requestClose()
        return true
      },
    },
  ]),
]

let removeListener: (() => void) | null = null

const handleWindowFocus = () => {
  focusEditor()
  if (activeProjectId.value && !isLoading.value && !isSaving.value) {
    loadProjectContext(activeProjectId.value)
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    requestClose()
  }
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    saveCard()
  }
}

onMounted(async () => {
  const projectId = await window.app.getActiveProjectId()
  await applyProjectId(projectId)
  await focusEditor()

  // 获取固定状态
  isPinned.value = await window.app.isQuickCapturePinned()

  removeListener = window.app.onActiveProjectChanged((nextId) => {
    applyProjectId(nextId)
  })

  window.addEventListener('focus', handleWindowFocus)
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  removeListener?.()
  window.removeEventListener('focus', handleWindowFocus)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="quick-capture-window">
    <!-- 拖拽区域 & 顶部状态 -->
    <div class="window-drag-handle">
      <div v-if="project" class="header-left">
        <div class="project-badge">
          <span class="project-dot"></span>
          {{ project.name }}
        </div>
        <MetadataPicker
          v-model="metadata"
          :disabled="!activeProjectId || isLoading"
        />
      </div>
      <div class="window-actions">
        <button 
          class="pin-btn" 
          :class="{ 'pin-btn--active': isPinned }"
          :title="isPinned ? '取消固定' : '固定窗口'"
          @click="togglePin"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L12 12M12 12L8 8M12 12L16 8" :transform="isPinned ? 'rotate(180 12 12)' : ''"></path>
            <line x1="5" y1="22" x2="19" y2="22"></line>
          </svg>
        </button>
        <button class="close-btn" @click="requestClose">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>

    <section v-if="!activeProjectId" class="empty-state">
      <div class="empty-content">
        <div class="empty-icon">📂</div>
        <h3>选择一个项目</h3>
        <p>请在主窗口中激活一个项目以开始记录</p>
      </div>
    </section>

    <section v-else class="capture-content">
      <!-- 预览切换按钮 -->
      <div class="mode-switcher">
        <button 
          class="mode-btn" 
          :class="{ 'mode-btn--active': !isPreviewMode }"
          @click="isPreviewMode = false"
        >
          编辑
        </button>
        <button 
          class="mode-btn" 
          :class="{ 'mode-btn--active': isPreviewMode }"
          :disabled="!content.trim()"
          @click="isPreviewMode = true"
        >
          预览
        </button>
      </div>

      <div class="editor-wrapper">
        <!-- 编辑模式 -->
        <CodeMirrorEditor
          v-if="!isPreviewMode"
          ref="editorRef"
          v-model="content"
          :auto-focus="true"
          :reference-candidates="referenceCandidates"
          :tag-candidates="allTags"
          :extensions="editorExtensions"
          placeholder="捕捉你的想法..."
          @save="saveCard"
        />
        <!-- 预览模式 -->
        <div v-else class="preview-wrapper">
          <MarkdownRenderer :content="content" />
        </div>
      </div>

      <!-- 底部工具栏 -->
      <div class="action-bar">
        <div class="tag-area">
          <TagPicker
            v-model="selectedTagIds"
            :tags="allTags"
            :disabled="!activeProjectId || isLoading"
            @create="handleCreateTag"
          />
        </div>
        
        <div class="primary-actions">
          <span v-if="saveError" class="error-msg">{{ saveError }}</span>
          <span v-else-if="isSaving" class="status-msg">保存中...</span>
          
          <button 
            class="save-btn" 
            :disabled="!canSave"
            @click="saveCard"
          >
            <span class="save-icon">↵</span>
            保存
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.quick-capture-window {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  transition: all 0.2s ease;
}

.window-drag-handle {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  -webkit-app-region: drag;
  z-index: 10;
}

.project-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: rgba(255, 255, 255, 0.5);
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.04);
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.project-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: 0 0 8px var(--color-primary);
}

.window-actions {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  gap: 4px;
}

.pin-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.pin-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--color-text);
}

.pin-btn--active {
  color: var(--color-primary);
  background: rgba(58, 109, 246, 0.1);
}

.pin-btn--active:hover {
  background: rgba(58, 109, 246, 0.15);
  color: var(--color-primary);
}

.close-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--color-text);
}

.capture-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mode-switcher {
  display: flex;
  gap: 4px;
  padding: 8px 24px;
  border-bottom: 1px solid var(--color-border);
}

.mode-btn {
  padding: 4px 12px;
  font-size: 12px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
}

.mode-btn:hover:not(:disabled) {
  background: var(--color-bg-soft);
  color: var(--color-text);
}

.mode-btn--active {
  background: var(--color-primary);
  color: white;
}

.mode-btn--active:hover {
  background: var(--color-primary);
  color: white;
}

.mode-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.editor-wrapper {
  flex: 1;
  padding: 0 24px;
  overflow-y: auto;
  /* 隐藏滚动条但保持功能 */
  scrollbar-width: none;
}

.editor-wrapper::-webkit-scrollbar {
  display: none;
}

.preview-wrapper {
  padding: 16px 0;
  font-size: 15px;
  line-height: 1.7;
}

/* 深度选择器修改 CodeMirror 样式 */
:deep(.cm-editor) {
  height: 100%;
  background: transparent !important;
}

:deep(.cm-scroller) {
  font-family: var(--font-sans);
  font-size: 18px;
  line-height: 1.6;
}

:deep(.cm-content) {
  padding: 12px 0;
  max-width: 100%;
}

:deep(.cm-line) {
  padding: 0 !important;
}

:deep(.cm-activeLine), :deep(.cm-activeLineGutter) {
  background: transparent !important;
}

:deep(.cm-focused) {
  outline: none !important;
}

.action-bar {
  padding: 16px 24px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: linear-gradient(to top, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 100%);
}

.tag-area {
  flex: 1;
  min-width: 0;
}

.primary-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-msg, .error-msg {
  font-size: 12px;
  font-weight: 500;
}

.status-msg { color: var(--color-text-muted); }
.error-msg { color: var(--color-error); }

.save-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--color-text);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.save-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.save-icon {
  font-size: 16px;
  line-height: 1;
  opacity: 0.8;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.empty-content {
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-content h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 8px;
}

.empty-content p {
  font-size: 13px;
}
</style>
