/**
 * 卡片类型注册表实现
 */
import { shallowRef, type Component, defineAsyncComponent } from 'vue'
import type {
    CardTypeId,
    CardTypeDefinition,
    CardTypeRegistry,
    BaseCardExtra,
    MarkdownCardExtra,
} from '../types/renderExtra'

// 异步加载组件
const MarkdownRenderer = defineAsyncComponent(() => import('../components/card/MarkdownRenderer.vue'))
const MarkdownEditor = defineAsyncComponent(() => import('../components/card/MarkdownEditor.vue'))

/**
 * Markdown 卡片类型定义（默认类型）
 */
const markdownCardType: CardTypeDefinition<MarkdownCardExtra> = {
    id: 'markdown',
    label: 'Markdown',
    icon: '📝',
    description: '支持 Markdown 格式的文本卡片',

    renderer: MarkdownRenderer,
    editor: MarkdownEditor,

    createDefaultExtra: () => ({ type: 'markdown' }),

    validateExtra: (extra): extra is MarkdownCardExtra => {
        return extra !== null && typeof extra === 'object' && (extra as any).type === 'markdown'
    },

    extractSummary: (content: string) => {
        // 移除 markdown 标记，提取前 100 字符
        const plain = content
            .replace(/^#+\s+/gm, '') // 标题
            .replace(/\*\*|__/g, '') // 加粗
            .replace(/\*|_/g, '')    // 斜体
            .replace(/`{1,3}[^`]*`{1,3}/g, '') // 代码
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 链接
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // 图片
            .replace(/\n+/g, ' ')
            .trim()
        return plain.slice(0, 100)
    },

    countWords: (content: string) => {
        // 简单的中英文字数统计
        const chinese = (content.match(/[\u4e00-\u9fa5]/g) || []).length
        const english = (content.match(/[a-zA-Z]+/g) || []).length
        return chinese + english
    },
}

/**
 * 创建卡片类型注册表
 */
export function createCardTypeRegistry(): CardTypeRegistry {
    const types = new Map<CardTypeId, CardTypeDefinition>()

    // 注册默认类型
    types.set('markdown', markdownCardType)

    return {
        register<T extends BaseCardExtra>(definition: CardTypeDefinition<T>) {
            types.set(definition.id, definition as CardTypeDefinition)
        },

        get(typeId: CardTypeId) {
            return types.get(typeId)
        },

        getAll() {
            return Array.from(types.values())
        },

        getDefault() {
            return types.get('markdown')!
        },
    }
}

/**
 * 全局卡片类型注册表实例
 */
export const cardTypeRegistry = createCardTypeRegistry()
