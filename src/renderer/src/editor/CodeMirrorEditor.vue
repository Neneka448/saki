<script setup lang="ts">
/**
 * CodeMirror Markdown 编辑器组件
 * 
 * 基于 CodeMirror 6 的模块化编辑器
 * 支持：
 * - Markdown 语法高亮
 * - 卡片引用补全（[[ 触发）
 * - 实时预览（隐藏 ref 注释）
 * - 图片粘贴上传
 */

import { ref, onMounted, onBeforeUnmount, watch, shallowRef } from 'vue'
import { EditorView } from '@codemirror/view'
import { Compartment } from '@codemirror/state'
import type { CardListItem } from '../../../shared/ipc/types'
import { createEditor, setEditorContent } from './core'
import { referenceCompletion, type ReferenceCandidate } from './extensions/referenceCompletion'
import { livePreview } from './extensions/livePreview'
import { imagePaste } from './extensions/imagePaste'

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

const containerRef = ref<HTMLElement | null>(null)
const editorView = shallowRef<EditorView | null>(null)
const isUploading = ref(false)

// 用于动态更新候选列表的 Compartment
const referenceCompartment = new Compartment()

/**
 * 构建引用补全扩展配置
 */
const buildReferenceExtension = () => {
  const candidates: ReferenceCandidate[] = (props.referenceCandidates || []).map((card) => ({
    id: card.id,
    title: card.title,
    summary: card.summary,
  }))
  
  return referenceCompletion({
    candidates,
    currentCardId: props.currentCardId,
  })
}

/**
 * 图片上传处理
 */
const handleImagePaste = async (dataUrl: string) => {
  isUploading.value = true
  try {
    const result = await window.asset.saveImage(dataUrl)
    return result
  } finally {
    isUploading.value = false
  }
}

/**
 * 初始化编辑器
 */
onMounted(() => {
  if (!containerRef.value) return
  
  const view = createEditor(containerRef.value, {
    doc: props.modelValue,
    placeholder: props.placeholder || '开始输入内容...\n\n支持 Markdown 语法，可直接粘贴图片',
    autoFocus: props.autoFocus,
    onChange: (content: string) => {
      emit('update:modelValue', content)
    },
    onSave: () => {
      emit('save')
    },
    extensions: [
      // 实时预览（隐藏 ref 注释）
      livePreview(),
      
      // 图片粘贴
      imagePaste(handleImagePaste),
      
      // 引用补全（使用 Compartment 以便动态更新）
      referenceCompartment.of(buildReferenceExtension()),
    ],
  })
  
  editorView.value = view
})

/**
 * 销毁编辑器
 */
onBeforeUnmount(() => {
  editorView.value?.destroy()
  editorView.value = null
})

/**
 * 监听外部内容变化
 */
watch(() => props.modelValue, (newValue) => {
  if (!editorView.value) return
  
  const currentContent = editorView.value.state.doc.toString()
  if (currentContent !== newValue) {
    setEditorContent(editorView.value, newValue)
  }
})

/**
 * 监听候选列表变化
 */
watch(
  () => [props.referenceCandidates, props.currentCardId],
  () => {
    if (!editorView.value) return
    
    editorView.value.dispatch({
      effects: referenceCompartment.reconfigure(buildReferenceExtension()),
    })
  },
  { deep: true }
)

/**
 * 暴露聚焦方法
 */
defineExpose({
  focus: () => editorView.value?.focus(),
})
</script>

<template>
  <div class="cm-editor-container">
    <div ref="containerRef" class="cm-editor-wrapper"></div>
    
    <!-- 上传指示器 -->
    <div v-if="isUploading" class="cm-editor-container__uploading">
      <span class="cm-editor-container__uploading-spinner"></span>
      <span>正在上传图片...</span>
    </div>
  </div>
</template>

<style scoped>
.cm-editor-container {
  position: relative;
  width: 100%;
  min-height: 200px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-panel);
  overflow: hidden;
}

.cm-editor-container:focus-within {
  border-color: var(--color-primary);
}

.cm-editor-wrapper {
  height: 100%;
}

.cm-editor-wrapper :deep(.cm-editor) {
  height: 100%;
}

.cm-editor-wrapper :deep(.cm-scroller) {
  min-height: 200px;
}

.cm-editor-container__uploading {
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
  z-index: 10;
}

.cm-editor-container__uploading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: cm-spin 0.8s linear infinite;
}

@keyframes cm-spin {
  to { transform: rotate(360deg); }
}
</style>
