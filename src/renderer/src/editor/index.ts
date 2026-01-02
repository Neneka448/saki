/**
 * CodeMirror 6 编辑器模块
 * 
 * 模块化设计，提供：
 * - 基础编辑器配置
 * - Markdown 语法支持
 * - 引用补全扩展
 * - 标签补全扩展
 * - 实时预览装饰（隐藏语法标记）
 * - 图片粘贴支持
 */

// 核心
export { createEditor, setEditorContent, insertAtCursor, type EditorConfig } from './core'

// 扩展
export { referenceCompletion, type ReferenceCandidate } from './extensions/referenceCompletion'
export { tagCompletion, type TagCandidate } from './extensions/tagCompletion'
export { livePreview } from './extensions/livePreview'
export { imagePaste, type ImagePasteHandler } from './extensions/imagePaste'

// 主题
export { editorTheme } from './theme'

// Vue 组件
export { default as CodeMirrorEditor } from './CodeMirrorEditor.vue'
