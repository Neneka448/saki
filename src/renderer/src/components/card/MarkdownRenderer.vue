<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{
  content: string
  referenceMap?: Record<string, { cardId: number; title: string | null; content: string; displayText: string }>
}>()

const emit = defineEmits<{
  'reference-click': [cardId: number]
}>()

const containerRef = ref<HTMLElement | null>(null)
const hoveredRefId = ref<string | null>(null)
const hoveredRect = ref<DOMRect | null>(null)
const hoverHideTimer = ref<number | null>(null)

const activeReference = computed(() => {
  if (!hoveredRefId.value || !props.referenceMap) return null
  return props.referenceMap[hoveredRefId.value] || null
})

const tooltipStyle = computed(() => {
  if (!hoveredRect.value) return undefined
  const width = Math.min(420, hoveredRect.value.width)
  return {
    top: `${hoveredRect.value.bottom + 8}px`,
    left: `${hoveredRect.value.left}px`,
    width: `${width}px`,
  }
})

// 简单的 Markdown 解析（后续可替换为更完整的库）
const renderMarkdown = (
  raw: string,
  referenceMap?: Record<string, { cardId: number; title: string | null; content: string; displayText: string }>
) => {
  let html = raw

  // 转义 HTML
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // 代码块 (```code```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`
  })

  // 行内代码 (`code`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // 卡片引用 [[title]](placeholder)<!--ref:RID-->
  html = html.replace(/\[\[([^\]]+)\]\]\(([^)]*)\)<!--ref:([a-zA-Z0-9_-]+)-->/g, (_, title, placeholder, refId) => {
    const map = referenceMap || {}
    const ref = map[refId]
    if (!ref) {
      return `[[${title}]](${placeholder})`
    }
    const display = String(placeholder || '').trim() || ref.displayText
    return `<span class="md-card-ref" data-ref-id="${refId}" data-card-id="${ref.cardId}">${display}</span>`
  })

  // 图片 ![alt](url) - asset:// 协议由主进程处理
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    return `<img src="${url}" alt="${alt}" class="md-image" />`
  })

  // 链接 [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')

  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // 粗体
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>')

  // 斜体
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>')

  // 删除线
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>')

  // 引用块
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

  // 无序列表
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')

  // 有序列表
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

  // 分隔线
  html = html.replace(/^---$/gm, '<hr />')

  // 段落（两个换行）
  html = html.replace(/\n\n/g, '</p><p>')
  
  // 单换行变成 <br>
  html = html.replace(/\n/g, '<br />')

  // 包裹段落
  if (!html.startsWith('<')) {
    html = `<p>${html}</p>`
  }

  return html
}

const renderedHtml = computed(() => renderMarkdown(props.content, props.referenceMap))

const tooltipHtml = computed(() => {
  if (!activeReference.value) return ''
  return renderMarkdown(activeReference.value.content)
})

const clearHoverTimer = () => {
  if (hoverHideTimer.value !== null) {
    window.clearTimeout(hoverHideTimer.value)
    hoverHideTimer.value = null
  }
}

const scheduleHide = () => {
  clearHoverTimer()
  hoverHideTimer.value = window.setTimeout(() => {
    hoveredRefId.value = null
    hoveredRect.value = null
  }, 500)
}

const handleMouseOver = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  const refEl = target?.closest('.md-card-ref') as HTMLElement | null
  if (!refEl) return
  const refId = refEl.dataset.refId
  if (!refId) return
  clearHoverTimer()
  hoveredRefId.value = refId
  hoveredRect.value = refEl.getBoundingClientRect()
}

const handleMouseOut = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  const refEl = target?.closest('.md-card-ref') as HTMLElement | null
  if (!refEl) return
  scheduleHide()
}

const handleClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  const refEl = target?.closest('.md-card-ref') as HTMLElement | null
  if (!refEl) return
  const cardId = Number(refEl.dataset.cardId)
  if (cardId) {
    emit('reference-click', cardId)
  }
}

onMounted(() => {
  const el = containerRef.value
  if (!el) return
  el.addEventListener('mouseover', handleMouseOver)
  el.addEventListener('mouseout', handleMouseOut)
  el.addEventListener('click', handleClick)
})

onBeforeUnmount(() => {
  const el = containerRef.value
  if (!el) return
  el.removeEventListener('mouseover', handleMouseOver)
  el.removeEventListener('mouseout', handleMouseOut)
  el.removeEventListener('click', handleClick)
})
</script>

<template>
  <div ref="containerRef" class="markdown-renderer" v-html="renderedHtml" />
  <Teleport to="body">
    <div
      v-if="activeReference && tooltipStyle"
      class="markdown-renderer__tooltip"
      :style="tooltipStyle"
      @mouseenter="clearHoverTimer"
      @mouseleave="scheduleHide"
    >
      <div class="markdown-renderer__tooltip-title">{{ activeReference.title || '无标题' }}</div>
      <div class="markdown-renderer markdown-renderer__tooltip-content" v-html="tooltipHtml"></div>
    </div>
  </Teleport>
</template>

<style scoped>
.markdown-renderer {
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-text);
}

.markdown-renderer :deep(h1) {
  font-size: 1.5em;
  font-weight: 600;
  margin: 0.5em 0;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--color-border);
}

.markdown-renderer :deep(h2) {
  font-size: 1.3em;
  font-weight: 600;
  margin: 0.5em 0;
}

.markdown-renderer :deep(h3) {
  font-size: 1.1em;
  font-weight: 600;
  margin: 0.5em 0;
}

.markdown-renderer :deep(p) {
  margin: 0.5em 0;
}

.markdown-renderer :deep(a) {
  color: var(--color-primary);
  text-decoration: none;
}

.markdown-renderer :deep(a:hover) {
  text-decoration: underline;
}

.markdown-renderer :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  padding: 0.2em 0.4em;
  background: var(--color-bg);
  border-radius: 3px;
}

.markdown-renderer :deep(pre) {
  margin: 0.5em 0;
  padding: 12px 16px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
  overflow-x: auto;
}

.markdown-renderer :deep(pre code) {
  padding: 0;
  background: none;
}

.markdown-renderer :deep(blockquote) {
  margin: 0.5em 0;
  padding: 0.5em 1em;
  border-left: 3px solid var(--color-primary);
  background: var(--color-bg);
  color: var(--color-text-secondary);
}

.markdown-renderer :deep(ul),
.markdown-renderer :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.markdown-renderer :deep(li) {
  margin: 0.25em 0;
}

.markdown-renderer :deep(hr) {
  margin: 1em 0;
  border: none;
  border-top: 1px solid var(--color-border);
}

.markdown-renderer :deep(.md-image) {
  max-width: 100%;
  border-radius: var(--radius-md);
  margin: 0.5em 0;
}

.markdown-renderer :deep(strong) {
  font-weight: 600;
}

.markdown-renderer :deep(del) {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.markdown-renderer :deep(.md-card-ref) {
  color: var(--color-primary);
  cursor: pointer;
  border-bottom: 1px dashed rgba(59, 130, 246, 0.5);
}

.markdown-renderer__tooltip {
  position: fixed;
  padding: 12px;
  border-radius: var(--radius-md);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  z-index: 999;
}

.markdown-renderer__tooltip-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 6px;
}

.markdown-renderer__tooltip-content {
  font-size: 12px;
  color: var(--color-text-secondary);
  max-height: 240px;
  overflow-y: auto;
}

.markdown-renderer__tooltip-content :deep(p) {
  margin: 0.4em 0;
}
</style>
