/**
 * 标签类型注册表实现
 */
import type { Component } from 'vue'
import type {
    TagTypeId,
    TagTypeDefinition,
    TagTypeRegistry,
    BaseTagExtra,
    NormalTagExtra,
} from '../types/renderExtra'

// 默认标签渲染器占位组件
const PlaceholderTagRenderer = {
    name: 'PlaceholderTagRenderer',
    template: '<span class="tag-chip" :style="{ background: color }">{{ name }}</span>',
    props: ['name', 'color', 'extra'],
}

/**
 * 普通标签类型定义（默认类型）
 */
const normalTagType: TagTypeDefinition<NormalTagExtra> = {
    id: 'normal',
    label: '普通标签',
    icon: '🏷️',
    description: '用于分类和组织卡片',

    renderer: PlaceholderTagRenderer as unknown as Component,

    createDefaultExtra: () => ({ type: 'normal' }),

    validateExtra: (extra): extra is NormalTagExtra => {
        return extra !== null && typeof extra === 'object' && (extra as any).type === 'normal'
    },
}

/**
 * 创建标签类型注册表
 */
export function createTagTypeRegistry(): TagTypeRegistry {
    const types = new Map<TagTypeId, TagTypeDefinition>()

    // 注册默认类型
    types.set('normal', normalTagType)

    return {
        register<T extends BaseTagExtra>(definition: TagTypeDefinition<T>) {
            types.set(definition.id, definition as TagTypeDefinition)
        },

        get(typeId: TagTypeId) {
            return types.get(typeId)
        },

        getAll() {
            return Array.from(types.values())
        },

        getDefault() {
            return types.get('normal')!
        },
    }
}

/**
 * 全局标签类型注册表实例
 */
export const tagTypeRegistry = createTagTypeRegistry()
