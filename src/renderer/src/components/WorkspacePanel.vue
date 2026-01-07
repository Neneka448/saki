<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import type { CardChangeEvent } from '../../../shared/ipc/types'
import type { CardListItem, CardDetail, TagWithMeta, TagWithUsageCount } from '../../../shared/ipc/types'
import { getTagDisplayInfo, sortTagsByUsage } from '../utils/tagUtils'
import { filterCardsByTags, searchCardsFullText, type CardSearchResult } from '../utils/cardSearchUtils'
import CardEditView from './card/CardEditView.vue'
import MarkdownRenderer from './card/MarkdownRenderer.vue'
import TagTree from './TagTree.vue'

const props = defineProps<{
  projectId: number
}>()

// 打开 Live2D 独立窗口
async function openLive2DWindow() {
  try {
    // @ts-ignore - window.app 是 preload 注入的
    if (!window.app?.showLive2D) {
      console.warn('[Live2D] showLive2D API not initialized')
      return
    }
    await window.app.showLive2D()
  } catch (error) {
    console.error('[Live2D] Failed to open Live2D window:', error)
  }
}

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

// 筛选和搜索状态
const filterTagIds = ref<number[]>([])
const searchQuery = ref('')
const searchResults = ref<CardSearchResult[]>([])
const isSearching = ref(false)
const showFilterPanel = ref(false)
const tagColorOptions = [
  '#3a6df6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#0ea5e9',
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

// 是否有筛选条件
const hasFilter = computed(() => filterTagIds.value.length > 0 || searchQuery.value.trim() !== '')

// 筛选标签的显示信息
const filterTagsInfo = computed(() => {
  return filterTagIds.value.map(id => {
    const tag = tags.value.find(t => t.id === id)
    return tag ? { id, name: tag.name, color: tag.color } : null
  }).filter(Boolean)
})

// 显示的卡片列表（考虑筛选和搜索）
const displayedCards = computed(() => {
  if (searchQuery.value.trim()) {
    return searchResults.value.map(r => r.card)
  }
  return cards.value
})

// 加载卡片列表（支持标签筛选）
const loadCards = async () => {
  isLoading.value = true
  try {
    let result
    if (filterTagIds.value.length > 0) {
      // 有标签筛选
      const filteredCards = await filterCardsByTags(props.projectId, filterTagIds.value)
      result = { success: true, data: filteredCards }
    } else {
      result = await window.card.getListByProject(props.projectId)
    }
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

// 搜索功能
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const handleSearch = async () => {
  const query = searchQuery.value.trim()
  if (!query) {
    searchResults.value = []
    return
  }

  isSearching.value = true
  try {
    const results = await searchCardsFullText(props.projectId, query)
    searchResults.value = results
  } catch (e) {
    console.error('Failed to search cards:', e)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

const debouncedSearch = () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
  searchDebounceTimer = setTimeout(handleSearch, 300)
}

const clearSearch = () => {
  searchQuery.value = ''
  searchResults.value = []
}

// 标签筛选功能
const toggleFilterTag = (tagId: number) => {
  const next = [...filterTagIds.value]
  const index = next.indexOf(tagId)
  if (index >= 0) {
    next.splice(index, 1)
  } else {
    next.push(tagId)
  }
  filterTagIds.value = next
  loadCards()
}

const removeFilterTag = (tagId: number) => {
  filterTagIds.value = filterTagIds.value.filter(id => id !== tagId)
  loadCards()
}

const clearFilters = () => {
  filterTagIds.value = []
  searchQuery.value = ''
  searchResults.value = []
  loadCards()
}

const toggleFilterPanel = () => {
  showFilterPanel.value = !showFilterPanel.value
}

// 从标签视图快速筛选卡片（切换到时间流并添加筛选）
const filterByTag = (tag: TagWithUsageCount) => {
  filterTagIds.value = [tag.id]
  activeTab.value = 'timeline'
  loadCards()
}

// 监听 projectId 变化重新加载
watch(() => props.projectId, () => {
  selectedCardId.value = null
  isCreating.value = false
  clearSelectedTag()
  clearFilters()
  loadCards()
  if (isTagView.value) {
    loadTags()
  }
})

// 监听搜索输入
watch(searchQuery, debouncedSearch)

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

let removeCardListener: (() => void) | null = null

onMounted(() => {
  loadCards()
  loadTags() // 始终加载标签，用于筛选面板
  removeCardListener = window.card?.onChanged?.((event: CardChangeEvent) => {
    if (!event || event.projectId !== props.projectId) return
    if (event.type === 'tag') {
      loadCardTagsForCard(event.cardId)
      loadTags()
      return
    }
    loadCards()
    loadTags()
  }) || null
})

onBeforeUnmount(() => {
  removeCardListener?.()
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
          <button 
            class="workspace-header__icon-btn"
            title="Live2D 角色"
            @click="openLive2DWindow"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </button>
          <button 
            v-if="!isTagView"
            class="workspace-header__icon-btn"
            :class="{ 'workspace-header__icon-btn--active': showFilterPanel }"
            title="筛选"
            @click="toggleFilterPanel"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </button>
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
          <!-- 搜索和筛选栏 -->
          <div v-if="showFilterPanel" class="workspace-filter">
            <!-- 搜索框 -->
            <div class="workspace-filter__search">
              <svg class="workspace-filter__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                v-model="searchQuery"
                class="workspace-filter__search-input"
                type="text"
                placeholder="搜索卡片内容..."
              />
              <button
                v-if="searchQuery"
                class="workspace-filter__search-clear"
                @click="clearSearch"
              >
                ×
              </button>
            </div>

            <!-- 标签筛选 -->
            <div class="workspace-filter__tags">
              <span class="workspace-filter__label">按标签筛选：</span>
              <div class="workspace-filter__tag-list">
                <button
                  v-for="tag in displayedTags"
                  :key="tag.id"
                  class="workspace-filter__tag"
                  :class="{ 'workspace-filter__tag--active': filterTagIds.includes(tag.id) }"
                  :style="filterTagIds.includes(tag.id) ? { borderColor: tag.color || 'var(--color-primary)' } : {}"
                  @click="toggleFilterTag(tag.id)"
                >
                  <span
                    class="workspace-filter__tag-dot"
                    :style="{ background: tag.color || 'var(--color-text-muted)' }"
                  ></span>
                  {{ tag.name }}
                </button>
              </div>
            </div>
          </div>

          <!-- 当前筛选条件展示 -->
          <div v-if="hasFilter" class="workspace-filter-bar">
            <div class="workspace-filter-bar__items">
              <span v-if="searchQuery" class="workspace-filter-bar__item workspace-filter-bar__item--search">
                🔍 "{{ searchQuery }}"
                <button class="workspace-filter-bar__remove" @click="clearSearch">×</button>
              </span>
              <span
                v-for="tag in filterTagsInfo"
                :key="tag.id"
                class="workspace-filter-bar__item"
                :style="{ borderColor: tag.color || 'var(--color-primary)' }"
              >
                <span
                  class="workspace-filter-bar__dot"
                  :style="{ background: tag.color || 'var(--color-text-muted)' }"
                ></span>
                {{ tag.name }}
                <button class="workspace-filter-bar__remove" @click="removeFilterTag(tag.id)">×</button>
              </span>
            </div>
            <button class="workspace-filter-bar__clear" @click="clearFilters">清除筛选</button>
          </div>

          <!-- 加载状态 -->
          <div v-if="isLoading || isSearching" class="workspace-loading">
            <div class="workspace-loading__spinner"></div>
            <span>{{ isSearching ? '搜索中...' : '加载中...' }}</span>
          </div>

          <!-- 空状态 -->
          <div v-else-if="displayedCards.length === 0" class="workspace-empty">
            <template v-if="hasFilter">
              <div class="workspace-empty__icon">🔍</div>
              <h3 class="workspace-empty__title">未找到匹配的卡片</h3>
              <p class="workspace-empty__text">尝试调整筛选条件</p>
              <button class="workspace-empty__btn" @click="clearFilters">
                清除筛选
              </button>
            </template>
            <template v-else>
              <div class="workspace-empty__icon">📝</div>
              <h3 class="workspace-empty__title">还没有卡片</h3>
              <p class="workspace-empty__text">点击"新建"开始记录</p>
              <button class="workspace-empty__btn" @click="createCard">
                创建第一张卡片
              </button>
            </template>
          </div>

          <!-- 卡片列表 -->
          <div v-else class="workspace-cards">
            <div
              v-for="card in displayedCards"
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
                <span v-if="card.extra?.sourceUrl || card.extra?.sourcePath" class="card-item__source-tag" title="包含来源信息">
                  <template v-if="card.extra.sourceUrl">🔗</template>
                  <template v-else-if="card.extra.sourcePath">📁</template>
                  来源
                </span>
                <span v-if="card.wordCount" class="card-item__word-count">
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

            <TagTree
              v-else
              :tags="displayedTags"
              :selected-tag-id="selectedTagId"
              @select="selectTag"
              @filter="filterByTag"
            />
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
  background: transparent;
  gap: 8px;
  min-width: 0;
  animation: panel-rise 0.35s ease both;
}

/* 左侧列表区 */
.workspace-list {
  width: 260px;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  backdrop-filter: blur(12px);
}

/* 右侧编辑区 */
.workspace-editor {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 8px;
  overflow: hidden;
}

/* 占位区 */
.workspace-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  border: 1px dashed var(--color-border);
  background: rgba(255, 255, 255, 0.6);
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
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.7));
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
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  transition: all 0.2s ease;
}

.workspace-header__tab:hover {
  color: var(--color-text);
  background: white;
}

.workspace-header__tab--active {
  color: var(--color-text);
  background: linear-gradient(135deg, rgba(58, 109, 246, 0.18), rgba(17, 183, 165, 0.12));
  border-color: rgba(58, 109, 246, 0.45);
  box-shadow: var(--shadow-sm);
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
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
  box-shadow: 0 10px 18px rgba(58, 109, 246, 0.2);
}

.workspace-header__btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 22px rgba(58, 109, 246, 0.28);
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
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
  box-shadow: 0 10px 18px rgba(58, 109, 246, 0.2);
}

.workspace-empty__btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 22px rgba(58, 109, 246, 0.28);
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
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
  position: relative;
}

.card-item:hover {
  border-color: var(--color-border-strong);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.card-item--selected {
  border-color: rgba(58, 109, 246, 0.45);
  background: linear-gradient(135deg, rgba(58, 109, 246, 0.12), rgba(17, 183, 165, 0.1));
  box-shadow: var(--shadow-glow);
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
  position: relative;
}

.card-item__word-count {
  position: absolute;
  right: 12px;
  bottom: 12px;
  font-size: 10px;
  color: var(--color-text-muted);
  opacity: 0.6;
}

.card-item__source-tag {
  font-size: 10px;
  color: var(--color-text-secondary);
  background: var(--color-bg-soft);
  padding: 1px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 3px;
  opacity: 0.8;
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
  background: var(--color-bg-elevated);
  color: var(--color-text);
  font-size: 13px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
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
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  transition: all 0.2s ease;
}

.tag-create__btn--primary {
  color: white;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  border-color: transparent;
  box-shadow: 0 10px 18px rgba(58, 109, 246, 0.2);
}

.tag-create__btn--primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 22px rgba(58, 109, 246, 0.28);
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
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
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
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
}

.tag-item:hover {
  border-color: var(--color-border-strong);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.tag-item--selected {
  border-color: rgba(58, 109, 246, 0.45);
  background: linear-gradient(135deg, rgba(58, 109, 246, 0.12), rgba(17, 183, 165, 0.1));
  box-shadow: var(--shadow-glow);
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
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
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
  background: var(--color-bg-elevated);
  color: var(--color-text);
  font-size: 13px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
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
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  color: white;
  transition: all 0.2s ease;
  box-shadow: 0 10px 18px rgba(58, 109, 246, 0.2);
}

.tag-editor__save:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 22px rgba(58, 109, 246, 0.28);
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
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
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
  background: var(--color-bg-elevated);
  cursor: default;
  box-shadow: var(--shadow-sm);
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
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
  z-index: 12;
  backdrop-filter: blur(10px);
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

/* 筛选面板样式 */
.workspace-filter {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.5);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workspace-filter__search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: white;
  transition: all 0.2s;
}

.workspace-filter__search:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(58, 109, 246, 0.1);
}

.workspace-filter__search-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.workspace-filter__search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--color-text);
  outline: none;
}

.workspace-filter__search-input::placeholder {
  color: var(--color-text-muted);
}

.workspace-filter__search-clear {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-bg-soft);
  border: none;
  color: var(--color-text-muted);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.workspace-filter__search-clear:hover {
  background: var(--color-bg-elevated);
  color: var(--color-text);
}

.workspace-filter__tags {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workspace-filter__label {
  font-size: 12px;
  color: var(--color-text-muted);
}

.workspace-filter__tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.workspace-filter__tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: white;
  font-size: 11px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.workspace-filter__tag:hover {
  border-color: var(--color-border-strong);
  background: var(--color-bg-soft);
}

.workspace-filter__tag--active {
  background: rgba(58, 109, 246, 0.08);
  color: var(--color-primary);
}

.workspace-filter__tag-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

/* 筛选条件栏 */
.workspace-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(58, 109, 246, 0.04);
  border-bottom: 1px solid var(--color-border);
}

.workspace-filter-bar__items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.workspace-filter-bar__item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: var(--radius-full);
  background: white;
  border: 1px solid var(--color-border);
  font-size: 11px;
  color: var(--color-text);
}

.workspace-filter-bar__item--search {
  background: rgba(58, 109, 246, 0.08);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.workspace-filter-bar__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.workspace-filter-bar__remove {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 2px;
}

.workspace-filter-bar__remove:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--color-text);
}

.workspace-filter-bar__clear {
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background: transparent;
  border: none;
  font-size: 11px;
  color: var(--color-text-muted);
  cursor: pointer;
  white-space: nowrap;
}

.workspace-filter-bar__clear:hover {
  color: var(--color-primary);
}

.workspace-header__icon-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: white;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.workspace-header__icon-btn:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text);
}

.workspace-header__icon-btn--active {
  background: rgba(58, 109, 246, 0.08);
  border-color: var(--color-primary);
  color: var(--color-primary);
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
</style>
