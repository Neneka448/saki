/**
 * 卡片工具函数
 */
import type { CardListItem } from '../../../shared/ipc/types'
import { getCardTypeId, type CardExtra } from '../types/renderExtra'
import { cardTypeRegistry } from '../registry/cardTypes'

// ============ 排序 ============

export type SortMode = 'time' | 'title' | 'wordCount'
export type SortOrder = 'asc' | 'desc'

export interface SortOptions {
    mode: SortMode
    order: SortOrder
}

/**
 * 对卡片列表进行排序
 */
export function sortCards(
    cards: CardListItem[],
    options: SortOptions = { mode: 'time', order: 'desc' }
): CardListItem[] {
    const result = [...cards]

    result.sort((a, b) => {
        let compareValue = 0

        switch (options.mode) {
            case 'time':
                compareValue = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                break
            case 'title':
                const titleA = a.title || ''
                const titleB = b.title || ''
                compareValue = titleA.localeCompare(titleB, 'zh-CN')
                break
            case 'wordCount':
                compareValue = (a.wordCount || 0) - (b.wordCount || 0)
                break
        }

        return options.order === 'desc' ? -compareValue : compareValue
    })

    return result
}

// ============ 筛选 ============

export interface FilterOptions {
    /** 搜索关键词（匹配标题和摘要） */
    keyword?: string
    /** 卡片类型 */
    cardType?: string
}

export function filterCards(cards: CardListItem[], options: FilterOptions): CardListItem[] {
    return cards.filter((card) => {
        // 关键词搜索
        if (options.keyword) {
            const keyword = options.keyword.toLowerCase()
            const title = (card.title || '').toLowerCase()
            const summary = (card.summary || '').toLowerCase()
            if (!title.includes(keyword) && !summary.includes(keyword)) {
                return false
            }
        }

        // 类型筛选
        if (options.cardType) {
            const typeId = getCardTypeId(card.extra)
            if (typeId !== options.cardType) {
                return false
            }
        }

        return true
    })
}

// ============ 分组 ============

export interface CardGroup {
    label: string
    date: Date
    cards: CardListItem[]
}

/**
 * 按日期分组卡片
 */
export function groupCardsByDate(cards: CardListItem[]): CardGroup[] {
    const groups = new Map<string, CardGroup>()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const card of cards) {
        const date = new Date(card.createdAt)
        date.setHours(0, 0, 0, 0)

        const diff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
        let label: string
        let key: string

        if (diff === 0) {
            label = '今天'
            key = 'today'
        } else if (diff === 1) {
            label = '昨天'
            key = 'yesterday'
        } else if (diff < 7) {
            label = '本周'
            key = 'this-week'
        } else if (diff < 30) {
            label = '本月'
            key = 'this-month'
        } else {
            label = date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
            key = `${date.getFullYear()}-${date.getMonth()}`
        }

        if (!groups.has(key)) {
            groups.set(key, { label, date, cards: [] })
        }
        groups.get(key)!.cards.push(card)
    }

    return Array.from(groups.values())
}

// ============ 类型相关 ============

/**
 * 获取卡片的类型定义
 */
export function getCardTypeDefinition(card: CardListItem) {
    const typeId = getCardTypeId(card.extra)
    return cardTypeRegistry.get(typeId) || cardTypeRegistry.getDefault()
}

/**
 * 获取卡片的渲染组件
 */
export function getCardRenderer(card: CardListItem) {
    return getCardTypeDefinition(card).renderer
}

/**
 * 获取卡片的编辑器组件
 */
export function getCardEditor(card: CardListItem) {
    return getCardTypeDefinition(card).editor
}
