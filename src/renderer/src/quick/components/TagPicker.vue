<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { TagWithMeta } from '../../../../shared/ipc/types'
import { getTagDisplayInfo, searchTags, sortTagsByName } from '../../utils/tagUtils'

const props = defineProps<{
  tags: TagWithMeta[]
  modelValue: number[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
  'create': [name: string]
}>()

const isOpen = ref(false)
const query = ref('')
const dropdownRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

const selectedIds = computed(() => new Set(props.modelValue))
const selectedTags = computed(() => sortTagsByName(props.tags.filter((tag) => selectedIds.value.has(tag.id))))
const filteredTags = computed(() => sortTagsByName(searchTags(props.tags, query.value)))
const canCreate = computed(() => {
  const name = query.value.trim()
  if (!name) return false
  return !props.tags.some((tag) => tag.name.toLowerCase() === name.toLowerCase())
})

const openDropdown = async () => {
  if (props.disabled) return
  isOpen.value = true
  await nextTick()
  inputRef.value?.focus()
}

const closeDropdown = () => {
  isOpen.value = false
  query.value = ''
}

const toggleDropdown = () => {
  if (isOpen.value) {
    closeDropdown()
    return
  }
  openDropdown()
}

const toggleTag = (tag: TagWithMeta) => {
  if (props.disabled) return
  const next = new Set(props.modelValue)
  if (next.has(tag.id)) {
    next.delete(tag.id)
  } else {
    next.add(tag.id)
  }
  emit('update:modelValue', Array.from(next))
}

const requestCreate = () => {
  const name = query.value.trim()
  if (!name) return
  emit('create', name)
  closeDropdown()
}

const handleInputKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    if (canCreate.value) {
      requestCreate()
      return
    }
    const first = filteredTags.value[0]
    if (first) {
      toggleTag(first)
      closeDropdown()
    }
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    closeDropdown()
  }
}

const handleOutsideClick = (event: MouseEvent) => {
  if (!isOpen.value) return
  const target = event.target as Node
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
  <div class="tag-picker">
    <div class="tag-picker__selected">
      <span v-if="selectedTags.length === 0" class="tag-picker__placeholder">未选择标签</span>
      <button
        v-for="tag in selectedTags"
        :key="tag.id"
        type="button"
        class="tag-chip"
        @click="toggleTag(tag)"
      >
        <span
          class="tag-chip__dot"
          :style="{ backgroundColor: getTagDisplayInfo(tag, 'solid').color }"
        ></span>
        <span class="tag-chip__label">{{ tag.name }}</span>
        <span class="tag-chip__remove">x</span>
      </button>
    </div>

    <button
      ref="triggerRef"
      type="button"
      class="tag-picker__trigger"
      :disabled="disabled"
      @click="toggleDropdown"
    >
      + 标签
    </button>

    <div v-if="isOpen" ref="dropdownRef" class="tag-picker__dropdown">
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        class="tag-picker__search"
        placeholder="搜索或创建标签"
        @keydown="handleInputKeydown"
      />

      <div class="tag-picker__list">
        <button
          v-for="tag in filteredTags"
          :key="tag.id"
          type="button"
          class="tag-picker__option"
          :class="{ 'is-selected': selectedIds.has(tag.id) }"
          @click="toggleTag(tag)"
        >
          <span
            class="tag-picker__option-dot"
            :style="{ backgroundColor: getTagDisplayInfo(tag, 'solid').color }"
          ></span>
          <span class="tag-picker__option-label">{{ tag.name }}</span>
        </button>

        <button
          v-if="canCreate"
          type="button"
          class="tag-picker__option tag-picker__option--create"
          @click="requestCreate"
        >
          创建 "{{ query.trim() }}"
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tag-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  position: relative;
}

.tag-picker__selected {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 32px;
  align-items: center;
}

.tag-picker__placeholder {
  color: var(--color-text-muted);
  font-size: 12px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: 12px;
  color: var(--color-text-secondary);
  box-shadow: var(--shadow-sm);
}

.tag-chip__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.tag-chip__remove {
  font-weight: 600;
  color: var(--color-text-muted);
}

.tag-picker__trigger {
  padding: 6px 12px;
  border-radius: var(--radius-full);
  background: var(--color-bg-elevated);
  border: 1px dashed var(--color-border);
  font-size: 12px;
  color: var(--color-text-secondary);
}

.tag-picker__trigger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tag-picker__dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 240px;
  max-width: 340px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: 10px;
  z-index: 20;
}

.tag-picker__search {
  width: 100%;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: white;
  font-size: 12px;
}

.tag-picker__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.tag-picker__option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  background: transparent;
  text-align: left;
  font-size: 12px;
  color: var(--color-text);
}

.tag-picker__option:hover {
  background: rgba(58, 109, 246, 0.12);
}

.tag-picker__option.is-selected {
  background: rgba(58, 109, 246, 0.16);
  color: var(--color-primary);
}

.tag-picker__option-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.tag-picker__option--create {
  color: var(--color-primary);
  font-weight: 600;
}
</style>
