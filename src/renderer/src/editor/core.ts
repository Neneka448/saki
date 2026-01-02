/**
 * 编辑器核心模块
 * 创建和管理 CodeMirror 6 编辑器实例
 */

import { EditorState, Extension, StateEffect, StateField } from '@codemirror/state'
import { EditorView, keymap, placeholder as placeholderExt, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { editorTheme } from './theme'

export interface EditorConfig {
  /** 初始内容 */
  doc?: string
  /** 占位符文本 */
  placeholder?: string
  /** 内容变化回调 */
  onChange?: (content: string) => void
  /** 保存快捷键回调 */
  onSave?: () => void
  /** 额外的扩展 */
  extensions?: Extension[]
  /** 是否自动聚焦 */
  autoFocus?: boolean
}

/**
 * 保存命令的 keymap
 */
const saveKeymap = (onSave?: () => void) => keymap.of([
  {
    key: 'Mod-s',
    run: () => {
      onSave?.()
      return true
    },
  },
])

/**
 * 剪贴板操作 keymap（用于无框架窗口）
 * 通过 Electron 的 clipboard API 实现
 */
const clipboardKeymap = keymap.of([
  {
    key: 'Mod-v',
    run: (view) => {
      // 尝试使用 Electron clipboard API
      if (typeof window !== 'undefined' && (window as any).app?.clipboardReadText) {
        try {
          const text = (window as any).app.clipboardReadText()
          if (text) {
            const { from, to } = view.state.selection.main
            view.dispatch({
              changes: { from, to, insert: text },
              selection: { anchor: from + text.length },
            })
            return true
          }
        } catch (e) {
          console.error('Clipboard read failed:', e)
        }
      }
      // 回退到默认行为
      return false
    },
  },
  {
    key: 'Mod-c',
    run: (view) => {
      if (typeof window !== 'undefined' && (window as any).app?.clipboardWriteText) {
        try {
          const { from, to } = view.state.selection.main
          if (from !== to) {
            const text = view.state.sliceDoc(from, to)
              ; (window as any).app.clipboardWriteText(text)
            return true
          }
        } catch (e) {
          console.error('Clipboard write failed:', e)
        }
      }
      return false
    },
  },
  {
    key: 'Mod-x',
    run: (view) => {
      if (typeof window !== 'undefined' && (window as any).app?.clipboardWriteText) {
        try {
          const { from, to } = view.state.selection.main
          if (from !== to) {
            const text = view.state.sliceDoc(from, to)
              ; (window as any).app.clipboardWriteText(text)
            view.dispatch({
              changes: { from, to, insert: '' },
              selection: { anchor: from },
            })
            return true
          }
        } catch (e) {
          console.error('Clipboard cut failed:', e)
        }
      }
      return false
    },
  },
])

/**
 * 创建内容变化监听器
 */
const createUpdateListener = (onChange?: (content: string) => void) => {
  return EditorView.updateListener.of((update) => {
    if (update.docChanged && onChange) {
      onChange(update.state.doc.toString())
    }
  })
}

/**
 * 创建编辑器实例
 */
export function createEditor(
  parent: HTMLElement,
  config: EditorConfig = {}
): EditorView {
  const {
    doc = '',
    placeholder = '',
    onChange,
    onSave,
    extensions = [],
    autoFocus = false,
  } = config

  const baseExtensions: Extension[] = [
    // 历史记录（撤销/重做）
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),

    // 剪贴板操作（用于无框架窗口）
    clipboardKeymap,

    // Markdown 语法高亮
    markdown({ codeLanguages: languages }),

    // 主题样式
    editorTheme,

    // 行宽自适应，阅读更像文档
    EditorView.lineWrapping,

    // 高亮当前行
    highlightActiveLine(),

    // 占位符
    ...(placeholder ? [placeholderExt(placeholder)] : []),

    // 保存快捷键
    saveKeymap(onSave),

    // 内容变化监听
    createUpdateListener(onChange),

    // 用户自定义扩展
    ...extensions,
  ]

  const state = EditorState.create({
    doc,
    extensions: baseExtensions,
  })

  const view = new EditorView({
    state,
    parent,
  })

  if (autoFocus) {
    view.focus()
  }

  return view
}

/**
 * 更新编辑器内容（外部更新时使用）
 */
export function setEditorContent(view: EditorView, content: string): void {
  const currentContent = view.state.doc.toString()
  if (currentContent === content) return

  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: content,
    },
  })
}

/**
 * 在光标位置插入文本
 */
export function insertAtCursor(view: EditorView, text: string): void {
  const { from } = view.state.selection.main
  view.dispatch({
    changes: { from, insert: text },
    selection: { anchor: from + text.length },
  })
  view.focus()
}

/**
 * 获取光标位置
 */
export function getCursorPosition(view: EditorView): number {
  return view.state.selection.main.head
}

/**
 * 设置光标位置
 */
export function setCursorPosition(view: EditorView, pos: number): void {
  view.dispatch({
    selection: { anchor: pos },
  })
  view.focus()
}
