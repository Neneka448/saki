/**
 * 图片粘贴扩展
 * 
 * 功能：
 * - 拦截粘贴事件
 * - 处理图片上传
 * - 插入 Markdown 图片语法
 */

import { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export type ImagePasteHandler = (dataUrl: string) => Promise<{ success: boolean; fileName?: string; error?: string }>

/**
 * 读取文件为 Data URL
 */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 在光标位置插入图片 Markdown
 */
function insertImageMarkdown(view: EditorView, fileName: string): void {
  const { from } = view.state.selection.main
  const imageMarkdown = `![image](asset://${fileName})`

  view.dispatch({
    changes: { from, insert: imageMarkdown },
    selection: { anchor: from + imageMarkdown.length },
  })
  view.focus()
}

/**
 * 创建图片粘贴扩展
 */
export function imagePaste(handler: ImagePasteHandler): Extension {
  return EditorView.domEventHandlers({
    paste: async (event, view) => {
      const items = event.clipboardData?.items
      if (!items) return false

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault()

          const file = item.getAsFile()
          if (!file) return true

          try {
            const dataUrl = await readFileAsDataUrl(file)
            const result = await handler(dataUrl)

            if (result.success && result.fileName) {
              insertImageMarkdown(view, result.fileName)
            } else {
              console.error('Failed to save image:', result.error)
            }
          } catch (error) {
            console.error('Error handling image paste:', error)
          }

          return true
        }
      }

      return false
    },
  })
}
