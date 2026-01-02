<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/common'

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
  const width = Math.min(420, Math.max(240, hoveredRect.value.width))
  return {
    top: `${hoveredRect.value.bottom + 8}px`,
    left: `${hoveredRect.value.left}px`,
    width: `${width}px`,
  }
})

const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight: (code, language) => {
    const lang = String(language || '').trim()
    if (lang && hljs.getLanguage(lang)) {
      const highlighted = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
      return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`
    }
    return `<pre><code class="hljs">${escapeHtml(code)}</code></pre>`
  },
})

md.renderer.rules.fence = (tokens, idx, options) => {
  const token = tokens[idx]
  const info = token.info ? token.info.trim() : ''
  const lang = info ? info.split(/\s+/)[0] : ''
  const code = token.content
  let highlighted = ''
  if (options.highlight) {
    highlighted = options.highlight(code, lang, info) as string
  }
  if (!highlighted) {
    const safe = escapeHtml(code)
    const className = lang ? `hljs language-${lang}` : 'hljs'
    highlighted = `<pre><code class="${className}">${safe}</code></pre>`
  }
  const label = lang ? `<span class="md-code-label">${escapeHtml(lang)}</span>` : ''
  return `<div class="md-code-block">${label}${highlighted}</div>`
}

md.renderer.rules.code_block = (tokens, idx) => {
  const code = tokens[idx].content
  const safe = escapeHtml(code)
  return `<div class="md-code-block"><pre><code class="hljs">${safe}</code></pre></div>`
}

const referencePattern = /\[\[([^\]]+)\]\]\(([^)]*)\)<!--ref:([a-zA-Z0-9_-]+)-->/y

md.inline.ruler.before('link', 'card_ref', (state, silent) => {
  const pos = state.pos
  if (state.src.charCodeAt(pos) !== 0x5b || state.src.charCodeAt(pos + 1) !== 0x5b) {
    return false
  }
  referencePattern.lastIndex = pos
  const match = referencePattern.exec(state.src)
  if (!match) return false
  if (!silent) {
    const token = state.push('card_ref', '', 0)
    token.meta = {
      title: match[1],
      placeholder: match[2],
      refId: match[3],
    }
  }
  state.pos += match[0].length
  return true
})

md.renderer.rules.card_ref = (tokens, idx, _options, env) => {
  const meta = tokens[idx].meta as { title: string; placeholder: string; refId: string }
  const map = (env?.referenceMap as Record<string, { cardId: number; displayText: string }> | undefined) || {}
  const ref = map[meta.refId]
  const placeholder = String(meta.placeholder || '').trim()
  const display = placeholder || ref?.displayText || String(meta.title || '').trim()
  const safeDisplay = escapeHtml(display)
  if (!ref) {
    return `<span class="md-card-ref md-card-ref--unresolved">${safeDisplay}</span>`
  }
  const safeRefId = escapeHtml(meta.refId)
  return `<span class="md-card-ref" data-ref-id="${safeRefId}" data-card-id="${ref.cardId}">${safeDisplay}</span>`
}

// 标签规则：#tagName（不以数字开头，# 后紧跟非空白字符）
const tagPattern = /(?:^|[\s])#([^\s#\[\](){}]+)/y

md.inline.ruler.before('link', 'inline_tag', (state, silent) => {
  const pos = state.pos
  // 检查是否在行首或前面是空白
  if (pos > 0) {
    const charBefore = state.src.charCodeAt(pos - 1)
    // 空格(32)、换行(10)、回车(13)、制表符(9)
    if (charBefore !== 32 && charBefore !== 10 && charBefore !== 13 && charBefore !== 9) {
      return false
    }
  }
  // 检查是否以 # 开头
  if (state.src.charCodeAt(pos) !== 0x23) return false
  // 检查 # 后面是否是空格（Markdown 标题）
  if (state.src.charCodeAt(pos + 1) === 0x20) return false
  // 检查是否以数字开头
  const nextChar = state.src.charCodeAt(pos + 1)
  if (nextChar >= 0x30 && nextChar <= 0x39) return false // 0-9
  
  // 匹配标签内容
  const remaining = state.src.slice(pos + 1)
  const match = remaining.match(/^([^\s#\[\](){}]+)/)
  if (!match) return false
  
  if (!silent) {
    const token = state.push('inline_tag', '', 0)
    token.meta = { name: match[1] }
  }
  state.pos += 1 + match[1].length
  return true
})

md.renderer.rules.inline_tag = (tokens, idx) => {
  const meta = tokens[idx].meta as { name: string }
  const safeName = escapeHtml(meta.name)
  return `<span class="md-tag">#${safeName}</span>`
}

md.renderer.rules.image = (tokens, idx, options, _env, self) => {
  const token = tokens[idx]
  const classIndex = token.attrIndex('class')
  if (classIndex < 0) {
    token.attrPush(['class', 'md-image'])
  } else if (token.attrs) {
    token.attrs[classIndex][1] = `${token.attrs[classIndex][1]} md-image`
  }
  return self.renderToken(tokens, idx, options)
}

md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx]
  const targetIndex = token.attrIndex('target')
  if (targetIndex < 0) {
    token.attrPush(['target', '_blank'])
  } else if (token.attrs) {
    token.attrs[targetIndex][1] = '_blank'
  }
  const relIndex = token.attrIndex('rel')
  if (relIndex < 0) {
    token.attrPush(['rel', 'noopener noreferrer'])
  } else if (token.attrs) {
    token.attrs[relIndex][1] = 'noopener noreferrer'
  }
  return self.renderToken(tokens, idx, options)
}

const renderMarkdown = (
  raw: string,
  referenceMap?: Record<string, { cardId: number; title: string | null; content: string; displayText: string }>
) => {
  return md.render(raw || '', { referenceMap })
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
  line-height: 1.75;
  color: var(--color-text);
}

.markdown-renderer :deep(h1) {
  font-size: 1.55em;
  font-weight: 600;
  margin: 0.7em 0 0.5em;
  padding-bottom: 0.4em;
  border-bottom: 1px solid var(--color-border-strong);
}

.markdown-renderer :deep(h2) {
  font-size: 1.32em;
  font-weight: 600;
  margin: 0.65em 0 0.4em;
}

.markdown-renderer :deep(h3) {
  font-size: 1.12em;
  font-weight: 600;
  margin: 0.55em 0 0.35em;
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
  text-underline-offset: 2px;
}

.markdown-renderer :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  padding: 0.2em 0.4em;
  background: var(--color-bg-soft);
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.markdown-renderer :deep(pre) {
  margin: 0;
  padding: 12px 16px;
  background: #282c34;
  border: 1px solid rgba(171, 178, 191, 0.18);
  border-radius: var(--radius-md);
  overflow-x: auto;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.18);
}

.markdown-renderer :deep(pre code) {
  padding: 0;
  background: none;
  border: none;
}

.markdown-renderer :deep(.md-code-block) {
  position: relative;
  margin: 0.6em 0;
}

.markdown-renderer :deep(.md-code-block pre) {
  padding-top: 28px;
}

.markdown-renderer :deep(.md-code-label) {
  position: absolute;
  top: 8px;
  right: 12px;
  padding: 2px 8px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #cbd5f5;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  font-weight: 600;
}

.markdown-renderer :deep(pre code.hljs) {
  display: block;
  overflow-x: auto;
  color: #abb2bf;
}

.markdown-renderer :deep(.hljs) {
  color: #abb2bf;
  background: transparent;
}

.markdown-renderer :deep(.hljs-comment),
.markdown-renderer :deep(.hljs-quote) {
  color: #5c6370;
  font-style: italic;
}

.markdown-renderer :deep(.hljs-doctag),
.markdown-renderer :deep(.hljs-keyword),
.markdown-renderer :deep(.hljs-formula) {
  color: #c678dd;
}

.markdown-renderer :deep(.hljs-section),
.markdown-renderer :deep(.hljs-name),
.markdown-renderer :deep(.hljs-selector-tag),
.markdown-renderer :deep(.hljs-deletion),
.markdown-renderer :deep(.hljs-subst) {
  color: #e06c75;
}

.markdown-renderer :deep(.hljs-literal) {
  color: #56b6c2;
}

.markdown-renderer :deep(.hljs-string),
.markdown-renderer :deep(.hljs-regexp),
.markdown-renderer :deep(.hljs-addition),
.markdown-renderer :deep(.hljs-attribute),
.markdown-renderer :deep(.hljs-meta .hljs-string) {
  color: #98c379;
}

.markdown-renderer :deep(.hljs-attr),
.markdown-renderer :deep(.hljs-variable),
.markdown-renderer :deep(.hljs-template-variable),
.markdown-renderer :deep(.hljs-type),
.markdown-renderer :deep(.hljs-selector-class),
.markdown-renderer :deep(.hljs-selector-attr),
.markdown-renderer :deep(.hljs-selector-pseudo),
.markdown-renderer :deep(.hljs-number) {
  color: #d19a66;
}

.markdown-renderer :deep(.hljs-symbol),
.markdown-renderer :deep(.hljs-bullet),
.markdown-renderer :deep(.hljs-link),
.markdown-renderer :deep(.hljs-meta),
.markdown-renderer :deep(.hljs-selector-id),
.markdown-renderer :deep(.hljs-title) {
  color: #61aeee;
}

.markdown-renderer :deep(.hljs-built_in),
.markdown-renderer :deep(.hljs-title.class_),
.markdown-renderer :deep(.hljs-class .hljs-title) {
  color: #e6c07b;
}

.markdown-renderer :deep(.hljs-emphasis) {
  font-style: italic;
}

.markdown-renderer :deep(.hljs-strong) {
  font-weight: 700;
}

.markdown-renderer :deep(blockquote) {
  margin: 0.5em 0;
  padding: 0.5em 1em;
  border-left: 3px solid var(--color-primary);
  background: linear-gradient(135deg, rgba(58, 109, 246, 0.08), rgba(17, 183, 165, 0.08));
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
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
  border-top: 1px solid var(--color-border-strong);
}

.markdown-renderer :deep(.md-image) {
  max-width: 100%;
  border-radius: var(--radius-md);
  margin: 0.5em 0;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
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
  border: 1px solid rgba(58, 109, 246, 0.35);
  border-radius: 6px;
  padding: 0 4px;
  background: rgba(58, 109, 246, 0.08);
}

.markdown-renderer :deep(.md-tag) {
  color: var(--color-primary);
  font-weight: 500;
  background: linear-gradient(135deg, rgba(58, 109, 246, 0.12), rgba(17, 183, 165, 0.12));
  border-radius: 4px;
  padding: 1px 6px;
}

.markdown-renderer__tooltip {
  position: fixed;
  padding: 12px;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
  z-index: 999;
  backdrop-filter: blur(10px);
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
