<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { CodeMirrorEditor } from '../../editor'
import MarkdownRenderer from './MarkdownRenderer.vue'
import type { CardDetail, CardListItem, TagWithMeta } from '../../../../shared/ipc/types'
import { getTagDisplayInfo, sortTagsByName } from '../../utils/tagUtils'
import { normalizeCardReferences, REFERENCE_NAMESPACE, REFERENCE_META_TYPE } from '../../utils/referenceUtils'
import { syncCardReferences } from '../../services/referenceSync'
import { syncContentTags } from '../../services/contentTagSync'
import { extractUniqueTagNames, isValidTagName } from '../../utils/tagParseUtils'

const props = defineProps<{
  cardId?: number
  projectId: number
}>()

const emit = defineEmits<{
  'saved': [card: CardDetail]
  'close': []
  'tags-updated': [cardId: number]
  'reference-click': [cardId: number]
}>()

// 状态
const content = ref('')
const cardTitle = ref('')
const isEditingTitle = ref(false)
const titleInputRef = ref<HTMLInputElement | null>(null)
const isEditing = ref(true)
const isLoading = ref(false)
const isSaving = ref(false)
const card = ref<CardDetail | null>(null)
const cardTags = ref<TagWithMeta[]>([])
const referenceTags = ref<TagWithMeta[]>([])
const referenceMap = ref<Record<string, { cardId: number; title: string | null; content: string; displayText: string }>>({})
const referenceCandidates = ref<CardListItem[]>([])
const allTags = ref<TagWithMeta[]>([])
const selectedTagId = ref<number | ''>('')
const showTagDropdown = ref(false)
const tagDropdownRef = ref<HTMLElement | null>(null)
const tagSelectRef = ref<HTMLElement | null>(null)
const isAllTagLoading = ref(false)
const isCardTagLoading = ref(false)
const isTagUpdating = ref(false)
const tagError = ref('')
const saveError = ref('')
const isReferenceLoading = ref(false)
const showTagPanel = ref(false)
const lastSavedAt = ref<number | null>(null)
const lastSavedContent = ref('')
const lastSavedTitle = ref('')
const autoSaveTimer = ref<number | null>(null)
const autoSaveDelay = 800
const tagSyncMessage = ref('')
const tagSyncMessageTimer = ref<number | null>(null)
const editSourceUrl = ref('')
const editSourcePath = ref('')

// 是否是新建模式
const activeCardId = computed(() => props.cardId ?? card.value?.id ?? null)
const isNew = computed(() => !activeCardId.value)
const isTaggable = computed(() => Boolean(activeCardId.value))
const isTagBusy = computed(() => isAllTagLoading.value || isCardTagLoading.value || isTagUpdating.value)
const displayedCardTags = computed(() => sortTagsByName(cardTags.value))
const selectedTag = computed(() => {
  const id = Number(selectedTagId.value)
  if (!id) return null
  return allTags.value.find((tag) => tag.id === id) || null
})
const selectedTagStyle = computed(() => {
  if (!selectedTag.value) return undefined
  const display = getTagDisplayInfo(selectedTag.value, 'ghost')
  return {
    background: display.bgColor,
    color: display.textColor,
    borderColor: display.color,
  }
})
const availableTags = computed(() => {
  const selectedIds = new Set(cardTags.value.map((tag) => tag.id))
  return sortTagsByName(allTags.value.filter((tag) => !selectedIds.has(tag.id)))
})
const canAddTag = computed(() => isTaggable.value && !isTagBusy.value && selectedTagId.value !== '')
const tagCount = computed(() => displayedCardTags.value.length)

// 正文中检测到但还未关联的标签
const detectedTagsInContent = computed(() => {
  const tagNames = extractUniqueTagNames(content.value)
  const currentTagNames = new Set(cardTags.value.map(t => t.name))
  return tagNames.filter(name => isValidTagName(name) && !currentTagNames.has(name))
})

// 显示标题：优先用编辑中的标题，否则用卡片标题或默认值
const displayTitle = computed(() => {
  if (isNew.value) return '新卡片'
  return cardTitle.value || card.value?.title || `卡片 ${activeCardId.value}`
})

const hasUnsavedChanges = computed(() => {
  const trimmed = content.value.trim()
  if (!trimmed) return false
  const contentChanged = content.value !== lastSavedContent.value
  const titleChanged = cardTitle.value !== lastSavedTitle.value
  const urlChanged = editSourceUrl.value !== (card.value?.extra?.sourceUrl || '')
  const pathChanged = editSourcePath.value !== (card.value?.extra?.sourcePath || '')
  return contentChanged || titleChanged || urlChanged || pathChanged
})
const saveStatusText = computed(() => {
  if (isSaving.value) return '保存中...'
  if (saveError.value) return '保存失败'
  if (lastSavedAt.value) {
    const time = new Date(lastSavedAt.value).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
    if (hasUnsavedChanges.value) {
      return `上次保存 ${time}`
    }
    return `已保存 ${time}`
  }
  return hasUnsavedChanges.value ? '未保存' : '—'
})

// 开始编辑标题
const startEditTitle = () => {
  if (isNew.value) return
  isEditingTitle.value = true
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

// 完成标题编辑
const finishEditTitle = () => {
  isEditingTitle.value = false
  // 如果标题改变了，触发自动保存
  if (cardTitle.value !== lastSavedTitle.value) {
    scheduleAutoSave()
  }
}

// 取消标题编辑
const cancelEditTitle = () => {
  cardTitle.value = lastSavedTitle.value
  isEditingTitle.value = false
}

// 复制到剪贴板
const copyToClipboard = async (text: string) => {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    showTagSyncMessage('复制成功')
  } catch (err) {
    console.error('Failed to copy: ', err)
  }
}

// 处理标题输入框按键
const handleTitleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    finishEditTitle()
  } else if (e.key === 'Escape') {
    cancelEditTitle()
  }
}

const toggleTagPanel = () => {
  showTagPanel.value = !showTagPanel.value
  if (showTagPanel.value) {
    // 打开标签面板时刷新标签列表
    loadCardTags()
    loadAllTags()
  } else {
    showTagDropdown.value = false
  }
}

const closeTagPanel = () => {
  showTagPanel.value = false
  showTagDropdown.value = false
}

// 加载卡片
const loadCard = async () => {
  if (!props.cardId) return
  
  isLoading.value = true
  try {
    const result = await window.card.getById(props.cardId)
    if (result.success) {
      card.value = result.data
      content.value = result.data.content
      cardTitle.value = result.data.title || `卡片 ${result.data.id}`
      editSourceUrl.value = String(result.data.extra?.sourceUrl || '')
      editSourcePath.value = String(result.data.extra?.sourcePath || '')
      lastSavedContent.value = result.data.content
      lastSavedTitle.value = cardTitle.value
      lastSavedAt.value = new Date(result.data.updatedAt).getTime()
    }
  } catch (e) {
    console.error('Failed to load card:', e)
  } finally {
    isLoading.value = false
  }
}

const loadAllTags = async () => {
  isAllTagLoading.value = true
  try {
    const result = await window.tag.getAllUserTags(props.projectId)
    if (result.success) {
      allTags.value = result.data
    }
  } catch (e) {
    console.error('Failed to load tags:', e)
  } finally {
    isAllTagLoading.value = false
  }
}

const loadReferenceCandidates = async () => {
  if (!props.projectId) return
  isReferenceLoading.value = true
  try {
    const result = await window.card.getListByProject(props.projectId)
    if (result.success) {
      referenceCandidates.value = result.data
    }
  } catch (e) {
    console.error('Failed to load card list:', e)
  } finally {
    isReferenceLoading.value = false
  }
}

const resolveDisplayText = (card: CardDetail | null, placeholder: string) => {
  if (placeholder.trim()) return placeholder.trim()
  if (!card) return '未命名卡片'
  if (card.title && card.title.trim()) return card.title
  if (card.summary && card.summary.trim()) return card.summary
  return card.content.split('\n').find((line) => line.trim())?.slice(0, 60) || '未命名卡片'
}

interface RefTagInfo {
  refId: string
  targetCardId: number
  placeholder: string
}

const extractRefTagInfos = (tags: TagWithMeta[]): RefTagInfo[] => {
  const result: RefTagInfo[] = []
  for (const tag of tags) {
    const extra = tag.extra as Record<string, unknown> | null
    if (!extra || extra.type !== REFERENCE_META_TYPE) continue
    const refId = typeof extra.refId === 'string' ? extra.refId : ''
    const targetCardId = typeof extra.targetCardId === 'number' ? extra.targetCardId : null
    const placeholder = typeof extra.placeholder === 'string' ? extra.placeholder : ''
    if (refId && targetCardId) {
      result.push({ refId, targetCardId, placeholder })
    }
  }
  return result
}

const loadReferenceMap = async () => {
  const infos = extractRefTagInfos(referenceTags.value)
  if (infos.length === 0) {
    referenceMap.value = {}
    return
  }

  // 并行获取所有目标卡片
  const results = await Promise.all(
    infos.map(async (info) => {
      const detailResult = await window.card.getById(info.targetCardId)
      return { info, detailResult }
    })
  )

  const map: Record<string, { cardId: number; title: string | null; content: string; displayText: string }> = {}
  for (const { info, detailResult } of results) {
    if (!detailResult.success) continue
    const cardDetail = detailResult.data
    map[info.refId] = {
      cardId: cardDetail.id,
      title: cardDetail.title,
      content: cardDetail.content || cardDetail.summary || '',
      displayText: resolveDisplayText(cardDetail, info.placeholder),
    }
  }
  referenceMap.value = map
}

const loadCardTags = async () => {
  const cardId = activeCardId.value
  if (!cardId) {
    cardTags.value = []
    referenceTags.value = []
    referenceMap.value = {}
    return
  }
  isCardTagLoading.value = true
  try {
    const result = await window.card.getTags(cardId)
    if (result.success) {
      const systemTags = result.data.filter((tag) => tag.namespace === REFERENCE_NAMESPACE)
      cardTags.value = result.data.filter((tag) => tag.namespace !== REFERENCE_NAMESPACE)
      referenceTags.value = systemTags
      await loadReferenceMap()
    }
  } catch (e) {
    console.error('Failed to load card tags:', e)
  } finally {
    isCardTagLoading.value = false
  }
}

const addSelectedTag = async () => {
  const cardId = activeCardId.value
  if (!cardId) return
  const tagId = Number(selectedTagId.value)
  if (!tagId) return
  if (isTagUpdating.value) return

  isTagUpdating.value = true
  tagError.value = ''
  try {
    const addResult = await window.card.addTag(cardId, tagId)
    if (addResult.success) {
      await loadCardTags()
      selectedTagId.value = ''
      showTagDropdown.value = false
      emit('tags-updated', cardId)
    } else {
      tagError.value = addResult.error
    }
  } catch (e) {
    console.error('Failed to add tag:', e)
    tagError.value = '添加失败'
  } finally {
    isTagUpdating.value = false
  }
}

const removeTag = async (tag: TagWithMeta) => {
  const cardId = activeCardId.value
  if (!cardId || isTagUpdating.value) return
  isTagUpdating.value = true
  tagError.value = ''
  try {
    const result = await window.card.removeTag(cardId, tag.id)
    if (result.success) {
      cardTags.value = cardTags.value.filter((item) => item.id !== tag.id)
      await loadAllTags()
      emit('tags-updated', cardId)
    } else {
      tagError.value = result.error
    }
  } catch (e) {
    console.error('Failed to remove tag:', e)
    tagError.value = '移除失败'
  } finally {
    isTagUpdating.value = false
  }
}

const getTagStyle = (tag: TagWithMeta) => {
  const display = getTagDisplayInfo(tag, 'ghost')
  return {
    background: display.bgColor,
    color: display.textColor,
    borderColor: display.borderColor,
  }
}

const toggleTagDropdown = () => {
  if (!isTaggable.value || isTagBusy.value || availableTags.value.length === 0) return
  showTagDropdown.value = !showTagDropdown.value
}

const selectTag = (tag: TagWithMeta) => {
  selectedTagId.value = tag.id
  showTagDropdown.value = false
}

const handleOutsideClick = (event: MouseEvent) => {
  if (!showTagDropdown.value) return
  const target = event.target as Node
  if (tagDropdownRef.value?.contains(target)) return
  if (tagSelectRef.value?.contains(target)) return
  showTagDropdown.value = false
}

// 处理编辑器中创建新标签
const handleTagCreate = async (tagName: string) => {
  try {
    const result = await window.tag.getOrCreate(props.projectId, tagName)
    if (result.success) {
      await loadAllTags()
    }
  } catch (e) {
    console.error('Failed to create tag:', e)
  }
}

// 显示标签同步提示
const showTagSyncMessage = (message: string) => {
  if (tagSyncMessageTimer.value) {
    clearTimeout(tagSyncMessageTimer.value)
  }
  tagSyncMessage.value = message
  tagSyncMessageTimer.value = window.setTimeout(() => {
    tagSyncMessage.value = ''
    tagSyncMessageTimer.value = null
  }, 3000)
}

// 保存卡片
const saveCard = async () => {
  if (!content.value.trim()) return

  let normalizedContent = content.value
  saveError.value = ''
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

  // 检查是否只有标题或元信息变化
  const contentChanged = normalizedContent !== lastSavedContent.value
  const titleChanged = cardTitle.value !== lastSavedTitle.value
  const urlChanged = editSourceUrl.value !== (card.value?.extra?.sourceUrl || '')
  const pathChanged = editSourcePath.value !== (card.value?.extra?.sourcePath || '')
  
  if (!contentChanged && !titleChanged && !urlChanged && !pathChanged) return

  if (autoSaveTimer.value) {
    window.clearTimeout(autoSaveTimer.value)
    autoSaveTimer.value = null
  }

  isSaving.value = true
  try {
    let result
    const metaExtra = {
      ...(card.value?.extra || {}),
      sourceUrl: editSourceUrl.value || undefined,
      sourcePath: editSourcePath.value || undefined,
    }

    if (isNew.value) {
      // 创建新卡片
      result = await window.card.create({ 
        projectId: props.projectId, 
        content: normalizedContent,
        meta: { extra: metaExtra } 
      })
    } else {
      // 更新卡片
      const cardId = activeCardId.value
      if (!cardId) return
      result = await window.card.update({ 
        id: cardId, 
        content: normalizedContent,
        meta: { 
          title: cardTitle.value,
          extra: metaExtra
        }
      })
    }

    if (result.success) {
      card.value = result.data
      cardTitle.value = result.data.title || `卡片 ${result.data.id}`
      emit('saved', result.data)
      lastSavedContent.value = normalizedContent
      lastSavedTitle.value = cardTitle.value
      const updatedAt = new Date(result.data.updatedAt).getTime()
      lastSavedAt.value = Number.isNaN(updatedAt) ? Date.now() : updatedAt

      await syncCardReferences(result.data.id, props.projectId, normalizedContent)
      const tagSyncResult = await syncContentTags(result.data.id, props.projectId, normalizedContent)
      
      // 显示标签同步提示
      if (tagSyncResult.addedTags.length > 0) {
        showTagSyncMessage(`已关联标签：${tagSyncResult.addedTags.map(t => '#' + t).join(' ')}`)
        emit('tags-updated', result.data.id)
      }
      
      await loadCardTags()
      await loadAllTags()
    }
  } catch (e) {
    console.error('Failed to save card:', e)
  } finally {
    isSaving.value = false
  }
}

// 切换编辑/预览模式
const toggleMode = () => {
  isEditing.value = !isEditing.value
}

const enterEditMode = () => {
  isEditing.value = true
}

const scheduleAutoSave = () => {
  if (!isEditing.value) return
  if (!hasUnsavedChanges.value) return
  if (autoSaveTimer.value) {
    window.clearTimeout(autoSaveTimer.value)
  }
  autoSaveTimer.value = window.setTimeout(async () => {
    autoSaveTimer.value = null
    if (!hasUnsavedChanges.value) return
    if (isSaving.value || isLoading.value) {
      scheduleAutoSave()
      return
    }
    await saveCard()
  }, autoSaveDelay)
}

// 监听 cardId 变化
watch(() => props.cardId, () => {
  if (props.cardId) {
    loadCard()
    loadCardTags()
    loadAllTags()
    loadReferenceCandidates()
    isEditing.value = false
    showTagDropdown.value = false
  } else {
    card.value = null
    content.value = ''
    cardTitle.value = ''
    isEditing.value = true
    isEditingTitle.value = false
    cardTags.value = []
    referenceTags.value = []
    referenceMap.value = {}
    selectedTagId.value = ''
    tagError.value = ''
    showTagDropdown.value = false
    lastSavedContent.value = ''
    lastSavedTitle.value = ''
    lastSavedAt.value = null
    loadReferenceCandidates()
  }
}, { immediate: true })

watch(() => props.projectId, () => {
  loadAllTags()
  loadCardTags()
  loadReferenceCandidates()
})
watch(selectedTagId, () => {
  if (tagError.value) {
    tagError.value = ''
  }
})

watch(content, () => {
  if (saveError.value) {
    saveError.value = ''
  }
  scheduleAutoSave()
})

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick)
  if (autoSaveTimer.value) {
    window.clearTimeout(autoSaveTimer.value)
  }
})
</script>

<template>
  <div class="card-edit-view" :class="{ 'card-edit-view--tags-open': showTagPanel }">
    <!-- 工具栏 -->
    <div class="card-edit-view__toolbar">
      <div class="card-edit-view__title">
        <!-- 标题编辑模式 -->
        <input
          v-if="isEditingTitle"
          ref="titleInputRef"
          v-model="cardTitle"
          class="card-edit-view__title-input"
          type="text"
          placeholder="输入标题..."
          @blur="finishEditTitle"
          @keydown="handleTitleKeydown"
        />
        <!-- 标题显示模式 -->
        <span
          v-else
          class="card-edit-view__title-text"
          :class="{ 'card-edit-view__title-text--editable': !isNew }"
          :title="isNew ? '' : '点击编辑标题'"
          @click="startEditTitle"
        >
          {{ displayTitle }}
        </span>
        <span
          class="card-edit-view__status"
          :class="{ 'card-edit-view__status--dirty': hasUnsavedChanges && !isSaving }"
        >
          {{ saveStatusText }}
        </span>
      </div>
      <div class="card-edit-view__actions">
        <!-- 模式切换 -->
        <button
          v-if="!isNew"
          class="card-edit-view__btn card-edit-view__btn--ghost"
          @click="toggleMode"
        >
          {{ isEditing ? '预览' : '编辑' }}
        </button>

        <button
          class="card-edit-view__btn card-edit-view__btn--ghost card-edit-view__btn--tag"
          :class="{ 'card-edit-view__btn--active': showTagPanel }"
          @click="toggleTagPanel"
        >
          标签
          <span class="card-edit-view__btn-badge">{{ tagCount }}</span>
        </button>
        
        <!-- 关闭按钮 -->
        <button
          class="card-edit-view__btn card-edit-view__btn--ghost"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>
    </div>

    <div v-if="saveError" class="card-edit-view__error">
      {{ saveError }}
    </div>

    <!-- 元信息展示与编辑 -->
    <div v-if="(card?.extra || isEditing) && (card?.extra?.sourceUrl || card?.extra?.sourcePath || isEditing)" class="card-edit-view__meta">
      <div class="card-edit-view__meta-item">
        <span class="card-edit-view__meta-icon">🔗</span>
        <template v-if="isEditing">
          <input
            v-model="editSourceUrl"
            class="card-edit-view__meta-input"
            type="text"
            placeholder="添加来源链接..."
            @blur="scheduleAutoSave"
          />
        </template>
        <template v-else-if="card?.extra?.sourceUrl">
          <span class="card-edit-view__meta-label">来源:</span>
          <span 
            class="card-edit-view__meta-value card-edit-view__meta-value--copyable" 
            title="点击复制"
            @click="copyToClipboard(String(card.extra.sourceUrl))"
          >
            {{ card.extra.sourceUrl }}
          </span>
        </template>
      </div>
      <div class="card-edit-view__meta-item">
        <span class="card-edit-view__meta-icon">📁</span>
        <template v-if="isEditing">
          <input
            v-model="editSourcePath"
            class="card-edit-view__meta-input"
            type="text"
            placeholder="添加文件路径..."
            @blur="scheduleAutoSave"
          />
        </template>
        <template v-else-if="card?.extra?.sourcePath">
          <span class="card-edit-view__meta-label">路径:</span>
          <span 
            class="card-edit-view__meta-value card-edit-view__meta-value--copyable" 
            title="点击复制"
            @click="copyToClipboard(String(card.extra.sourcePath))"
          >
            {{ card.extra.sourcePath }}
          </span>
        </template>
      </div>
    </div>

    <!-- 标签同步提示 -->
    <transition name="tag-sync-toast">
      <div v-if="tagSyncMessage" class="card-edit-view__tag-toast">
        {{ tagSyncMessage }}
      </div>
    </transition>
    
    <!-- 加载状态 -->
    <div v-if="isLoading" class="card-edit-view__loading">
      加载中...
    </div>
    
    <!-- 内容区 -->
    <div v-else class="card-edit-view__content">
      <!-- 编辑模式 -->
      <CodeMirrorEditor
        v-if="isEditing"
        v-model="content"
        :auto-focus="true"
        :reference-candidates="referenceCandidates"
        :tag-candidates="allTags"
        :current-card-id="activeCardId || undefined"
        @save="saveCard"
        @tag-create="handleTagCreate"
      />
      
      <!-- 预览模式 -->
      <div v-else class="card-edit-view__preview" @dblclick="enterEditMode">
        <MarkdownRenderer
          :content="content"
          :reference-map="referenceMap"
          @reference-click="emit('reference-click', $event)"
        />
      </div>
    </div>

    <transition name="tag-panel-slide">
      <aside
        v-if="showTagPanel"
        class="card-edit-view__tag-panel"
      >
        <div class="card-edit-view__tag-panel-header">
          <div class="card-edit-view__tag-panel-title">标签管理</div>
          <button class="card-edit-view__tag-panel-close" @click="closeTagPanel">×</button>
        </div>
        
        <div class="card-edit-view__tag-panel-body">
          <!-- 当前标签 -->
          <section class="card-edit-view__tag-section">
            <div class="card-edit-view__tag-section-header">
              <span class="card-edit-view__tag-section-title">已关联</span>
              <span class="card-edit-view__tag-section-count">{{ displayedCardTags.length }}</span>
            </div>
            <div class="card-edit-view__tag-chips">
              <div
                v-for="tag in displayedCardTags"
                :key="tag.id"
                class="card-edit-view__tag-chip"
                :style="getTagStyle(tag)"
              >
                <span class="card-edit-view__tag-chip-name">{{ tag.name }}</span>
                <button
                  class="card-edit-view__tag-chip-remove"
                  :disabled="isTagBusy"
                  @click.stop="removeTag(tag)"
                >×</button>
              </div>
              <span v-if="displayedCardTags.length === 0 && !isCardTagLoading" class="card-edit-view__tag-empty">
                暂无标签
              </span>
            </div>
          </section>

          <!-- 正文中检测到的标签 -->
          <section v-if="detectedTagsInContent.length > 0" class="card-edit-view__tag-section">
            <div class="card-edit-view__tag-section-header">
              <span class="card-edit-view__tag-section-title">正文中检测到</span>
              <span class="card-edit-view__tag-section-hint">保存后自动关联</span>
            </div>
            <div class="card-edit-view__tag-chips card-edit-view__tag-chips--detected">
              <span
                v-for="tagName in detectedTagsInContent"
                :key="tagName"
                class="card-edit-view__tag-chip card-edit-view__tag-chip--detected"
              >
                #{{ tagName }}
              </span>
            </div>
          </section>

          <!-- 添加标签 -->
          <section class="card-edit-view__tag-section">
            <div class="card-edit-view__tag-section-header">
              <span class="card-edit-view__tag-section-title">添加标签</span>
            </div>
            <div class="card-edit-view__tag-add">
              <div class="card-edit-view__tag-select-wrap">
                <button
                  ref="tagSelectRef"
                  class="card-edit-view__tag-select"
                  :class="{ 'card-edit-view__tag-select--open': showTagDropdown }"
                  :style="selectedTagStyle"
                  :disabled="!isTaggable || isTagBusy || availableTags.length === 0"
                  @click="toggleTagDropdown"
                >
                  <span v-if="selectedTag" class="card-edit-view__tag-select-label">
                    <span
                      class="card-edit-view__tag-select-dot"
                      :style="{ background: selectedTag.color || 'var(--color-text-muted)' }"
                    ></span>
                    {{ selectedTag.name }}
                  </span>
                  <span v-else class="card-edit-view__tag-select-placeholder">选择标签</span>
                  <span class="card-edit-view__tag-select-arrow"></span>
                </button>
                <div
                  v-if="showTagDropdown"
                  ref="tagDropdownRef"
                  class="card-edit-view__tag-dropdown"
                >
                  <button
                    v-for="tag in availableTags"
                    :key="tag.id"
                    class="card-edit-view__tag-option"
                    @click="selectTag(tag)"
                  >
                    <span
                      class="card-edit-view__tag-option-dot"
                      :style="{ background: tag.color || 'var(--color-text-muted)' }"
                    ></span>
                    <span class="card-edit-view__tag-option-name">{{ tag.name }}</span>
                  </button>
                </div>
              </div>
              <button
                class="card-edit-view__tag-add-btn"
                :disabled="!canAddTag"
                @click="addSelectedTag"
              >添加</button>
            </div>
            <div v-if="tagError" class="card-edit-view__tag-error">{{ tagError }}</div>
            <p v-if="!isTaggable" class="card-edit-view__tag-tip">保存卡片后可添加标签</p>
            <p v-else-if="availableTags.length === 0 && !isAllTagLoading" class="card-edit-view__tag-tip">
              💡 在正文中输入 <code>#标签名</code> 可快速创建标签
            </p>
          </section>
        </div>
      </aside>
    </transition>
    
    <!-- 底部信息 -->
    <div v-if="card && !isNew" class="card-edit-view__footer">
      <span>创建于 {{ new Date(card.createdAt).toLocaleString('zh-CN') }}</span>
      <span v-if="card.wordCount">{{ card.wordCount }} 字</span>
    </div>
  </div>
</template>

<style scoped>
.card-edit-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(255, 255, 255, 0.92);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(12px);
  animation: panel-rise 0.35s ease both;
  position: relative;
  --tag-panel-width: 280px;
}

.card-edit-view__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.8));
}

.card-edit-view__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 16px;
  background: rgba(58, 109, 246, 0.04);
  border-bottom: 1px solid var(--color-border);
}

.card-edit-view__meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-secondary);
  min-width: 0;
}

.card-edit-view__meta-icon {
  font-size: 12px;
  opacity: 0.8;
}

.card-edit-view__meta-label {
  font-weight: 500;
  white-space: nowrap;
}

.card-edit-view__meta-value {
  color: var(--color-text);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.card-edit-view__meta-value--copyable {
  cursor: pointer;
  transition: color 0.15s ease;
}

.card-edit-view__meta-value--copyable:hover {
  color: var(--color-primary);
  text-decoration: underline;
}

.card-edit-view__meta-input {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px dashed var(--color-border);
  font-size: 11px;
  color: var(--color-text);
  padding: 0 4px;
  outline: none;
  transition: border-color 0.2s;
}

.card-edit-view__meta-input:focus {
  border-bottom-color: var(--color-primary);
}

.card-edit-view__meta-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.6;
}

.card-edit-view__error {
  padding: 6px 16px;
  font-size: 12px;
  color: var(--color-error);
  border-bottom: 1px solid var(--color-border);
}

.card-edit-view__title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  min-width: 0;
}

.card-edit-view__title-text {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 360px;
}

.card-edit-view__title-text--editable {
  cursor: pointer;
  padding: 2px 6px;
  margin: -2px -6px;
  border-radius: var(--radius-sm);
  transition: background 0.15s ease;
}

.card-edit-view__title-text--editable:hover {
  background: var(--color-bg-soft);
}

.card-edit-view__title-input {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-bg-soft);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  max-width: 360px;
  outline: none;
}

.card-edit-view__title-input::placeholder {
  color: var(--color-text-muted);
  font-weight: 400;
}

.card-edit-view__status {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted);
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
}

.card-edit-view__status--dirty {
  color: var(--color-text-secondary);
  border-color: rgba(58, 109, 246, 0.3);
  background: rgba(58, 109, 246, 0.08);
}

.card-edit-view__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-edit-view__btn {
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
}

.card-edit-view__btn--primary {
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  color: white;
  box-shadow: 0 10px 18px rgba(58, 109, 246, 0.25);
}

.card-edit-view__btn--primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 22px rgba(58, 109, 246, 0.32);
}

.card-edit-view__btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card-edit-view__btn--ghost {
  color: var(--color-text-secondary);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
}

.card-edit-view__btn--ghost:hover {
  background: white;
  color: var(--color-text);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.card-edit-view__btn--tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.card-edit-view__btn--active {
  border-color: rgba(58, 109, 246, 0.45);
  color: var(--color-text);
  box-shadow: var(--shadow-sm);
}

.card-edit-view__btn-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border);
  font-size: 11px;
  line-height: 16px;
  color: var(--color-text-secondary);
}

.card-edit-view__loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.card-edit-view__content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  transition: padding 0.2s ease;
}

.card-edit-view--tags-open .card-edit-view__content {
  padding-right: calc(var(--tag-panel-width) + 8px);
}

.card-edit-view__preview {
  padding: 24px 32px 40px;
  border-radius: var(--radius-md);
  background: transparent;
  border: none;
}

.card-edit-view__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-top: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-text-muted);
  background: rgba(255, 255, 255, 0.7);
}

.card-edit-view__tags {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(255, 255, 255, 0.7);
}

.card-edit-view__tags--panel {
  flex: 1;
  padding: 12px 14px 16px;
  border-bottom: none;
  background: transparent;
  overflow-y: auto;
}

.card-edit-view__tags-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--color-text-muted);
}

.card-edit-view__tags-title {
  font-weight: 600;
  color: var(--color-text-secondary);
}

.card-edit-view__tags-hint {
  font-size: 12px;
}

.card-edit-view__tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 24px;
}

.card-edit-view__tag-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: var(--shadow-sm);
}

.card-edit-view__tag-name {
  line-height: 1;
}

.card-edit-view__tag-remove {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 12px;
  line-height: 16px;
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}

.card-edit-view__tag-remove:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.card-edit-view__tags-empty,
.card-edit-view__tags-loading {
  font-size: 12px;
  color: var(--color-text-muted);
}

.card-edit-view__tag-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-edit-view__tag-select-wrap {
  position: relative;
  flex: 1;
}

.card-edit-view__tag-select {
  width: 100%;
  height: 28px;
  padding: 0 28px 0 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  background: var(--color-bg-soft);
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  position: relative;
}

.card-edit-view__tag-select:hover:not(:disabled) {
  background: white;
  border-color: var(--color-border-strong);
}

.card-edit-view__tag-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.card-edit-view__tag-select--open {
  border-color: var(--color-primary);
}

.card-edit-view__tag-select-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.card-edit-view__tag-select-placeholder {
  color: var(--color-text-muted);
}

.card-edit-view__tag-select-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.card-edit-view__tag-select-arrow {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid var(--color-text-muted);
}

.card-edit-view__tag-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 180px;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 10;
}

.card-edit-view__tag-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--color-text);
  cursor: pointer;
  background: transparent;
  border: none;
  text-align: left;
  width: 100%;
}

.card-edit-view__tag-option:hover {
  background: var(--color-bg-soft);
}

.card-edit-view__tag-option-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.card-edit-view__tag-option-name {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-edit-view__tag-input-btn {
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.card-edit-view__tag-input-btn:hover:not(:disabled) {
  background: white;
  border-color: var(--color-border-strong);
  color: var(--color-text);
}

.card-edit-view__tag-input-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card-edit-view__tag-error {
  font-size: 12px;
  color: var(--color-error);
}

.card-edit-view__tag-empty-hint {
  font-size: 12px;
  color: var(--color-text-muted);
}

.card-edit-view__tag-panel {
  position: absolute;
  top: 60px;
  right: 12px;
  bottom: 12px;
  width: 240px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 6;
  backdrop-filter: blur(12px);
}

.card-edit-view__tag-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.8));
}

.card-edit-view__tag-panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
}

.card-edit-view__tag-panel-close {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.card-edit-view__tag-panel-close:hover {
  background: var(--color-bg-soft);
  color: var(--color-text);
}

.card-edit-view__tag-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.card-edit-view__tag-section {
  padding: 8px 12px;
}

.card-edit-view__tag-section + .card-edit-view__tag-section {
  border-top: 1px solid var(--color-border);
}

.card-edit-view__tag-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.card-edit-view__tag-section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.card-edit-view__tag-section-count {
  font-size: 10px;
  color: var(--color-text-muted);
  background: var(--color-bg-soft);
  padding: 1px 6px;
  border-radius: 10px;
}

.card-edit-view__tag-section-hint {
  font-size: 10px;
  color: var(--color-text-muted);
}

.card-edit-view__tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.card-edit-view__tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border);
}

.card-edit-view__tag-chip-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-edit-view__tag-chip-remove {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: inherit;
  opacity: 0.6;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  cursor: pointer;
}

.card-edit-view__tag-chip-remove:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.1);
}

.card-edit-view__tag-chip--detected {
  background: linear-gradient(135deg, rgba(58, 109, 246, 0.1), rgba(17, 183, 165, 0.1));
  border-color: rgba(58, 109, 246, 0.3);
  color: var(--color-primary);
}

.card-edit-view__tag-empty {
  font-size: 11px;
  color: var(--color-text-muted);
}

.card-edit-view__tag-add {
  display: flex;
  gap: 6px;
}

.card-edit-view__tag-add-btn {
  height: 28px;
  padding: 0 10px;
  font-size: 11px;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  border: none;
  color: white;
  cursor: pointer;
}

.card-edit-view__tag-add-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.card-edit-view__tag-add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card-edit-view__tag-tip {
  font-size: 11px;
  color: var(--color-text-muted);
  margin: 8px 0 0;
  line-height: 1.4;
}

.card-edit-view__tag-tip code {
  background: var(--color-bg-soft);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 10px;
}

.tag-panel-slide-enter-active,
.tag-panel-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.tag-panel-slide-enter-from,
.tag-panel-slide-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

@media (max-width: 1200px) {
  .card-edit-view--tags-open .card-edit-view__content {
    padding-right: 16px;
  }

  .card-edit-view__tag-panel {
    width: min(280px, 92%);
  }
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

/* 标签同步提示 */
.card-edit-view__tag-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, rgba(58, 109, 246, 0.95), rgba(17, 183, 165, 0.95));
  color: white;
  padding: 10px 20px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  box-shadow: var(--shadow-lg);
  z-index: 1000;
}

.tag-sync-toast-enter-active {
  transition: all 0.3s ease;
}

.tag-sync-toast-leave-active {
  transition: all 0.3s ease;
}

.tag-sync-toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

.tag-sync-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}
</style>
