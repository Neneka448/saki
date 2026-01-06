<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

export interface MetadataFields {
  sourceUrl?: string
  sourcePath?: string
}

const props = defineProps<{
  modelValue: MetadataFields
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: MetadataFields]
}>()

const isOpen = ref(false)
const editingField = ref<'url' | 'path' | null>(null)
const tempUrl = ref('')
const tempPath = ref('')
const dropdownRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const urlInputRef = ref<HTMLInputElement | null>(null)
const pathInputRef = ref<HTMLInputElement | null>(null)

const hasMetadata = computed(() => Boolean(props.modelValue.sourceUrl || props.modelValue.sourcePath))
const metadataCount = computed(() => {
  let count = 0
  if (props.modelValue.sourceUrl) count++
  if (props.modelValue.sourcePath) count++
  return count
})

const openDropdown = async () => {
  if (props.disabled) return
  isOpen.value = true
  tempUrl.value = props.modelValue.sourceUrl || ''
  tempPath.value = props.modelValue.sourcePath || ''
  await nextTick()
}

const closeDropdown = () => {
  isOpen.value = false
  editingField.value = null
}

const toggleDropdown = () => {
  if (isOpen.value) {
    closeDropdown()
    return
  }
  openDropdown()
}

const startEditUrl = async () => {
  editingField.value = 'url'
  await nextTick()
  urlInputRef.value?.focus()
}

const startEditPath = async () => {
  editingField.value = 'path'
  await nextTick()
  pathInputRef.value?.focus()
}

const saveUrl = () => {
  const url = tempUrl.value.trim()
  emit('update:modelValue', {
    ...props.modelValue,
    sourceUrl: url || undefined,
  })
  editingField.value = null
}

const savePath = () => {
  const path = tempPath.value.trim()
  emit('update:modelValue', {
    ...props.modelValue,
    sourcePath: path || undefined,
  })
  editingField.value = null
}

const removeUrl = () => {
  if (props.disabled) return
  emit('update:modelValue', {
    ...props.modelValue,
    sourceUrl: undefined,
  })
  tempUrl.value = ''
}

const removePath = () => {
  if (props.disabled) return
  emit('update:modelValue', {
    ...props.modelValue,
    sourcePath: undefined,
  })
  tempPath.value = ''
}

const handleInputKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    if (editingField.value === 'url') {
      saveUrl()
    } else if (editingField.value === 'path') {
      savePath()
    }
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    editingField.value = null
  }
}

const handleOutsideClick = (event: MouseEvent) => {
  if (!isOpen.value) return
  const target = event.target as Node | null
  if (!target) return
  if (dropdownRef.value?.contains(target)) return
  if (triggerRef.value?.contains(target)) return
  closeDropdown()
}

onMounted(() => {
  document.addEventListener('mousedown', handleOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleOutsideClick)
})
</script>

<template>
  <div class="metadata-picker">
    <div v-if="hasMetadata" class="metadata-picker__selected">
      <button
        v-if="modelValue.sourceUrl"
        type="button"
        class="metadata-chip"
        :disabled="disabled"
        :aria-label="`移除来源链接: ${modelValue.sourceUrl}`"
        @click="removeUrl"
      >
        <span class="metadata-chip__icon">🔗</span>
        <span class="metadata-chip__label">{{ modelValue.sourceUrl }}</span>
        <span class="metadata-chip__remove">x</span>
      </button>
      <button
        v-if="modelValue.sourcePath"
        type="button"
        class="metadata-chip"
        :disabled="disabled"
        :aria-label="`移除文件路径: ${modelValue.sourcePath}`"
        @click="removePath"
      >
        <span class="metadata-chip__icon">📁</span>
        <span class="metadata-chip__label">{{ modelValue.sourcePath }}</span>
        <span class="metadata-chip__remove">x</span>
      </button>
    </div>

    <button
      ref="triggerRef"
      type="button"
      class="metadata-picker__trigger"
      :disabled="disabled"
      @click="toggleDropdown"
    >
      + 元信息{{ metadataCount > 0 ? ` (${metadataCount})` : '' }}
    </button>

    <div v-if="isOpen" ref="dropdownRef" class="metadata-picker__dropdown">
      <div class="metadata-picker__section">
        <div class="metadata-picker__section-header">
          <span class="metadata-picker__section-icon">🔗</span>
          <span class="metadata-picker__section-title">来源链接</span>
        </div>
        <div v-if="editingField !== 'url'" class="metadata-picker__value-display">
          <span v-if="modelValue.sourceUrl" class="metadata-picker__value">{{ modelValue.sourceUrl }}</span>
          <span v-else class="metadata-picker__placeholder">未设置</span>
          <button
            type="button"
            class="metadata-picker__edit-btn"
            @click="startEditUrl"
          >
            {{ modelValue.sourceUrl ? '编辑' : '添加' }}
          </button>
        </div>
        <div v-else class="metadata-picker__input-wrapper">
          <input
            ref="urlInputRef"
            v-model="tempUrl"
            type="text"
            class="metadata-picker__input"
            placeholder="输入网页链接或来源 URL"
            @keydown="handleInputKeydown"
            @blur="saveUrl"
          />
        </div>
      </div>

      <div class="metadata-picker__section">
        <div class="metadata-picker__section-header">
          <span class="metadata-picker__section-icon">📁</span>
          <span class="metadata-picker__section-title">文件路径</span>
        </div>
        <div v-if="editingField !== 'path'" class="metadata-picker__value-display">
          <span v-if="modelValue.sourcePath" class="metadata-picker__value">{{ modelValue.sourcePath }}</span>
          <span v-else class="metadata-picker__placeholder">未设置</span>
          <button
            type="button"
            class="metadata-picker__edit-btn"
            @click="startEditPath"
          >
            {{ modelValue.sourcePath ? '编辑' : '添加' }}
          </button>
        </div>
        <div v-else class="metadata-picker__input-wrapper">
          <input
            ref="pathInputRef"
            v-model="tempPath"
            type="text"
            class="metadata-picker__input"
            placeholder="输入代码文件路径或位置"
            @keydown="handleInputKeydown"
            @blur="savePath"
          />
        </div>
      </div>

      <div class="metadata-picker__hint">
        元信息帮助你记录内容来源，便于后续溯源
      </div>
    </div>
  </div>
</template>

<style scoped>
.metadata-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  position: relative;
}

.metadata-picker__selected {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.metadata-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--radius-full);
  font-size: 12px;
  color: var(--color-text);
  transition: all 0.2s;
  cursor: pointer;
  max-width: 300px;
}

.metadata-chip:hover {
  background: rgba(255, 255, 255, 0.8);
  border-color: rgba(0, 0, 0, 0.1);
}

.metadata-chip:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.metadata-chip:disabled:hover {
  background: rgba(255, 255, 255, 0.6);
  border-color: rgba(0, 0, 0, 0.06);
}

.metadata-chip__icon {
  font-size: 12px;
  line-height: 1;
}

.metadata-chip__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metadata-chip__remove {
  font-weight: 600;
  color: var(--color-text-muted);
  opacity: 0.6;
  flex-shrink: 0;
}

.metadata-chip:hover .metadata-chip__remove {
  opacity: 1;
}

.metadata-picker__trigger {
  padding: 6px 12px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(0, 0, 0, 0.06);
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.metadata-picker__trigger:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.8);
  color: var(--color-text);
  border-color: rgba(0, 0, 0, 0.1);
}

.metadata-picker__trigger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.metadata-picker__dropdown {
  position: absolute;
  bottom: calc(100% + 8px);
  top: auto;
  left: 0;
  min-width: 320px;
  max-width: 420px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 12px;
  z-index: 100;
  transform-origin: bottom left;
  animation: slideUp 0.2s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.metadata-picker__section {
  margin-bottom: 12px;
}

.metadata-picker__section:last-of-type {
  margin-bottom: 8px;
}

.metadata-picker__section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.metadata-picker__section-icon {
  font-size: 14px;
  line-height: 1;
}

.metadata-picker__section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
}

.metadata-picker__value-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.metadata-picker__value {
  flex: 1;
  font-size: 12px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metadata-picker__placeholder {
  flex: 1;
  font-size: 12px;
  color: var(--color-text-muted);
}

.metadata-picker__edit-btn {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.metadata-picker__edit-btn:hover {
  background: var(--color-bg-soft);
  color: var(--color-text);
  border-color: var(--color-text-muted);
}

.metadata-picker__input-wrapper {
  padding: 2px;
}

.metadata-picker__input {
  width: 100%;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-primary);
  background: white;
  font-size: 12px;
  outline: none;
  box-shadow: 0 0 0 2px rgba(58, 109, 246, 0.1);
}

.metadata-picker__input::placeholder {
  color: var(--color-text-muted);
}

.metadata-picker__hint {
  padding: 8px 10px;
  background: rgba(58, 109, 246, 0.06);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--color-text-secondary);
  line-height: 1.4;
}
</style>
