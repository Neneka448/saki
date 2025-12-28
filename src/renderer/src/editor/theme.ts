/**
 * 编辑器主题样式
 */

import { EditorView } from '@codemirror/view'

export const editorTheme = EditorView.theme({
  // 根容器
  '&': {
    fontSize: '14px',
    height: '100%',
  },

  // 编辑区域
  '.cm-content': {
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    padding: '16px',
    lineHeight: '1.6',
    caretColor: 'var(--color-primary, #3b82f6)',
  },

  // 聚焦状态
  '&.cm-focused': {
    outline: 'none',
  },

  '&.cm-focused .cm-cursor': {
    borderLeftColor: 'var(--color-primary, #3b82f6)',
  },

  // 滚动容器
  '.cm-scroller': {
    fontFamily: 'inherit',
    overflow: 'auto',
  },

  // 行
  '.cm-line': {
    padding: '0',
  },

  // 选中文本
  '.cm-selectionBackground': {
    background: 'rgba(59, 130, 246, 0.2) !important',
  },

  '&.cm-focused .cm-selectionBackground': {
    background: 'rgba(59, 130, 246, 0.3) !important',
  },

  // 占位符
  '.cm-placeholder': {
    color: 'var(--color-text-muted, #9ca3af)',
    fontStyle: 'italic',
  },

  // 卡片引用样式
  '.cm-card-reference': {
    color: 'var(--color-primary, #3b82f6)',
    textDecoration: 'underline',
    textDecorationStyle: 'dotted',
    cursor: 'pointer',
    borderRadius: '2px',
  },

  '.cm-card-reference:hover': {
    background: 'rgba(59, 130, 246, 0.1)',
  },

  // 隐藏的语法标记
  '.cm-hidden-syntax': {
    display: 'none',
  },

  // 代码块
  '.cm-code': {
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    background: 'var(--color-bg, #f3f4f6)',
    borderRadius: '3px',
    padding: '0.2em 0.4em',
  },

  // 标题
  '.cm-header-1': {
    fontSize: '1.5em',
    fontWeight: '600',
  },

  '.cm-header-2': {
    fontSize: '1.3em',
    fontWeight: '600',
  },

  '.cm-header-3': {
    fontSize: '1.1em',
    fontWeight: '600',
  },

  // 粗体
  '.cm-strong': {
    fontWeight: '600',
  },

  // 斜体
  '.cm-emphasis': {
    fontStyle: 'italic',
  },

  // 链接
  '.cm-link': {
    color: 'var(--color-primary, #3b82f6)',
  },

  // 图片
  '.cm-image': {
    color: 'var(--color-text-secondary, #6b7280)',
  },
}, { dark: false })
