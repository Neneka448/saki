<script setup lang="ts">
import { ref, computed } from 'vue'

interface Operation {
  id: number
  title?: string
  addTags?: string[]
  removeTags?: string[]
  content?: string
}

interface ProposalData {
  reason: string
  operations: Operation[]
}

const props = defineProps<{
  data: ProposalData
  projectId: number
}>()

const emit = defineEmits<{
  confirm: [operations: Operation[]]
  cancel: []
}>()

const isSubmitting = ref(false)
const isCompleted = ref(false)
const error = ref('')

const operations = computed(() => props.data.operations || [])

const handleConfirm = async () => {
  if (isSubmitting.value || isCompleted.value) return
  isSubmitting.value = true
  error.value = ''

  try {
    // 转换操作格式以匹配后端 API
    // 注意：这里我们需要把标签名转换为标签 ID
    // 但后端 batchUpdate 目前只支持 tagId。
    // 所以我们需要先 resolve 标签 ID。
    // 为了简化，我们假设 AI 已经知道 tagId 或者我们在前端做转换。
    // 但 AI 通常只知道标签名。
    // 所以我们需要在这里做一步：getOrCreate tags。

    const resolvedOperations = []
    
    for (const op of operations.value) {
      const addTagIds: number[] = []
      const removeTagIds: number[] = []

      if (op.addTags && op.addTags.length > 0) {
        for (const tagName of op.addTags) {
          const result = await window.tag.getOrCreate(props.projectId, tagName)
          if (result.success) {
            addTagIds.push(result.data.id)
          }
        }
      }

      // 对于移除标签，我们需要找到对应的 ID。
      // 这里稍微麻烦点，因为我们可能没有所有标签的映射。
      // 我们可以先获取所有标签。
      if (op.removeTags && op.removeTags.length > 0) {
        const allTagsResult = await window.tag.getAllUserTags(props.projectId)
        if (allTagsResult.success) {
          const tagMap = new Map(allTagsResult.data.map(t => [t.name, t.id]))
          for (const tagName of op.removeTags) {
            const id = tagMap.get(tagName)
            if (id) removeTagIds.push(id)
          }
        }
      }

      resolvedOperations.push({
        id: op.id,
        content: op.content,
        addTags: addTagIds.length ? addTagIds : undefined,
        removeTags: removeTagIds.length ? removeTagIds : undefined
      })
    }

    const result = await window.card.batchUpdate(props.projectId, resolvedOperations)
    if (result.success) {
      isCompleted.value = true
      emit('confirm', operations.value)
    } else {
      error.value = result.error || '更新失败'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '未知错误'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="proposal-card">
    <div class="proposal-header">
      <div class="proposal-icon">✨</div>
      <div class="proposal-title">整理建议</div>
    </div>
    
    <div class="proposal-reason">{{ data.reason }}</div>

    <div class="proposal-list">
      <div v-for="op in operations" :key="op.id" class="proposal-item">
        <div class="item-header">
          <span class="item-id">#{{ op.id }}</span>
          <span class="item-title">{{ op.title || '未命名卡片' }}</span>
        </div>
        
        <div class="item-changes">
          <div v-if="op.addTags?.length" class="change-row add">
            <span class="change-label">添加标签:</span>
            <span v-for="tag in op.addTags" :key="tag" class="tag-badge add">{{ tag }}</span>
          </div>
          <div v-if="op.removeTags?.length" class="change-row remove">
            <span class="change-label">移除标签:</span>
            <span v-for="tag in op.removeTags" :key="tag" class="tag-badge remove">{{ tag }}</span>
          </div>
          <div v-if="op.content" class="change-row content">
            <span class="change-label">修改内容:</span>
            <span class="content-preview">{{ op.content }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="proposal-error">{{ error }}</div>

    <div class="proposal-actions">
      <template v-if="!isCompleted">
        <button 
          class="btn-cancel" 
          :disabled="isSubmitting"
          @click="$emit('cancel')"
        >
          取消
        </button>
        <button 
          class="btn-confirm" 
          :disabled="isSubmitting"
          @click="handleConfirm"
        >
          {{ isSubmitting ? '执行中...' : '确认修改' }}
        </button>
      </template>
      <div v-else class="success-message">
        ✅ 已完成整理
      </div>
    </div>
  </div>
</template>

<style scoped>
.proposal-card {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px;
  margin: 8px 0;
  box-shadow: var(--shadow-sm);
}

.proposal-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.proposal-title {
  font-weight: 600;
  color: var(--color-primary);
}

.proposal-reason {
  font-size: 13px;
  color: var(--color-text);
  margin-bottom: 16px;
  line-height: 1.5;
}

.proposal-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 16px;
  padding-right: 4px;
}

.proposal-item {
  background: var(--color-bg-soft);
  border-radius: var(--radius-sm);
  padding: 10px;
  font-size: 12px;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  color: var(--color-text-secondary);
}

.item-id {
  font-family: var(--font-mono);
  opacity: 0.7;
}

.item-title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.change-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.change-label {
  color: var(--color-text-muted);
  min-width: 60px;
}

.tag-badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.tag-badge.add {
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-success);
}

.tag-badge.remove {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
  text-decoration: line-through;
}

.content-preview {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.5);
  padding: 2px 4px;
  border-radius: 4px;
}

.proposal-error {
  color: var(--color-error);
  font-size: 12px;
  margin-bottom: 12px;
}

.proposal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-strong);
}

.btn-cancel, .btn-confirm {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.btn-cancel:hover {
  background: var(--color-bg-soft);
}

.btn-confirm {
  background: var(--color-primary);
  border: none;
  color: white;
}

.btn-confirm:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.success-message {
  color: var(--color-success);
  font-weight: 500;
  font-size: 13px;
}
</style>
