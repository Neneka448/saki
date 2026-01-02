<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { TagWithUsageCount } from '../../../shared/ipc/types'
import { buildTagTree, flattenTagTree, type TagTreeNode } from '../utils/tagTreeUtils'

const props = defineProps<{
  tags: TagWithUsageCount[]
  selectedTagId: number | null
}>()

const emit = defineEmits<{
  select: [tag: TagWithUsageCount]
  filter: [tag: TagWithUsageCount]
}>()

// 展开的路径集合
const expandedPaths = ref<Set<string>>(new Set())

// 构建树形结构
const tree = computed(() => buildTagTree(props.tags))

// 扁平化用于渲染
const flatNodes = computed(() => flattenTagTree(tree.value, expandedPaths.value))

// 可见节点
const visibleNodes = computed(() => flatNodes.value.filter(node => node.visible))

// 切换展开状态
const toggleExpand = (node: TagTreeNode, event: MouseEvent) => {
  event.stopPropagation()
  const next = new Set(expandedPaths.value)
  if (next.has(node.fullPath)) {
    next.delete(node.fullPath)
  } else {
    next.add(node.fullPath)
  }
  expandedPaths.value = next
}

// 选择标签
const handleSelect = (node: TagTreeNode) => {
  if (node.isTag && node.tag) {
    emit('select', node.tag)
  } else {
    // 如果是纯目录节点，切换展开状态
    const next = new Set(expandedPaths.value)
    if (next.has(node.fullPath)) {
      next.delete(node.fullPath)
    } else {
      next.add(node.fullPath)
    }
    expandedPaths.value = next
  }
}

// 检查是否选中
const isSelected = (node: TagTreeNode) => {
  return node.isTag && node.tag?.id === props.selectedTagId
}

// 默认展开第一层
watch(() => props.tags, () => {
  // 可以在这里设置默认展开逻辑
}, { immediate: true })
</script>

<template>
  <div class="tag-tree">
    <div
      v-for="node in visibleNodes"
      :key="node.fullPath"
      class="tag-tree-node"
      :class="{
        'tag-tree-node--selected': isSelected(node),
        'tag-tree-node--folder': !node.isTag,
        'tag-tree-node--tag': node.isTag,
      }"
      :style="{ paddingLeft: `${12 + node.depth * 16}px` }"
      @click="handleSelect(node)"
    >
      <!-- 展开/折叠图标 -->
      <button
        v-if="node.children.length > 0"
        class="tag-tree-node__toggle"
        @click="toggleExpand(node, $event)"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          :style="{ transform: node.expanded ? 'rotate(90deg)' : 'rotate(0)' }"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
      <span v-else class="tag-tree-node__toggle-placeholder"></span>

      <!-- 图标 -->
      <span class="tag-tree-node__icon">
        <template v-if="node.isTag">
          <span
            class="tag-tree-node__dot"
            :style="{ background: node.tag?.color || 'var(--color-text-muted)' }"
          ></span>
        </template>
        <template v-else>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </template>
      </span>

      <!-- 名称 -->
      <span class="tag-tree-node__name">{{ node.name }}</span>

      <!-- 计数 -->
      <span class="tag-tree-node__count">{{ node.totalCount }}</span>

      <!-- 筛选按钮 -->
      <button
        v-if="node.isTag && node.tag"
        class="tag-tree-node__filter"
        title="查看相关卡片"
        @click.stop="$emit('filter', node.tag)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </button>
    </div>

    <!-- 空状态 -->
    <div v-if="visibleNodes.length === 0" class="tag-tree-empty">
      暂无标签
    </div>
  </div>
</template>

<style scoped>
.tag-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tag-tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.tag-tree-node:hover {
  background: rgba(58, 109, 246, 0.08);
}

.tag-tree-node--selected {
  background: rgba(58, 109, 246, 0.12);
  color: var(--color-primary);
}

.tag-tree-node--folder {
  color: var(--color-text-secondary);
}

.tag-tree-node__toggle {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.tag-tree-node__toggle:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--color-text);
}

.tag-tree-node__toggle svg {
  transition: transform 0.2s ease;
}

.tag-tree-node__toggle-placeholder {
  width: 16px;
  flex-shrink: 0;
}

.tag-tree-node__icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.tag-tree-node__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.tag-tree-node__name {
  flex: 1;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag-tree-node__count {
  font-size: 11px;
  color: var(--color-text-muted);
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 6px;
  border-radius: 10px;
  flex-shrink: 0;
}

.tag-tree-node--selected .tag-tree-node__count {
  background: rgba(58, 109, 246, 0.15);
  color: var(--color-primary);
}

.tag-tree-node__filter {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.15s;
  flex-shrink: 0;
}

.tag-tree-node:hover .tag-tree-node__filter {
  opacity: 1;
}

.tag-tree-node__filter:hover {
  background: rgba(58, 109, 246, 0.1);
  color: var(--color-primary);
}

.tag-tree-empty {
  padding: 24px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}
</style>
