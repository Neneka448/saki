<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onBeforeUnmount } from 'vue'
import type { CardListItem } from '../../../../shared/ipc/types'
import { createReferenceId } from '../../utils/referenceUtils'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  autoFocus?: boolean
  referenceCandidates?: CardListItem[]
  currentCardId?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'save': []
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isUploading = ref(false)
const showReferenceList = ref(false)
const referenceQuery = ref('')
const referenceStart = ref(0)
const referenceActiveIndex = ref(0)
const referenceDropdownStyle = ref<Record<string, string>>({})
const referenceDropdownRef = ref<HTMLElement | null>(null)

const filteredReferences = computed(() => {
  const items = props.referenceCandidates || []
  const query = referenceQuery.value.trim().toLowerCase()
  const filtered = items.filter((card) => {
    if (props.currentCardId && card.id === props.currentCardId) return false
    const title = (card.title || '').toLowerCase()
    const summary = (card.summary || '').toLowerCase()
    if (!query) return Boolean(title)
    return title.includes(query) || summary.includes(query)
  })
  return filtered.slice(0, 8)
})

// 自动调整高度
const adjustHeight = () => {
  const textarea = textareaRef.value
  if (textarea) {
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }
}

// 监听内容变化
watch(() => props.modelValue, () => {
  nextTick(adjustHeight)
})

// 处理输入
const handleInput = (e: Event) => {
  const value = (e.target as HTMLTextAreaElement).value
  emit('update:modelValue', value)
  adjustHeight()
  updateReferenceState()
}

// 处理粘贴
const handlePaste = async (e: ClipboardEvent) => {
  const items = e.clipboardData?.items
  if (!items) return

  for (const item of items) {
    // 检查是否是图片
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      await handleImagePaste(item)
      return
    }
  }
}

// 处理图片粘贴
const handleImagePaste = async (item: DataTransferItem) => {
  const file = item.getAsFile()
  if (!file) return

  isUploading.value = true

  try {
    // 读取文件为 Base64
    const dataUrl = await readFileAsDataUrl(file)
    
    // 保存到本地
    const result = await window.asset.saveImage(dataUrl)
    
    if (result.success && result.fileName) {
      // 插入 Markdown 图片语法
      insertImageMarkdown(result.fileName)
    } else {
      console.error('Failed to save image:', result.error)
    }
  } catch (error) {
    console.error('Error handling image paste:', error)
  } finally {
    isUploading.value = false
  }
}

// 读取文件为 Data URL
const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 在光标位置插入图片 Markdown
const insertImageMarkdown = (fileName: string) => {
  const textarea = textareaRef.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const text = props.modelValue

  // 使用 asset:// 协议，后续在渲染时转换为实际路径
  const imageMarkdown = `![image](asset://${fileName})`
  
  const newText = text.slice(0, start) + imageMarkdown + text.slice(end)
  emit('update:modelValue', newText)

  // 恢复光标位置
  nextTick(() => {
    const newPosition = start + imageMarkdown.length
    textarea.setSelectionRange(newPosition, newPosition)
    textarea.focus()
  })
}

// 处理键盘快捷键
const handleKeydown = (e: KeyboardEvent) => {
  // Ctrl/Cmd + S 保存
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    emit('save')
  }

  if (showReferenceList.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      referenceActiveIndex.value = Math.min(referenceActiveIndex.value + 1, filteredReferences.value.length - 1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      referenceActiveIndex.value = Math.max(referenceActiveIndex.value - 1, 0)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const selected = filteredReferences.value[referenceActiveIndex.value]
      if (selected) {
        insertReference(selected)
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      closeReferenceList()
      return
    }
  }
  
  // Tab 缩进
  if (e.key === 'Tab') {
    e.preventDefault()
    const textarea = textareaRef.value
    if (!textarea) return
    
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = props.modelValue
    
    const newText = text.slice(0, start) + '  ' + text.slice(end)
    emit('update:modelValue', newText)
    
    nextTick(() => {
      textarea.setSelectionRange(start + 2, start + 2)
    })
  }
}

const getReferenceTrigger = (text: string, caret: number) => {
  const start = text.lastIndexOf('[[', caret - 1)
  if (start === -1) return null
  const closeIndex = text.indexOf(']]', start)
  if (closeIndex !== -1 && closeIndex < caret) return null
  const query = text.slice(start + 2, caret)
  if (query.includes('\n')) return null
  return { start, query }
}

const getCaretCoordinates = (textarea: HTMLTextAreaElement, position: number) => {
  const div = document.createElement('div')
  const style = window.getComputedStyle(textarea)
  div.style.position = 'absolute'
  div.style.visibility = 'hidden'
  div.style.whiteSpace = 'pre-wrap'
  div.style.wordWrap = 'break-word'
  div.style.top = '0'
  div.style.left = '0'
  div.style.width = `${textarea.offsetWidth}px`
  div.style.font = style.font
  div.style.padding = style.padding
  div.style.border = style.border
  div.style.boxSizing = style.boxSizing
  div.style.lineHeight = style.lineHeight
  div.style.letterSpacing = style.letterSpacing
  div.textContent = textarea.value.slice(0, position)
  const span = document.createElement('span')
  span.textContent = textarea.value.slice(position) || '.'
  div.appendChild(span)
  document.body.appendChild(div)
  const rect = span.getBoundingClientRect()
  const parentRect = div.getBoundingClientRect()
  const coords = {
    top: rect.top - parentRect.top,
    left: rect.left - parentRect.left,
  }
  document.body.removeChild(div)
  return coords
}

const updateReferenceDropdown = () => {
  const textarea = textareaRef.value
  if (!textarea) return
  const caret = textarea.selectionStart
  const coords = getCaretCoordinates(textarea, caret)
  const rect = textarea.getBoundingClientRect()
  referenceDropdownStyle.value = {
    top: `${rect.top + coords.top + 24}px`,
    left: `${rect.left + coords.left}px`,
  }
}

const updateReferenceState = () => {
  const textarea = textareaRef.value
  if (!textarea) return
  const caret = textarea.selectionStart
  const trigger = getReferenceTrigger(textarea.value, caret)
  if (!trigger) {
    closeReferenceList()
    return
  }
  referenceStart.value = trigger.start
  referenceQuery.value = trigger.query
  referenceActiveIndex.value = 0
  if (filteredReferences.value.length === 0) {
    showReferenceList.value = false
    return
  }
  showReferenceList.value = true
  updateReferenceDropdown()
}

const closeReferenceList = () => {
  showReferenceList.value = false
}

const insertReference = (card: CardListItem) => {
  const textarea = textareaRef.value
  if (!textarea) return
  const start = referenceStart.value
  const end = textarea.selectionStart
  const title = card.title || '无标题'
  const refId = createReferenceId()
  const referenceText = `[[${title}]]()<!--ref:${refId}-->`
  const text = props.modelValue
  const nextText = text.slice(0, start) + referenceText + text.slice(end)
  emit('update:modelValue', nextText)
  showReferenceList.value = false

  nextTick(() => {
    const cursor = start + `[[${title}]](`.length
    textarea.setSelectionRange(cursor, cursor)
    textarea.focus()
  })
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node
  if (textareaRef.value?.contains(target)) return
  if (referenceDropdownRef.value?.contains(target)) return
  closeReferenceList()
}

// 自动聚焦
watch(() => props.autoFocus, (focus) => {
  if (focus && textareaRef.value) {
    textareaRef.value.focus()
  }
}, { immediate: true })

// 初始化高度
nextTick(adjustHeight)

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="markdown-editor">
    <textarea
      ref="textareaRef"
      :value="modelValue"
      :placeholder="placeholder || '开始输入内容...\n\n支持 Markdown 语法，可直接粘贴图片'"
      class="markdown-editor__textarea"
      @input="handleInput"
      @paste="handlePaste"
      @keydown="handleKeydown"
    />

    <Teleport to="body">
      <div
        v-if="showReferenceList"
        ref="referenceDropdownRef"
        class="markdown-editor__reference"
        :style="referenceDropdownStyle"
      >
        <div class="markdown-editor__reference-title">引用卡片</div>
        <button
          v-for="(card, index) in filteredReferences"
          :key="card.id"
          class="markdown-editor__reference-item"
          :class="{ 'markdown-editor__reference-item--active': index === referenceActiveIndex }"
          @click="insertReference(card)"
        >
          <span class="markdown-editor__reference-name">{{ card.title || '无标题' }}</span>
          <span v-if="card.summary" class="markdown-editor__reference-summary">{{ card.summary }}</span>
        </button>
        <div v-if="filteredReferences.length === 0" class="markdown-editor__reference-empty">
          没有匹配卡片
        </div>
      </div>
    </Teleport>
    
    <!-- 上传指示器 -->
    <div v-if="isUploading" class="markdown-editor__uploading">
      <span class="markdown-editor__uploading-spinner"></span>
      <span>正在上传图片...</span>
    </div>
  </div>
</template>

<style scoped>
.markdown-editor {
  position: relative;
  width: 100%;
}

.markdown-editor__textarea {
  width: 100%;
  min-height: 200px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-panel);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  outline: none;
  transition: border-color 0.15s;
}

.markdown-editor__textarea:focus {
  border-color: var(--color-primary);
}

.markdown-editor__textarea::placeholder {
  color: var(--color-text-muted);
}

.markdown-editor__uploading {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
  box-shadow: var(--shadow-sm);
}

.markdown-editor__uploading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.markdown-editor__reference {
  position: fixed;
  min-width: 220px;
  max-width: 320px;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 999;
}

.markdown-editor__reference-title {
  font-size: 11px;
  color: var(--color-text-muted);
}

.markdown-editor__reference-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
}

.markdown-editor__reference-item--active {
  background: rgba(59, 130, 246, 0.08);
}

.markdown-editor__reference-name {
  font-size: 12px;
  color: var(--color-text);
}

.markdown-editor__reference-summary {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.markdown-editor__reference-empty {
  font-size: 12px;
  color: var(--color-text-muted);
  padding: 4px 6px;
}
</style>
