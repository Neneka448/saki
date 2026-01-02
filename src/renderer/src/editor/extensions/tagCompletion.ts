/**
 * 标签补全扩展
 * 
 * 功能：
 * - 检测 # 触发器（区分 Markdown 标题）
 * - 显示候选标签列表
 * - 插入标签 #tagName
 * - 在编辑器中高亮标签
 */

import {
    Extension,
    StateField,
    StateEffect,
    EditorState,
    Facet,
    Prec,
    RangeSetBuilder,
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
import { detectTagTrigger, parseTagsFromContent } from '../../utils/tagParseUtils'

export interface TagCandidate {
    id: number
    name: string
    color: string | null
}

interface CompletionState {
    active: boolean
    triggerPos: number
    query: string
    selectedIndex: number
}

// ============ Facets ============

/**
 * 候选标签列表的 Facet
 */
export const tagCandidates = Facet.define<TagCandidate[], TagCandidate[]>({
    combine: (values) => values.flat(),
})

/**
 * 标签插入回调的 Facet
 */
export const onTagInsert = Facet.define<
    ((tag: TagCandidate) => void) | undefined,
    ((tag: TagCandidate) => void) | undefined
>({
    combine: (values) => values[0],
})

/**
 * 新标签创建回调的 Facet
 */
export const onTagCreate = Facet.define<
    ((tagName: string) => void) | undefined,
    ((tagName: string) => void) | undefined
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

// ============ 标签高亮装饰 ============

const tagDecoration = Decoration.mark({ class: 'cm-tag-highlight' })

const tagHighlightField = StateField.define<DecorationSet>({
    create(state) {
        return buildTagDecorations(state)
    },

    update(decorations, tr) {
        if (tr.docChanged) {
            return buildTagDecorations(tr.state)
        }
        return decorations
    },

    provide: (field) => EditorView.decorations.from(field),
})

function buildTagDecorations(state: EditorState): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>()
    const content = state.doc.toString()
    const tags = parseTagsFromContent(content)

    for (const tag of tags) {
        builder.add(tag.start, tag.end, tagDecoration)
    }

    return builder.finish()
}

// ============ 补全逻辑 ============

/**
 * 补全选项类型
 */
interface CompletionOption {
    /** 显示文本 */
    label: string
    /** 完整路径 */
    fullPath: string
    /** 是否为真实标签 */
    isTag: boolean
    /** 如果是真实标签，对应的 TagCandidate */
    tag?: TagCandidate
    /** 深度（用于缩进显示） */
    depth: number
    /** 是否为创建选项 */
    isCreate?: boolean
}

/**
 * 构建补全选项（包含虚拟父节点）
 */
function buildCompletionOptions(candidates: TagCandidate[], query: string): CompletionOption[] {
    const lowerQuery = query.toLowerCase().trim()
    const options: CompletionOption[] = []
    const seenPaths = new Set<string>()

    // 过滤匹配的标签
    const matchedTags = candidates.filter((tag) => {
        if (!lowerQuery) return true
        return tag.name.toLowerCase().includes(lowerQuery)
    })

    // 按路径排序
    matchedTags.sort((a, b) => a.name.localeCompare(b.name))

    for (const tag of matchedTags) {
        const parts = tag.name.split('/')
        let currentPath = ''

        // 添加路径上的虚拟父节点
        for (let i = 0; i < parts.length - 1; i++) {
            currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i]

            // 检查这个路径是否匹配查询
            if (lowerQuery && !currentPath.toLowerCase().includes(lowerQuery)) {
                continue
            }

            if (!seenPaths.has(currentPath)) {
                seenPaths.add(currentPath)
                // 检查是否有对应的真实标签
                const realTag = candidates.find(c => c.name === currentPath)
                options.push({
                    label: parts[i],
                    fullPath: currentPath,
                    isTag: Boolean(realTag),
                    tag: realTag,
                    depth: i,
                })
            }
        }

        // 添加叶子节点（真实标签）
        if (!seenPaths.has(tag.name)) {
            seenPaths.add(tag.name)
            options.push({
                label: parts[parts.length - 1],
                fullPath: tag.name,
                isTag: true,
                tag,
                depth: parts.length - 1,
            })
        }
    }

    // 按完整路径排序
    options.sort((a, b) => a.fullPath.localeCompare(b.fullPath))

    // 限制显示数量
    return options.slice(0, 12)
}

/**
 * 检查查询是否完全匹配某个选项
 */
function hasExactMatch(options: CompletionOption[], query: string): boolean {
    const lowerQuery = query.toLowerCase()
    return options.some(opt => opt.fullPath.toLowerCase() === lowerQuery)
}

/**
 * 插入标签（Enter 键 - 完成并关闭）
 */
function insertTag(view: EditorView, tagName: string, triggerPos: number): void {
    const tagText = `#${tagName}`
    const { head } = view.state.selection.main

    view.dispatch({
        changes: {
            from: triggerPos,
            to: head,
            insert: tagText + ' ',
        },
        selection: {
            anchor: triggerPos + tagText.length + 1,
        },
        effects: closeCompletion.of(null),
    })

    view.focus()
}

/**
 * Tab 补全（补全当前路径但保持下拉框打开）
 */
function tabComplete(view: EditorView, path: string, triggerPos: number): void {
    const tagText = `#${path}`
    const { head } = view.state.selection.main

    // 如果路径不以 / 结尾，添加 / 便于继续输入
    const insertText = path.includes('/') ? tagText : tagText

    view.dispatch({
        changes: {
            from: triggerPos,
            to: head,
            insert: insertText,
        },
        selection: {
            anchor: triggerPos + insertText.length,
        },
        // 不关闭补全，更新查询
        effects: setCompletionState.of({
            query: path,
            selectedIndex: 0,
        }),
    })

    view.focus()
}

// ============ 补全下拉框 ============

class CompletionDropdown {
    private dom: HTMLElement | null = null
    private view: EditorView
    private pendingRender: {
        options: CompletionOption[]
        selectedIndex: number
        triggerPos: number
        query: string
    } | null = null
    private measureScheduled = false

    constructor(view: EditorView) {
        this.view = view
    }

    update(state: CompletionState, candidates: TagCandidate[]): void {
        if (!state.active) {
            this.destroy()
            return
        }

        const options = buildCompletionOptions(candidates, state.query)

        this.pendingRender = {
            options,
            selectedIndex: state.selectedIndex,
            triggerPos: state.triggerPos,
            query: state.query,
        }

        // 使用 requestMeasure 延迟读取布局
        if (!this.measureScheduled) {
            this.measureScheduled = true
            this.view.requestMeasure({
                read: () => {
                    if (!this.pendingRender) return null
                    const coords = this.view.coordsAtPos(this.pendingRender.triggerPos)
                    return coords
                },
                write: (coords) => {
                    this.measureScheduled = false
                    this.render(coords)
                },
            })
        }
    }

    private render(coords: { left: number; top: number; bottom: number } | null): void {
        if (!this.pendingRender) return

        const { options, selectedIndex, triggerPos, query } = this.pendingRender

        if (!this.dom) {
            this.dom = document.createElement('div')
            this.dom.className = 'cm-tag-completion'
            document.body.appendChild(this.dom)
        }

        // 计算位置
        if (coords) {
            this.dom.style.left = `${coords.left}px`
            this.dom.style.top = `${coords.bottom + 4}px`
        }

        // 渲染内容
        this.dom.innerHTML = ''

        if (options.length === 0 && query) {
            // 显示创建新标签选项
            const item = document.createElement('div')
            item.className = 'cm-tag-completion-item cm-tag-completion-item--create cm-tag-completion-item--selected'
            item.innerHTML = `<span class="cm-tag-completion-icon">+</span> 创建标签 "<strong>${this.escapeHtml(query)}</strong>"`
            item.addEventListener('mousedown', (e) => {
                e.preventDefault()
                this.createNewTag(query, triggerPos)
            })
            this.dom.appendChild(item)
        } else {
            options.forEach((option, index) => {
                const item = document.createElement('div')
                const isSelected = index === selectedIndex
                item.className = `cm-tag-completion-item ${isSelected ? 'cm-tag-completion-item--selected' : ''}`
                item.style.paddingLeft = `${8 + option.depth * 12}px`

                // 图标
                if (option.isTag) {
                    const dot = document.createElement('span')
                    dot.className = 'cm-tag-completion-dot'
                    dot.style.background = option.tag?.color || 'var(--color-text-muted)'
                    item.appendChild(dot)
                } else {
                    // 虚拟父节点显示文件夹图标
                    const icon = document.createElement('span')
                    icon.className = 'cm-tag-completion-folder'
                    icon.textContent = '📁'
                    item.appendChild(icon)
                }

                // 名称
                const name = document.createElement('span')
                name.className = 'cm-tag-completion-name'
                name.textContent = option.label
                if (!option.isTag) {
                    name.style.color = 'var(--color-text-secondary)'
                }
                item.appendChild(name)

                // 完整路径提示
                if (option.depth > 0) {
                    const path = document.createElement('span')
                    path.className = 'cm-tag-completion-path'
                    path.textContent = option.fullPath
                    item.appendChild(path)
                }

                // 如果是选中的非真实标签，显示提示
                if (isSelected && !option.isTag) {
                    const hint = document.createElement('span')
                    hint.className = 'cm-tag-completion-hint'
                    hint.textContent = 'Tab 补全 / Enter 创建'
                    item.appendChild(hint)
                }

                item.addEventListener('mousedown', (e) => {
                    e.preventDefault()
                    if (option.isTag && option.tag) {
                        insertTag(this.view, option.tag.name, triggerPos)
                        const callback = this.view.state.facet(onTagInsert)
                        callback?.(option.tag)
                    } else {
                        // 非真实标签，Tab 补全
                        tabComplete(this.view, option.fullPath + '/', triggerPos)
                    }
                })

                this.dom!.appendChild(item)
            })

            // 如果有输入内容且不完全匹配，显示创建选项
            if (query && !hasExactMatch(options, query)) {
                const divider = document.createElement('div')
                divider.className = 'cm-tag-completion-divider'
                this.dom.appendChild(divider)

                const isCreateSelected = selectedIndex >= options.length
                const item = document.createElement('div')
                item.className = `cm-tag-completion-item cm-tag-completion-item--create ${isCreateSelected ? 'cm-tag-completion-item--selected' : ''}`
                item.innerHTML = `<span class="cm-tag-completion-icon">+</span> 创建 "<strong>${this.escapeHtml(query)}</strong>"`
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault()
                    this.createNewTag(query, triggerPos)
                })
                this.dom.appendChild(item)
            }
        }
    }

    private createNewTag(tagName: string, triggerPos: number): void {
        insertTag(this.view, tagName, triggerPos)
        const callback = this.view.state.facet(onTagCreate)
        callback?.(tagName)
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div')
        div.textContent = text
        return div.innerHTML
    }

    destroy(): void {
        if (this.dom) {
            this.dom.remove()
            this.dom = null
        }
        this.pendingRender = null
    }
}

// ============ View Plugin ============

const completionPlugin = ViewPlugin.fromClass(
    class {
        dropdown: CompletionDropdown
        pendingUpdate: ReturnType<typeof setTimeout> | null = null

        constructor(view: EditorView) {
            this.dropdown = new CompletionDropdown(view)
        }

        update(update: ViewUpdate): void {
            const state = update.state.field(completionStateField)
            const candidates = update.state.facet(tagCandidates)

            // 检测触发器 - 延迟执行 dispatch 避免在 update 中调用
            if (update.docChanged || update.selectionSet) {
                const content = update.state.doc.toString()
                const { head } = update.state.selection.main
                const trigger = detectTagTrigger(content, head)

                if (trigger.active) {
                    if (!state.active || state.query !== trigger.query) {
                        // 延迟到下一个事件循环
                        if (this.pendingUpdate) clearTimeout(this.pendingUpdate)
                        this.pendingUpdate = setTimeout(() => {
                            this.pendingUpdate = null
                            update.view.dispatch({
                                effects: setCompletionState.of({
                                    active: true,
                                    triggerPos: trigger.triggerPos,
                                    query: trigger.query,
                                    selectedIndex: 0,
                                }),
                            })
                        }, 0)
                    }
                } else if (state.active) {
                    if (this.pendingUpdate) clearTimeout(this.pendingUpdate)
                    this.pendingUpdate = setTimeout(() => {
                        this.pendingUpdate = null
                        update.view.dispatch({
                            effects: closeCompletion.of(null),
                        })
                    }, 0)
                }
            }

            this.dropdown.update(state, candidates)
        }

        destroy(): void {
            if (this.pendingUpdate) clearTimeout(this.pendingUpdate)
            this.dropdown.destroy()
        }
    }
)

// ============ Keymap ============

const completionKeymap = Prec.highest(
    keymap.of([
        {
            key: 'ArrowDown',
            run(view) {
                const state = view.state.field(completionStateField)
                if (!state.active) return false

                const candidates = view.state.facet(tagCandidates)
                const options = buildCompletionOptions(candidates, state.query)
                // +1 是为了包含"创建"选项
                const hasCreateOption = state.query && !hasExactMatch(options, state.query)
                const maxIndex = Math.max(0, options.length - 1 + (hasCreateOption ? 1 : 0))

                view.dispatch({
                    effects: setCompletionState.of({
                        selectedIndex: Math.min(state.selectedIndex + 1, maxIndex),
                    }),
                })
                return true
            },
        },
        {
            key: 'ArrowUp',
            run(view) {
                const state = view.state.field(completionStateField)
                if (!state.active) return false

                view.dispatch({
                    effects: setCompletionState.of({
                        selectedIndex: Math.max(state.selectedIndex - 1, 0),
                    }),
                })
                return true
            },
        },
        {
            key: 'Enter',
            run(view) {
                const state = view.state.field(completionStateField)
                if (!state.active) return false

                const candidates = view.state.facet(tagCandidates)
                const options = buildCompletionOptions(candidates, state.query)

                if (state.selectedIndex < options.length) {
                    const option = options[state.selectedIndex]
                    if (option) {
                        if (option.isTag && option.tag) {
                            // 真实标签，直接插入
                            insertTag(view, option.tag.name, state.triggerPos)
                            const callback = view.state.facet(onTagInsert)
                            callback?.(option.tag)
                        } else {
                            // 虚拟父节点，创建这个标签
                            insertTag(view, option.fullPath, state.triggerPos)
                            const callback = view.state.facet(onTagCreate)
                            callback?.(option.fullPath)
                        }
                    }
                } else if (state.query) {
                    // 选中了"创建"选项
                    insertTag(view, state.query, state.triggerPos)
                    const callback = view.state.facet(onTagCreate)
                    callback?.(state.query)
                }
                return true
            },
        },
        {
            key: 'Tab',
            run(view) {
                const state = view.state.field(completionStateField)
                if (!state.active) return false

                const candidates = view.state.facet(tagCandidates)
                const options = buildCompletionOptions(candidates, state.query)

                if (state.selectedIndex < options.length) {
                    const option = options[state.selectedIndex]
                    if (option) {
                        // Tab 补全：填充路径但不关闭下拉框
                        // 如果是虚拟节点，添加 / 便于继续输入
                        const appendSlash = !option.isTag || options.some(o => o.fullPath.startsWith(option.fullPath + '/'))
                        tabComplete(view, option.fullPath + (appendSlash ? '/' : ''), state.triggerPos)
                    }
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

// ============ 样式 ============

const completionStyle = EditorView.baseTheme({
    '.cm-tag-highlight': {
        color: 'var(--color-primary)',
        fontWeight: '500',
    },
})

// ============ 导出扩展 ============

/**
 * 创建标签补全扩展
 */
export function tagCompletion(config: {
    candidates: TagCandidate[]
    onInsert?: (tag: TagCandidate) => void
    onCreate?: (tagName: string) => void
}): Extension {
    return [
        completionStateField,
        tagHighlightField,
        tagCandidates.of(config.candidates),
        onTagInsert.of(config.onInsert),
        onTagCreate.of(config.onCreate),
        completionKeymap,
        completionPlugin,
        completionStyle,
    ]
}

/**
 * 更新标签候选列表
 */
export function updateTagCandidates(candidates: TagCandidate[]): Extension {
    return tagCandidates.of(candidates)
}
