/**
 * 实时预览扩展
 * 
 * 使用 CodeMirror 原生的 atomicRanges 机制实现引用块的原子行为：
 * - 完整引用 [[title]](placeholder)<!--ref:xxx--> 渲染为 Widget，作为原子单位
 * - 光标移动时跳过整个引用块
 * - 删除时整体删除
 */

import {
  Extension,
  RangeSetBuilder,
} from '@codemirror/state'
import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
  ViewPlugin,
  ViewUpdate,
  MatchDecorator,
} from '@codemirror/view'

// 匹配完整的卡片引用：[[title]](placeholder)<!--ref:xxx-->
const REFERENCE_REGEX = /\[\[([^\]]+)\]\]\(([^)]*)\)<!--ref:([a-zA-Z0-9_-]+)-->/g

/**
 * 引用块 Widget
 */
class ReferenceWidget extends WidgetType {
  constructor(
    private title: string,
    private placeholder: string,
    private refId: string
  ) {
    super()
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-reference-block'
    span.setAttribute('data-ref-id', this.refId)

    // 显示内容：placeholder 优先，否则用 title
    const displayText = this.placeholder.trim() || this.title
    span.textContent = `📎 ${displayText}`

    return span
  }

  ignoreEvent(): boolean {
    return false
  }

  eq(other: ReferenceWidget): boolean {
    return (
      this.title === other.title &&
      this.placeholder === other.placeholder &&
      this.refId === other.refId
    )
  }
}

/**
 * 使用 MatchDecorator 创建引用装饰
 */
const referenceMatcher = new MatchDecorator({
  regexp: REFERENCE_REGEX,
  decoration: (match) => {
    const title = match[1]
    const placeholder = match[2]
    const refId = match[3]
    return Decoration.replace({
      widget: new ReferenceWidget(title, placeholder, refId),
    })
  },
})

/**
 * View Plugin：管理引用装饰并提供原子范围
 */
const referencePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = referenceMatcher.createDeco(view)
    }

    update(update: ViewUpdate) {
      this.decorations = referenceMatcher.updateDeco(update, this.decorations)
    }
  },
  {
    decorations: (instance) => instance.decorations,
    // 关键：将装饰范围作为原子范围，光标会跳过它们
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => {
        return view.plugin(plugin)?.decorations || Decoration.none
      }),
  }
)

/**
 * 实时预览扩展
 * - 完整引用渲染为 Widget 块
 * - 使用 atomicRanges 实现原子行为（光标跳过、整体删除）
 */
export function livePreview(): Extension {
  return [referencePlugin]
}
