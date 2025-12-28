/**
 * 卡片引用补全扩展
 * 
 * 功能：
 * - 检测 [[ 触发器
 * - 显示候选卡片列表
 * - 插入引用语法 [[title]]()<!--ref:id-->
 */

import {
  Extension,
  StateField,
  StateEffect,
  EditorState,
  Facet,
  Prec,
} from '@codemirror/state'
import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  WidgetType,
  keymap,
} from '@codemirror/view'
import { createReferenceId } from '../../utils/referenceUtils'

export interface ReferenceCandidate {
  id: number
  title: string | null
  summary: string | null
}

interface CompletionState {
  active: boolean
  triggerPos: number
  query: string
  selectedIndex: number
}

// ============ Facets ============

/**
 * 候选卡片列表的 Facet
 */
export const referenceCandidates = Facet.define<ReferenceCandidate[], ReferenceCandidate[]>({
  combine: (values) => values.flat(),
})

/**
 * 当前卡片 ID 的 Facet（用于过滤自引用）
 */
export const currentCardId = Facet.define<number | undefined, number | undefined>({
  combine: (values) => values[0],
})

/**
 * 引用插入回调的 Facet
 */
export const onReferenceInsert = Facet.define<
  ((card: ReferenceCandidate, refId: string) => void) | undefined,
  ((card: ReferenceCandidate, refId: string) => void) | undefined
>({
  combine: (values) => values[0],
})

// ============ State Effects ============

const setCompletionState = StateEffect.define<Partial<CompletionState>>()
const closeCompletion = StateEffect.define<null>()

// ============ State Field ============

const completionStateField = StateField.define<CompletionState>({
  create() {
    return {
      active: false,
      triggerPos: 0,
      query: '',
      selectedIndex: 0,
    }
  },

  update(state, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setCompletionState)) {
        return { ...state, ...effect.value }
      }
      if (effect.is(closeCompletion)) {
        return { ...state, active: false, query: '', selectedIndex: 0 }
      }
    }
    return state
  },
})

// ============ 补全逻辑 ============

/**
 * 检测 [[ 触发器
 */
function detectTrigger(state: EditorState): { triggerPos: number; query: string } | null {
  const { head } = state.selection.main
  const line = state.doc.lineAt(head)
  const textBefore = state.sliceDoc(line.from, head)

  const triggerMatch = textBefore.lastIndexOf('[[')
  if (triggerMatch === -1) return null

  // 检查是否已闭合
  const afterTrigger = textBefore.slice(triggerMatch)
  if (afterTrigger.includes(']]')) return null

  const query = afterTrigger.slice(2) // 去掉 [[
  if (query.includes('\n')) return null

  return {
    triggerPos: line.from + triggerMatch,
    query,
  }
}

/**
 * 过滤候选项
 */
function filterCandidates(
  candidates: ReferenceCandidate[],
  query: string,
  excludeId?: number
): ReferenceCandidate[] {
  const lowerQuery = query.toLowerCase().trim()

  return candidates
    .filter((card) => {
      if (excludeId && card.id === excludeId) return false
      if (!card.title) return false

      const title = card.title.toLowerCase()
      const summary = (card.summary || '').toLowerCase()

      if (!lowerQuery) return true
      return title.includes(lowerQuery) || summary.includes(lowerQuery)
    })
    .slice(0, 8)
}

/**
 * 插入引用
 */
function insertReference(view: EditorView, card: ReferenceCandidate, triggerPos: number): void {
  const title = card.title || '无标题'
  const refId = createReferenceId()
  const referenceText = `[[${title}]]()<!--ref:${refId}-->`

  const { head } = view.state.selection.main

  view.dispatch({
    changes: {
      from: triggerPos,
      to: head,
      insert: referenceText,
    },
    selection: {
      // 光标放在 ]( 之间，方便用户输入显示文本
      anchor: triggerPos + `[[${title}]](`.length,
    },
    effects: closeCompletion.of(null),
  })

  // 触发回调
  const callback = view.state.facet(onReferenceInsert)
  callback?.(card, refId)

  view.focus()
}

// ============ 补全下拉框 Widget ============

class CompletionDropdown {
  private dom: HTMLElement | null = null
  private view: EditorView
  private pendingRender: {
    candidates: ReferenceCandidate[]
    selectedIndex: number
    triggerPos: number
  } | null = null

  constructor(view: EditorView) {
    this.view = view
  }

  update(state: CompletionState, candidates: ReferenceCandidate[], excludeId?: number): void {
    if (!state.active) {
      this.destroy()
      return
    }

    const filtered = filterCandidates(candidates, state.query, excludeId)
    if (filtered.length === 0) {
      this.destroy()
      return
    }

    // 保存渲染参数，使用 requestMeasure 延迟到测量阶段
    this.pendingRender = {
      candidates: filtered,
      selectedIndex: state.selectedIndex,
      triggerPos: state.triggerPos,
    }

    this.view.requestMeasure({
      read: () => {
        if (!this.pendingRender) return null
        const coords = this.view.coordsAtPos(this.pendingRender.triggerPos)
        return coords
      },
      write: (coords) => {
        if (!this.pendingRender) return
        this.render(
          this.pendingRender.candidates,
          this.pendingRender.selectedIndex,
          coords
        )
        this.pendingRender = null
      },
    })
  }

  private render(
    candidates: ReferenceCandidate[],
    selectedIndex: number,
    coords: { top: number; bottom: number; left: number; right: number } | null
  ): void {
    if (!this.dom) {
      this.dom = document.createElement('div')
      this.dom.className = 'cm-reference-dropdown'
      document.body.appendChild(this.dom)
    }

    // 计算位置
    if (coords) {
      this.dom.style.position = 'fixed'
      this.dom.style.top = `${coords.bottom + 4}px`
      this.dom.style.left = `${coords.left}px`
    }

    // 渲染内容
    this.dom.innerHTML = `
      <div class="cm-reference-dropdown__title">引用卡片</div>
      ${candidates.map((card, index) => `
        <button 
          class="cm-reference-dropdown__item ${index === selectedIndex ? 'cm-reference-dropdown__item--active' : ''}"
          data-index="${index}"
        >
          <span class="cm-reference-dropdown__name">${card.title || '无标题'}</span>
          ${card.summary ? `<span class="cm-reference-dropdown__summary">${card.summary}</span>` : ''}
        </button>
      `).join('')}
    `

    // 绑定点击事件
    const view = this.view
    this.dom.querySelectorAll('.cm-reference-dropdown__item').forEach((item) => {
      item.addEventListener('click', () => {
        const index = parseInt((item as HTMLElement).dataset.index || '0', 10)
        const card = candidates[index]
        if (card) {
          const state = view.state.field(completionStateField)
          insertReference(view, card, state.triggerPos)
        }
      })
    })
  }

  destroy(): void {
    this.pendingRender = null
    if (this.dom) {
      this.dom.remove()
      this.dom = null
    }
  }
}

// ============ View Plugin ============

const completionPlugin = ViewPlugin.fromClass(
  class {
    dropdown: CompletionDropdown
    pendingUpdate: number | null = null

    constructor(view: EditorView) {
      this.dropdown = new CompletionDropdown(view)
    }

    update(update: ViewUpdate): void {
      const { state, view } = update

      // 检查是否有插入操作（不只是删除）
      let hasInsertion = false
      if (update.docChanged) {
        update.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
          if (inserted.length > 0) {
            hasInsertion = true
          }
        })
      }

      // 检测触发器 - 使用 requestAnimationFrame 延迟 dispatch
      // 只有在有插入操作或选区变化时才检测触发器
      if (hasInsertion || update.selectionSet) {
        // 取消之前的延迟更新
        if (this.pendingUpdate !== null) {
          cancelAnimationFrame(this.pendingUpdate)
        }

        this.pendingUpdate = requestAnimationFrame(() => {
          this.pendingUpdate = null
          const trigger = detectTrigger(view.state)

          if (trigger) {
            view.dispatch({
              effects: setCompletionState.of({
                active: true,
                triggerPos: trigger.triggerPos,
                query: trigger.query,
                selectedIndex: 0,
              }),
            })
          } else {
            const currentState = view.state.field(completionStateField)
            if (currentState.active) {
              view.dispatch({
                effects: closeCompletion.of(null),
              })
            }
          }

          // 更新下拉框
          const completionState = view.state.field(completionStateField)
          const candidates = view.state.facet(referenceCandidates)
          const excludeId = view.state.facet(currentCardId)
          this.dropdown.update(completionState, candidates, excludeId)
        })
      } else if (update.docChanged) {
        // 删除操作：如果当前有补全激活，检查触发器是否还有效
        if (this.pendingUpdate !== null) {
          cancelAnimationFrame(this.pendingUpdate)
        }

        this.pendingUpdate = requestAnimationFrame(() => {
          this.pendingUpdate = null
          const currentState = view.state.field(completionStateField)
          if (currentState.active) {
            const trigger = detectTrigger(view.state)
            if (!trigger) {
              view.dispatch({
                effects: closeCompletion.of(null),
              })
            }
          }

          // 更新下拉框
          const completionState = view.state.field(completionStateField)
          const candidates = view.state.facet(referenceCandidates)
          const excludeId = view.state.facet(currentCardId)
          this.dropdown.update(completionState, candidates, excludeId)
        })
      } else {
        // 直接更新下拉框（不涉及 dispatch）
        const completionState = state.field(completionStateField)
        const candidates = state.facet(referenceCandidates)
        const excludeId = state.facet(currentCardId)
        this.dropdown.update(completionState, candidates, excludeId)
      }
    }

    destroy(): void {
      if (this.pendingUpdate !== null) {
        cancelAnimationFrame(this.pendingUpdate)
      }
      this.dropdown.destroy()
    }
  }
)

// ============ 键盘处理 ============

// 使用高优先级键盘处理，确保在补全激活时拦截按键
const completionKeymap = Prec.highest(
  keymap.of([
    {
      key: 'ArrowDown',
      run(view) {
        const state = view.state.field(completionStateField)
        if (!state.active) return false

        const candidates = view.state.facet(referenceCandidates)
        const excludeId = view.state.facet(currentCardId)
        const filtered = filterCandidates(candidates, state.query, excludeId)

        if (filtered.length === 0) return false

        const newIndex = Math.min(state.selectedIndex + 1, filtered.length - 1)
        view.dispatch({
          effects: setCompletionState.of({ selectedIndex: newIndex }),
        })
        return true
      },
    },
    {
      key: 'ArrowUp',
      run(view) {
        const state = view.state.field(completionStateField)
        if (!state.active) return false

        const candidates = view.state.facet(referenceCandidates)
        const excludeId = view.state.facet(currentCardId)
        const filtered = filterCandidates(candidates, state.query, excludeId)

        if (filtered.length === 0) return false

        const newIndex = Math.max(state.selectedIndex - 1, 0)
        view.dispatch({
          effects: setCompletionState.of({ selectedIndex: newIndex }),
        })
        return true
      },
    },
    {
      key: 'Enter',
      run(view) {
        const state = view.state.field(completionStateField)
        if (!state.active) return false

        const candidates = view.state.facet(referenceCandidates)
        const excludeId = view.state.facet(currentCardId)
        const filtered = filterCandidates(candidates, state.query, excludeId)

        if (filtered.length === 0) return false

        // 选中当前高亮项（默认是第一个）
        const card = filtered[state.selectedIndex]
        if (card) {
          insertReference(view, card, state.triggerPos)
        }
        return true
      },
    },
    {
      key: 'Tab',
      run(view) {
        const state = view.state.field(completionStateField)
        if (!state.active) return false

        const candidates = view.state.facet(referenceCandidates)
        const excludeId = view.state.facet(currentCardId)
        const filtered = filterCandidates(candidates, state.query, excludeId)

        if (filtered.length === 0) return false

        // Tab 也可以选中
        const card = filtered[state.selectedIndex]
        if (card) {
          insertReference(view, card, state.triggerPos)
        }
        return true
      },
    },
    {
      key: 'Escape',
      run(view) {
        const state = view.state.field(completionStateField)
        if (!state.active) return false

        view.dispatch({
          effects: closeCompletion.of(null),
        })
        return true
      },
    },
  ])
)

// ============ 导出扩展 ============

/**
 * 创建引用补全扩展
 */
export function referenceCompletion(config: {
  candidates: ReferenceCandidate[]
  currentCardId?: number
  onInsert?: (card: ReferenceCandidate, refId: string) => void
}): Extension {
  return [
    completionStateField,
    referenceCandidates.of(config.candidates),
    currentCardId.of(config.currentCardId),
    onReferenceInsert.of(config.onInsert),
    completionKeymap,
    completionPlugin,
  ]
}
