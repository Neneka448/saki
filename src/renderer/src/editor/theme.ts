/**
 * 编辑器主题样式
 */

import { EditorView } from '@codemirror/view'

export const editorTheme = EditorView.theme({
  // 根容器
  '&': {
    fontSize: '14px',
    height: '100%',
    backgroundColor: 'transparent',
  },

  // 编辑区域
  '.cm-content': {
    fontFamily: 'var(--font-sans, ui-sans-serif, system-ui)',
    padding: '24px 32px 40px',
    lineHeight: '1.8',
    fontSize: '16px',
    maxWidth: '920px',
    margin: '0 auto',
    caretColor: 'var(--color-primary, #3a6df6)',
  },

  // 聚焦状态
  '&.cm-focused': {
    outline: 'none',
  },

  '&.cm-focused .cm-cursor': {
    borderLeftColor: 'var(--color-primary, #3a6df6)',
  },

  // 滚动容器
  '.cm-scroller': {
    fontFamily: 'inherit',
    overflow: 'auto',
    padding: '4px 0 20px',
    background: 'transparent',
  },

  // 行
  '.cm-line': {
    padding: '0.22rem 0',
  },

  // 选中文本
  '.cm-selectionBackground': {
    background: 'rgba(58, 109, 246, 0.2) !important',
  },

  '&.cm-focused .cm-selectionBackground': {
    background: 'rgba(58, 109, 246, 0.3) !important',
  },

  // 占位符
  '.cm-placeholder': {
    color: 'var(--color-text-muted, #7c8799)',
    fontStyle: 'italic',
  },

  // 卡片引用样式
  '.cm-card-reference': {
    color: 'var(--color-primary, #3a6df6)',
    textDecoration: 'underline',
    textDecorationStyle: 'dotted',
    cursor: 'pointer',
    borderRadius: '2px',
  },

  '.cm-card-reference:hover': {
    background: 'rgba(58, 109, 246, 0.12)',
  },

  // 当前行
  '.cm-activeLine': {
    background: 'linear-gradient(90deg, rgba(58, 109, 246, 0.08), transparent 70%)',
    borderRadius: '6px',
  },

  '.cm-activeLineGutter': {
    color: 'var(--color-text-secondary, #495568)',
  },

  // 隐藏的语法标记
  '.cm-hidden-syntax': {
    display: 'none',
  },

  // 代码块
  '.cm-code': {
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    background: 'var(--color-bg-elevated, #f7f9fd)',
    borderRadius: '6px',
    padding: '0.2em 0.4em',
  },

  // 标题
  '.cm-header-1': {
    fontSize: '1.55em',
    fontWeight: '600',
    letterSpacing: '-0.01em',
  },

  '.cm-header-2': {
    fontSize: '1.32em',
    fontWeight: '600',
    letterSpacing: '-0.01em',
  },

  '.cm-header-3': {
    fontSize: '1.12em',
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

  // Markdown 标记淡化
  '.cm-formatting': {
    color: 'var(--color-text-muted, #7c8799)',
  },

  // 链接
  '.cm-link': {
    color: 'var(--color-primary, #3a6df6)',
  },

  // 图片
  '.cm-image': {
    color: 'var(--color-text-secondary, #495568)',
  },

  // 光标和选区细节
  '.cm-cursor': {
    borderLeftWidth: '2px',
  },

  '.cm-gutters': {
    background: 'transparent',
    borderRight: 'none',
    color: 'var(--color-text-muted, #7c8799)',
  },
}, { dark: false })
