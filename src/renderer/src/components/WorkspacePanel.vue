<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import type { CardListItem, CardDetail, TagWithMeta, TagWithUsageCount } from '../../../shared/ipc/types'
import { getTagDisplayInfo, sortTagsByUsage } from '../utils/tagUtils'
import CardEditView from './card/CardEditView.vue'
import MarkdownRenderer from './card/MarkdownRenderer.vue'

const props = defineProps<{
  projectId: number
}>()

type WorkspaceTab = 'timeline' | 'tags'

const activeTab = ref<WorkspaceTab>('timeline')
const cards = ref<CardListItem[]>([])
const cardTagsMap = ref<Record<number, TagWithMeta[]>>({})
const tags = ref<TagWithUsageCount[]>([])
const isLoading = ref(true)
const isTagLoading = ref(false)
const selectedCardId = ref<number | null>(null)
const isCreating = ref(false)
const showTagCreator = ref(false)
const isTagSaving = ref(false)
const newTagName = ref('')
const tagColorOptions = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#64748b',
]
const newTagColor = ref(tagColorOptions[0])
const tagError = ref('')
const maxCardTags = 3
const selectedTagId = ref<number | null>(null)
const tagEditName = ref('')
const tagEditColor = ref(tagColorOptions[0])
const tagEditError = ref('')
const isTagEditSaving = ref(false)
const tagCards = ref<Array<{ id: number; title: string | null; preview: string; content: string }>>([])
const isTagCardsLoading = ref(false)
const hoveredTagCardId = ref<number | null>(null)
const hoveredTagCardRect = ref<DOMRect | null>(null)
const hoverHideTimer = ref<number | null>(null)

// 是否显示编辑面板
const isTagView = computed(() => activeTab.value === 'tags')
const showEditor = computed(() => !isTagView.value && (selectedCardId.value !== null || isCreating.value))
const displayedTags = computed(() => sortTagsByUsage(tags.value))
const selectedTag = computed(() => tags.value.find((tag) => tag.id === selectedTagId.value) || null)
const showTagEditor = computed(() => isTagView.value && selectedTag.value !== null)
const placeholderIcon = computed(() => (isTagView.value ? '🏷️' : '📄'))
const placeholderText = computed(() => {
  if (!isTagView.value) return '选择一张卡片或创建新卡片'
  if (selectedTag.value) return '编辑标签信息'
  return '选择一个标签进行编辑'
})
const primaryActionLabel = computed(() => (isTagView.value ? '新建标签' : '新建'))
const tagEditDirty = computed(() => {
  if (!selectedTag.value) return false
  const nameChanged = tagEditName.value.trim() !== selectedTag.value.name
  const colorChanged = (tagEditColor.value || null) !== (selectedTag.value.color || null)
  return nameChanged || colorChanged
})
const canSaveTagEdit = computed(() => {
  if (!selectedTag.value) return false
  if (!tagEditName.value.trim()) return false
  if (isTagEditSaving.value) return false
  return tagEditDirty.value
})
const hoveredTagCard = computed(() => {
  if (hoveredTagCardId.value === null) return null
  return tagCards.value.find((card) => card.id === hoveredTagCardId.value) || null
})
const tagTooltipStyle = computed(() => {
  if (!hoveredTagCardRect.value) return undefined
  const width = Math.min(420, hoveredTagCardRect.value.width)
  return {
    top: `${hoveredTagCardRect.value.bottom + 8}px`,
    left: `${hoveredTagCardRect.value.left}px`,
    width: `${width}px`,
  }
})

// 加载卡片列表
const loadCards = async () => {
  isLoading.value = true
  try {
    const result = await window.card.getListByProject(props.projectId)
    if (result.success) {
      cards.value = result.data
      await loadCardTagsForCards(result.data)
    }
  } catch (e) {
    console.error('Failed to load cards:', e)
  } finally {
    isLoading.value = false
  }
}

// 加载标签列表
const loadTags = async () => {
  isTagLoading.value = true
  try {
    const result = await window.tag.getAllWithUsageCount(props.projectId)
    if (result.success) {
      tags.value = result.data
      if (selectedTagId.value !== null) {
        const currentTag = result.data.find((tag) => tag.id === selectedTagId.value)
        if (currentTag) {
          tagEditName.value = currentTag.name
          tagEditColor.value = currentTag.color || tagColorOptions[0]
        } else {
          clearSelectedTag()
        }
      }
    }
  } catch (e) {
    console.error('Failed to load tags:', e)
  } finally {
    isTagLoading.value = false
  }
}

const loadCardTagsForCards = async (list: CardListItem[]) => {
  const cardIds = list.map((card) => card.id)
  if (cardIds.length === 0) {
    cardTagsMap.value = {}
    return
  }

  try {
    const results = await Promise.all(
      cardIds.map((cardId) => window.card.getTags(cardId).catch(() => null))
    )
    const nextMap: Record<number, TagWithMeta[]> = {}
    results.forEach((result, index) => {
      const cardId = cardIds[index]
      if (result?.success) {
        nextMap[cardId] = result.data
      }
    })
    cardTagsMap.value = nextMap
  } catch (e) {
    console.error('Failed to load card tags:', e)
  }
}

const loadCardTagsForCard = async (cardId: number) => {
  try {
    const result = await window.card.getTags(cardId)
    if (result.success) {
      cardTagsMap.value = {
        ...cardTagsMap.value,
        [cardId]: result.data,
      }
    }
  } catch (e) {
    console.error('Failed to load card tags:', e)
  }
}

const clearSelectedTag = () => {
  selectedTagId.value = null
  tagEditName.value = ''
  tagEditColor.value = tagColorOptions[0]
  tagEditError.value = ''
  tagCards.value = []
  hoveredTagCardId.value = null
  hoveredTagCardRect.value = null
  isTagCardsLoading.value = false
  if (hoverHideTimer.value !== null) {
    window.clearTimeout(hoverHideTimer.value)
    hoverHideTimer.value = null
  }
}

const selectTag = (tag: TagWithUsageCount) => {
  selectedTagId.value = tag.id
  tagEditName.value = tag.name
  tagEditColor.value = tag.color || tagColorOptions[0]
  tagEditError.value = ''
  cancelHideTagCardPreview()
  hoveredTagCardId.value = null
  hoveredTagCardRect.value = null
  loadTagCards(tag.id)
}

const formatCardPreview = (content: string, summary?: string | null) => {
  const base = (summary && summary.trim()) ? summary : content
  const text = base.replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, 120) : '无内容'
}

const loadTagCards = async (tagId: number) => {
  isTagCardsLoading.value = true
  try {
    const listResult = await window.card.getByTag(tagId)
    if (!listResult.success) {
      tagCards.value = []
      return
    }

    const detailResults = await Promise.all(
      listResult.data.map(async (card) => {
        const detailResult = await window.card.getById(card.id)
        if (detailResult.success) {
          const content = detailResult.data.content || detailResult.data.summary || ''
          return {
            id: card.id,
            title: detailResult.data.title,
            content,
            preview: formatCardPreview(content, detailResult.data.summary),
          }
        }
        return {
          id: card.id,
          title: card.title,
          content: card.summary || '',
          preview: formatCardPreview(card.summary || ''),
        }
      })
    )

    if (selectedTagId.value === tagId) {
      tagCards.value = detailResults
    }
  } catch (e) {
    console.error('Failed to load tag cards:', e)
  } finally {
    if (selectedTagId.value === tagId) {
      isTagCardsLoading.value = false
    }
  }
}

const showTagCardPreview = (cardId: number, event: MouseEvent) => {
  if (hoverHideTimer.value !== null) {
    window.clearTimeout(hoverHideTimer.value)
    hoverHideTimer.value = null
  }
  const target = event.currentTarget as HTMLElement | null
  if (target) {
    hoveredTagCardRect.value = target.getBoundingClientRect()
  }
  hoveredTagCardId.value = cardId
}

const scheduleHideTagCardPreview = () => {
  if (hoverHideTimer.value !== null) {
    window.clearTimeout(hoverHideTimer.value)
  }
  hoverHideTimer.value = window.setTimeout(() => {
    hoveredTagCardId.value = null
    hoveredTagCardRect.value = null
  }, 500)
}

const cancelHideTagCardPreview = () => {
  if (hoverHideTimer.value !== null) {
    window.clearTimeout(hoverHideTimer.value)
    hoverHideTimer.value = null
  }
}

const saveTagEdit = async () => {
  if (!selectedTag.value) return
  const name = tagEditName.value.trim()
  if (!name) {
    tagEditError.value = '请输入标签名'
    return
  }
  if (isTagEditSaving.value) return

  isTagEditSaving.value = true
  tagEditError.value = ''
  try {
    const result = await window.tag.update({
      id: selectedTag.value.id,
      name,
      color: tagEditColor.value,
    })
    if (result.success) {
      await loadTags()
      if (selectedTag.value) {
        tagEditName.value = selectedTag.value.name
        tagEditColor.value = selectedTag.value.color || tagColorOptions[0]
      }
    } else {
      tagEditError.value = result.error
    }
  } catch (e) {
    console.error('Failed to update tag:', e)
    tagEditError.value = '保存失败'
  } finally {
    isTagEditSaving.value = false
  }
}

// 监听 projectId 变化重新加载
watch(() => props.projectId, () => {
  selectedCardId.value = null
  isCreating.value = false
  clearSelectedTag()
  loadCards()
  if (isTagView.value) {
    loadTags()
  }
})

// 创建新卡片
const createCard = () => {
  selectedCardId.value = null
  isCreating.value = true
}

const openTagCreator = () => {
  showTagCreator.value = true
  tagError.value = ''
  newTagColor.value = tagColorOptions[0]
}

const cancelTagCreator = () => {
  showTagCreator.value = false
  newTagName.value = ''
  tagError.value = ''
  newTagColor.value = tagColorOptions[0]
}

const saveTag = async () => {
  const name = newTagName.value.trim()
  if (!name) {
    tagError.value = '请输入标签名'
    return
  }
  if (isTagSaving.value) return

  isTagSaving.value = true
  tagError.value = ''
  try {
    const result = await window.tag.create({
      projectId: props.projectId,
      name,
      color: newTagColor.value,
    })
    if (result.success) {
      await loadTags()
      newTagName.value = ''
      showTagCreator.value = false
      newTagColor.value = tagColorOptions[0]
    } else {
      tagError.value = result.error
    }
  } catch (e) {
    console.error('Failed to create tag:', e)
    tagError.value = '创建失败'
  } finally {
    isTagSaving.value = false
  }
}

// 选择卡片
const selectCard = (id: number) => {
  isCreating.value = false
  selectedCardId.value = id
}

const handleReferenceClick = (id: number) => {
  if (!id) return
  isCreating.value = false
  selectedCardId.value = id
}

// 关闭编辑面板
const closeEditor = () => {
  selectedCardId.value = null
  isCreating.value = false
}

// 卡片保存后
const onCardSaved = async (card: CardDetail) => {
  if (isCreating.value) {
    // 新建完成后选中该卡片
    selectedCardId.value = card.id
    isCreating.value = false
  }
  await loadCards()
}

const onCardTagsUpdated = async (cardId: number) => {
  await loadCardTagsForCard(cardId)
}

// 格式化时间
const formatTime = (date: Date) => {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
  
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

const handlePrimaryAction = () => {
  if (isTagView.value) {
    openTagCreator()
    return
  }
  createCard()
}

const setActiveTab = (tab: WorkspaceTab) => {
  activeTab.value = tab
  if (tab === 'tags') {
    loadTags()
    if (selectedTagId.value !== null) {
      loadTagCards(selectedTagId.value)
    }
  } else {
    showTagCreator.value = false
  }
}

const getCardTagStyle = (tag: TagWithMeta) => {
  const display = getTagDisplayInfo(tag, 'ghost')
  return {
    background: display.bgColor,
    color: display.textColor,
    borderColor: display.color,
  }
}

onMounted(() => {
  loadCards()
})

watch(newTagName, () => {
  if (tagError.value) {
    tagError.value = ''
  }
})

watch(tagEditName, () => {
  if (tagEditError.value) {
    tagEditError.value = ''
  }
})

watch(tagEditColor, () => {
  if (tagEditError.value) {
    tagEditError.value = ''
  }
})
</script>

<template>
  <div class="workspace">
    <!-- 左侧：卡片列表 -->
    <div class="workspace-list">
      <!-- 头部 -->
      <header class="workspace-header">
        <div class="workspace-header__tabs">
          <button
            class="workspace-header__tab"
            :class="{ 'workspace-header__tab--active': activeTab === 'timeline' }"
            @click="setActiveTab('timeline')"
          >
            时间流
          </button>
          <button
            class="workspace-header__tab"
            :class="{ 'workspace-header__tab--active': activeTab === 'tags' }"
            @click="setActiveTab('tags')"
          >
            标签
          </button>
        </div>
        <div class="workspace-header__actions">
          <button class="workspace-header__btn" @click="handlePrimaryAction">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {{ primaryActionLabel }}
          </button>
        </div>
      </header>

      <!-- 内容区 -->
      <div class="workspace-content">
        <template v-if="!isTagView">
          <!-- 加载状态 -->
          <div v-if="isLoading" class="workspace-loading">
            <div class="workspace-loading__spinner"></div>
            <span>加载中...</span>
          </div>

          <!-- 空状态 -->
          <div v-else-if="cards.length === 0" class="workspace-empty">
            <div class="workspace-empty__icon">📝</div>
            <h3 class="workspace-empty__title">还没有卡片</h3>
            <p class="workspace-empty__text">点击"新建"开始记录</p>
            <button class="workspace-empty__btn" @click="createCard">
              创建第一张卡片
            </button>
          </div>

          <!-- 卡片列表 -->
          <div v-else class="workspace-cards">
            <div
              v-for="card in cards"
              :key="card.id"
              :class="['card-item', { 'card-item--selected': card.id === selectedCardId }]"
              @click="selectCard(card.id)"
            >
              <div class="card-item__header">
                <h3 class="card-item__title">{{ card.title || '无标题' }}</h3>
                <span class="card-item__time">{{ formatTime(card.createdAt) }}</span>
              </div>
              <p v-if="card.summary" class="card-item__summary">{{ card.summary }}</p>
              <div class="card-item__footer">
                <span v-if="card.wordCount" class="card-item__meta">
                  {{ card.wordCount }} 字
                </span>
              </div>
              <div v-if="cardTagsMap[card.id]?.length" class="card-item__tags">
                <span
                  v-for="tag in cardTagsMap[card.id].slice(0, maxCardTags)"
                  :key="tag.id"
                  class="card-item__tag"
                  :style="getCardTagStyle(tag)"
                >
                  {{ tag.name }}
                </span>
                <span
                  v-if="cardTagsMap[card.id].length > maxCardTags"
                  class="card-item__tag card-item__tag--more"
                >
                  +{{ cardTagsMap[card.id].length - maxCardTags }}
                </span>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="workspace-tags">
            <div v-if="showTagCreator" class="tag-create">
              <input
                v-model="newTagName"
                class="tag-create__input"
                type="text"
                placeholder="标签名"
                @keydown.enter="saveTag"
              />
              <div class="tag-create__colors">
                <span class="tag-create__label">颜色</span>
                <button
                  v-for="color in tagColorOptions"
                  :key="color"
                  class="tag-color"
                  :class="{ 'tag-color--selected': color === newTagColor }"
                  :style="{ background: color }"
                  type="button"
                  @click="newTagColor = color"
                ></button>
              </div>
              <button
                class="tag-create__btn tag-create__btn--primary"
                :disabled="!newTagName.trim() || isTagSaving"
                @click="saveTag"
              >
                {{ isTagSaving ? '创建中...' : '创建' }}
              </button>
              <button class="tag-create__btn" @click="cancelTagCreator">
                取消
              </button>
            </div>
            <div v-if="tagError" class="tag-create__error">{{ tagError }}</div>

            <div v-if="isTagLoading" class="workspace-loading">
              <div class="workspace-loading__spinner"></div>
              <span>加载中...</span>
            </div>

            <div v-else-if="displayedTags.length === 0" class="workspace-empty">
              <div class="workspace-empty__icon">🏷️</div>
              <h3 class="workspace-empty__title">还没有标签</h3>
              <p class="workspace-empty__text">点击"新建标签"创建第一个标签</p>
              <button class="workspace-empty__btn" @click="openTagCreator">
                创建第一个标签
              </button>
            </div>

            <div v-else class="tag-list">
              <div
                v-for="tag in displayedTags"
                :key="tag.id"
                class="tag-item"
                :class="{ 'tag-item--selected': tag.id === selectedTagId }"
                @click="selectTag(tag)"
              >
                <span
                  class="tag-item__dot"
                  :style="{ background: tag.color || '#9ca3af' }"
                ></span>
                <span class="tag-item__name">{{ tag.name }}</span>
                <span class="tag-item__count">{{ tag.usageCount }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- 右侧：编辑面板 -->
    <div v-if="showEditor" class="workspace-editor">
      <CardEditView
        :card-id="selectedCardId || undefined"
        :project-id="props.projectId"
        @saved="onCardSaved"
        @tags-updated="onCardTagsUpdated"
        @reference-click="handleReferenceClick"
        @close="closeEditor"
      />
    </div>

    <div v-else-if="showTagEditor" class="workspace-editor workspace-editor--tag">
      <div class="tag-editor">
        <div class="tag-editor__form">
          <div class="tag-editor__header">
            <div class="tag-editor__title">标签编辑</div>
            <div class="tag-editor__usage">
              已关联 {{ selectedTag?.usageCount || 0 }} 张卡片
            </div>
          </div>
          <label class="tag-editor__label">名称</label>
          <input
            v-model="tagEditName"
            class="tag-editor__input"
            type="text"
            placeholder="标签名"
            :disabled="isTagEditSaving"
          />
          <div class="tag-editor__colors">
            <span class="tag-editor__label">颜色</span>
            <button
              v-for="color in tagColorOptions"
              :key="color"
              class="tag-editor__color"
              :class="{ 'tag-editor__color--selected': color === tagEditColor }"
              :style="{ background: color }"
              type="button"
              :disabled="isTagEditSaving"
              @click="tagEditColor = color"
            ></button>
          </div>
          <div class="tag-editor__actions">
            <button
              class="tag-editor__save"
              :disabled="!canSaveTagEdit"
              @click="saveTagEdit"
            >
              {{ isTagEditSaving ? '保存中...' : '保存' }}
            </button>
          </div>
          <div v-if="tagEditError" class="tag-editor__error">{{ tagEditError }}</div>
        </div>

        <div class="tag-editor__cards">
          <div class="tag-editor__cards-title">关联卡片</div>
          <div v-if="isTagCardsLoading" class="tag-editor__cards-empty">加载中...</div>
          <div v-else-if="tagCards.length === 0" class="tag-editor__cards-empty">
            暂无关联卡片
          </div>
          <div v-else class="tag-card-list">
            <div
              v-for="card in tagCards"
              :key="card.id"
              class="tag-card"
              @mouseenter="showTagCardPreview(card.id, $event)"
              @mouseleave="scheduleHideTagCardPreview"
            >
              <div class="tag-card__title">{{ card.title || '无标题' }}</div>
              <div class="tag-card__preview">{{ card.preview }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 无选中时的占位 -->
    <div v-else class="workspace-placeholder">
      <div class="workspace-placeholder__content">
        <span class="workspace-placeholder__icon">{{ placeholderIcon }}</span>
        <p class="workspace-placeholder__text">{{ placeholderText }}</p>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="hoveredTagCard && tagTooltipStyle"
        class="tag-card__tooltip tag-card__tooltip--portal"
        :style="tagTooltipStyle"
        @mouseenter="cancelHideTagCardPreview"
        @mouseleave="scheduleHideTagCardPreview"
      >
        <div class="tag-card__tooltip-title">{{ hoveredTagCard.title || '无标题' }}</div>
        <MarkdownRenderer :content="hoveredTagCard.content" class="tag-card__tooltip-content" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.workspace {
  flex: 1;
  height: 100%;
  display: flex;
  background: var(--color-bg);
}

/* 左侧列表区 */
.workspace-list {
  width: 320px;
  min-width: 280px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-panel);
  border-right: 1px solid var(--color-border);
}

/* 右侧编辑区 */
.workspace-editor {
  flex: 1;
  height: 100%;
  padding: 16px;
  overflow: hidden;
}

/* 占位区 */
.workspace-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.workspace-placeholder__content {
  text-align: center;
  color: var(--color-text-muted);
}

.workspace-placeholder__icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.workspace-placeholder__text {
  font-size: 14px;
}

/* 头部 */
.workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  -webkit-app-region: drag;
}

.workspace-header__tabs {
  display: flex;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.workspace-header__tab {
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  transition: all 0.15s;
}

.workspace-header__tab:hover {
  color: var(--color-text);
  background: var(--color-bg);
}

.workspace-header__tab--active {
  color: var(--color-text);
  background: var(--color-bg);
}

.workspace-header__actions {
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.workspace-header__btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 500;
  color: white;
  background: var(--color-primary);
  border-radius: var(--radius-sm);
  transition: all 0.15s;
}

.workspace-header__btn:hover {
  background: var(--color-primary-hover);
}

/* 内容区 */
.workspace-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

/* 加载状态 */
.workspace-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 200px;
  color: var(--color-text-muted);
}

.workspace-loading__spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 空状态 */
.workspace-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 200px;
  text-align: center;
}

.workspace-empty__icon {
  font-size: 36px;
}

.workspace-empty__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.workspace-empty__text {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.workspace-empty__btn {
  margin-top: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  color: white;
  background: var(--color-primary);
  border-radius: var(--radius-sm);
  transition: all 0.15s;
}

.workspace-empty__btn:hover {
  background: var(--color-primary-hover);
}

/* 卡片列表 */
.workspace-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 卡片项 */
.card-item {
  padding: 12px;
  background: var(--color-bg);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s;
}

.card-item:hover {
  border-color: var(--color-border);
}

.card-item--selected {
  border-color: var(--color-primary);
  background: rgba(59, 130, 246, 0.08);
}

.card-item__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.card-item__title {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-item__time {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.card-item__summary {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  margin-bottom: 8px;
}

.card-item__footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-item__meta {
  font-size: 11px;
  color: var(--color-text-muted);
}

.card-item__tags {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  overflow: hidden;
}

.card-item__tag {
  max-width: 90px;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-item__tag--more {
  border-color: var(--color-border);
  color: var(--color-text-muted);
  background: transparent;
}

/* 标签列表 */
.workspace-tags {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tag-create {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tag-create__input {
  flex: 1;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-panel);
  color: var(--color-text);
  font-size: 13px;
}

.tag-create__input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.tag-create__btn {
  height: 32px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg);
  transition: all 0.15s;
}

.tag-create__btn--primary {
  color: white;
  background: var(--color-primary);
}

.tag-create__btn--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.tag-create__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tag-create__colors {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tag-create__label {
  font-size: 12px;
  color: var(--color-text-muted);
}

.tag-color {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid transparent;
  transition: all 0.15s;
}

.tag-color--selected {
  border-color: var(--color-text);
}

.tag-create__error {
  font-size: 12px;
  color: var(--color-error);
}

.tag-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  background: var(--color-bg);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.tag-item:hover {
  border-color: var(--color-border);
}

.tag-item--selected {
  border-color: var(--color-primary);
  background: rgba(59, 130, 246, 0.08);
}

.tag-item__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.tag-item__name {
  flex: 1;
  font-size: 13px;
  color: var(--color-text);
}

.tag-item__count {
  font-size: 11px;
  color: var(--color-text-muted);
}

/* 标签编辑区 */
.workspace-editor--tag {
  padding: 16px;
}

.tag-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tag-editor__form {
  flex: 0 0 45%;
  min-height: 200px;
  padding: 16px;
  border-radius: var(--radius-lg);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tag-editor__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tag-editor__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.tag-editor__usage {
  font-size: 12px;
  color: var(--color-text-muted);
}

.tag-editor__label {
  font-size: 12px;
  color: var(--color-text-muted);
}

.tag-editor__input {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 13px;
}

.tag-editor__input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.tag-editor__colors {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.tag-editor__color {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid transparent;
  transition: all 0.15s;
}

.tag-editor__color:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tag-editor__color--selected {
  border-color: var(--color-text);
}

.tag-editor__actions {
  display: flex;
  justify-content: flex-end;
}

.tag-editor__save {
  padding: 6px 14px;
  font-size: 12px;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: white;
  transition: all 0.15s;
}

.tag-editor__save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tag-editor__error {
  font-size: 12px;
  color: var(--color-error);
}

.tag-editor__cards {
  flex: 1;
  min-height: 0;
  padding: 16px;
  border-radius: var(--radius-lg);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.tag-editor__cards-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.tag-editor__cards-empty {
  font-size: 12px;
  color: var(--color-text-muted);
}

.tag-card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  padding-right: 4px;
}

.tag-card {
  position: relative;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  cursor: default;
}

.tag-card__title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 4px;
}

.tag-card__preview {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.tag-card__tooltip {
  position: fixed;
  padding: 12px;
  border-radius: var(--radius-md);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
  z-index: 12;
}

.tag-card__tooltip--portal {
  z-index: 999;
}

.tag-card__tooltip-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 6px;
}

.tag-card__tooltip-content {
  max-height: 240px;
  overflow-y: auto;
}
</style>
