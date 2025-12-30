<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { keymap } from '@codemirror/view'
import { CodeMirrorEditor } from '../editor'
import TagPicker from './components/TagPicker.vue'
import type { CardListItem, Project, TagWithMeta } from '../../../shared/ipc/types'
import { normalizeCardReferences } from '../utils/referenceUtils'
import { syncCardReferences } from '../services/referenceSync'

const editorRef = ref<InstanceType<typeof CodeMirrorEditor> | null>(null)
const activeProjectId = ref<number | null>(null)
const project = ref<Project | null>(null)
const allTags = ref<TagWithMeta[]>([])
const referenceCandidates = ref<CardListItem[]>([])
const selectedTagIds = ref<number[]>([])
const content = ref('')
const isLoading = ref(false)
const isSaving = ref(false)
const saveError = ref('')
const loadError = ref('')
const lastProjectId = ref<number | null>(null)

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
    lastProjectId.value = null
    return
  }

  if (projectId !== lastProjectId.value) {
    content.value = ''
    selectedTagIds.value = []
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
    const result = await window.card.create({
      projectId: activeProjectId.value,
      content: normalizedContent,
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
  <div class="quick-capture">
    <div class="quick-capture__panel">
      <header class="quick-capture__header">
        <div class="quick-capture__title">
          <span class="quick-capture__title-label">快速记录</span>
          <span v-if="project" class="quick-capture__title-project">
            {{ project.name }}
          </span>
        </div>
        <div class="quick-capture__actions">
          <button type="button" class="quick-capture__close" @click="requestClose">x</button>
        </div>
      </header>

      <section v-if="!activeProjectId" class="quick-capture__empty">
        <div class="quick-capture__empty-card">
          <span class="quick-capture__empty-title">请先在主窗口选择项目</span>
          <span class="quick-capture__empty-desc">快速记录会自动使用主窗口当前项目</span>
        </div>
      </section>

      <section v-else class="quick-capture__body">
        <div class="quick-capture__meta">
          <TagPicker
            v-model="selectedTagIds"
            :tags="allTags"
            :disabled="!activeProjectId || isLoading"
            @create="handleCreateTag"
          />
        </div>

        <div class="quick-capture__editor">
          <CodeMirrorEditor
            ref="editorRef"
            v-model="content"
            :auto-focus="true"
            :reference-candidates="referenceCandidates"
            :extensions="editorExtensions"
            placeholder="写点什么... 支持 Markdown 与粘贴图片"
            @save="saveCard"
          />
        </div>
      </section>

      <footer class="quick-capture__footer">
        <div class="quick-capture__status">
          <span v-if="loadError" class="quick-capture__status-error">{{ loadError }}</span>
          <span v-else>{{ statusText }}</span>
        </div>
        <div class="quick-capture__buttons">
          <button type="button" class="btn btn--ghost" @click="requestClose">取消</button>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="!canSave"
            @click="saveCard"
          >
            保存
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.quick-capture {
  width: 100vw;
  height: 100vh;
  padding: 12px;
}

.quick-capture__panel {
  height: 100%;
  background: rgba(255, 255, 255, 0.94);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.quick-capture__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: linear-gradient(135deg, rgba(58, 109, 246, 0.12), rgba(17, 183, 165, 0.08));
  -webkit-app-region: drag;
}

.quick-capture__title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.quick-capture__title-label {
  font-size: 14px;
  font-weight: 600;
  font-family: var(--font-display);
}

.quick-capture__title-project {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.quick-capture__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.quick-capture__close {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.quick-capture__close:hover {
  color: var(--color-text);
  background: white;
}

.quick-capture__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px 8px;
  overflow: hidden;
}

.quick-capture__meta {
  display: flex;
  align-items: center;
}

.quick-capture__editor {
  flex: 1;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 8px;
  overflow: hidden;
}

.quick-capture__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
  background: rgba(247, 249, 253, 0.85);
}

.quick-capture__status {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.quick-capture__status-error {
  color: var(--color-error);
}

.quick-capture__buttons {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 600;
}

.btn--primary {
  background: var(--color-primary);
  color: white;
  box-shadow: var(--shadow-sm);
}

.btn--primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn--ghost {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.quick-capture__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.quick-capture__empty-card {
  padding: 20px 24px;
  border-radius: var(--radius-md);
  border: 1px dashed var(--color-border);
  background: rgba(255, 255, 255, 0.7);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quick-capture__empty-title {
  font-weight: 600;
}

.quick-capture__empty-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
