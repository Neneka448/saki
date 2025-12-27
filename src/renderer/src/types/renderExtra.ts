/**
 * UI 层类型系统
 * 
 * 设计思路：
 * - Kernel 层的 Card/Tag 是纯数据载体
 * - UI 层通过 CardType/TagType 定义如何渲染和编辑
 * - extra 字段存储该类型特有的结构化数据
 */

import type { Component } from 'vue'

// ============ Card 类型系统 ============

/**
 * 卡片类型标识
 * 存储在 card_meta.extra.type 中
 */
export type CardTypeId = 'markdown' | 'todo' | 'table' | 'embed' | (string & {})

/**
 * 卡片类型定义
 * 每种卡片类型需要注册这个结构
 */
export interface CardTypeDefinition<TExtra = Record<string, unknown>> {
    /** 类型标识 */
    id: CardTypeId
    /** 显示名称 */
    label: string
    /** 图标（emoji 或 icon class） */
    icon: string
    /** 描述 */
    description?: string

    /** 渲染组件（只读视图） */
    renderer: Component
    /** 编辑器组件 */
    editor: Component
    /** 列表项渲染组件（可选，默认使用通用列表项） */
    listItemRenderer?: Component

    /** extra 数据的默认值工厂 */
    createDefaultExtra: () => TExtra
    /** 验证 extra 数据是否合法 */
    validateExtra?: (extra: unknown) => extra is TExtra
    /** 从 content + extra 提取摘要 */
    extractSummary?: (content: string, extra: TExtra) => string
    /** 从 content + extra 计算字数 */
    countWords?: (content: string, extra: TExtra) => number
}

/**
 * 卡片基础 Extra 结构
 * 所有卡片类型的 extra 都应包含 type 字段
 */
export interface BaseCardExtra {
    /** 卡片类型标识 */
    type: CardTypeId
}

// ============ 具体卡片类型的 Extra 定义 ============

/**
 * Markdown 卡片 Extra
 * 最基础的卡片类型，content 就是 markdown 文本
 */
export interface MarkdownCardExtra extends BaseCardExtra {
    type: 'markdown'
    // markdown 卡片暂时没有额外字段，content 即全部
}

/**
 * Todo 卡片 Extra
 * content 是任务描述，extra 存储任务状态
 */
export interface TodoCardExtra extends BaseCardExtra {
    type: 'todo'
    /** 是否已完成 */
    completed: boolean
    /** 完成时间 */
    completedAt?: number
    /** 截止日期 */
    dueDate?: number
    /** 优先级 */
    priority?: 'low' | 'medium' | 'high'
}

/**
 * 表格卡片 Extra
 * content 可以是表格描述，extra 存储表格数据
 */
export interface TableCardExtra extends BaseCardExtra {
    type: 'table'
    /** 列定义 */
    columns: Array<{
        id: string
        name: string
        type: 'text' | 'number' | 'date' | 'select'
    }>
    /** 行数据 */
    rows: Array<Record<string, unknown>>
}

/**
 * 嵌入卡片 Extra
 * content 是描述，extra 存储嵌入信息
 */
export interface EmbedCardExtra extends BaseCardExtra {
    type: 'embed'
    /** 嵌入类型 */
    embedType: 'link' | 'image' | 'video' | 'file'
    /** 资源 URL */
    url: string
    /** 元信息 */
    meta?: {
        title?: string
        description?: string
        thumbnail?: string
    }
}

/**
 * 所有卡片 Extra 类型的联合
 */
export type CardExtra =
    | MarkdownCardExtra
    | TodoCardExtra
    | TableCardExtra
    | EmbedCardExtra

// ============ Tag 类型系统 ============

/**
 * 标签类型标识
 * 存储在 tag_meta.extra.type 中
 */
export type TagTypeId = 'normal' | 'status' | 'smart' | (string & {})

/**
 * 标签类型定义
 */
export interface TagTypeDefinition<TExtra = Record<string, unknown>> {
    /** 类型标识 */
    id: TagTypeId
    /** 显示名称 */
    label: string
    /** 图标 */
    icon: string
    /** 描述 */
    description?: string

    /** 标签渲染组件（chip/badge） */
    renderer: Component
    /** 标签选择器中的渲染（可选） */
    selectorItemRenderer?: Component

    /** extra 数据的默认值工厂 */
    createDefaultExtra: () => TExtra
    /** 验证 extra 数据 */
    validateExtra?: (extra: unknown) => extra is TExtra
}

/**
 * 标签基础 Extra 结构
 */
export interface BaseTagExtra {
    /** 标签类型标识 */
    type: TagTypeId
}

// ============ 具体标签类型的 Extra 定义 ============

/**
 * 普通标签 Extra
 * 最基础的标签，用于分类
 */
export interface NormalTagExtra extends BaseTagExtra {
    type: 'normal'
    // 普通标签没有额外字段
}

/**
 * 状态标签 Extra
 * 用于表示卡片状态（如：待处理、进行中、已完成）
 */
export interface StatusTagExtra extends BaseTagExtra {
    type: 'status'
    /** 状态值（用于排序和筛选） */
    statusOrder: number
    /** 是否为终态（如"已完成"） */
    isFinal: boolean
}

/**
 * 智能标签 Extra
 * 基于规则自动匹配卡片
 */
export interface SmartTagExtra extends BaseTagExtra {
    type: 'smart'
    /** 匹配规则 */
    rules: SmartTagRule[]
    /** 规则间关系 */
    ruleOperator: 'and' | 'or'
}

export interface SmartTagRule {
    field: 'content' | 'title' | 'wordCount' | 'createdAt' | 'updatedAt'
    operator: 'contains' | 'notContains' | 'equals' | 'gt' | 'lt' | 'between'
    value: string | number | [number, number]
}

/**
 * 所有标签 Extra 类型的联合
 */
export type TagExtra =
    | NormalTagExtra
    | StatusTagExtra
    | SmartTagExtra

// ============ 类型注册表 ============

/**
 * 卡片类型注册表
 */
export interface CardTypeRegistry {
    /** 注册卡片类型 */
    register<T extends BaseCardExtra>(definition: CardTypeDefinition<T>): void
    /** 获取卡片类型定义 */
    get(typeId: CardTypeId): CardTypeDefinition | undefined
    /** 获取所有已注册类型 */
    getAll(): CardTypeDefinition[]
    /** 获取默认类型 */
    getDefault(): CardTypeDefinition
}

/**
 * 标签类型注册表
 */
export interface TagTypeRegistry {
    /** 注册标签类型 */
    register<T extends BaseTagExtra>(definition: TagTypeDefinition<T>): void
    /** 获取标签类型定义 */
    get(typeId: TagTypeId): TagTypeDefinition | undefined
    /** 获取所有已注册类型 */
    getAll(): TagTypeDefinition[]
    /** 获取默认类型 */
    getDefault(): TagTypeDefinition
}

// ============ 工具函数 ============

/**
 * 获取卡片类型 ID
 */
export function getCardTypeId(extra: Record<string, unknown> | null): CardTypeId {
    if (!extra || typeof extra.type !== 'string') {
        return 'markdown' // 默认类型
    }
    return extra.type as CardTypeId
}

/**
 * 获取标签类型 ID
 */
export function getTagTypeId(extra: Record<string, unknown> | null): TagTypeId {
    if (!extra || typeof extra.type !== 'string') {
        return 'normal' // 默认类型
    }
    return extra.type as TagTypeId
}

/**
 * 创建卡片 Extra
 */
export function createCardExtra<T extends CardExtra>(extra: T): T {
    return extra
}

/**
 * 创建标签 Extra
 */
export function createTagExtra<T extends TagExtra>(extra: T): T {
    return extra
}
