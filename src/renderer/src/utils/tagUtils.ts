/**
 * 标签工具函数
 */
import type { TagWithMeta, TagWithUsageCount } from '../../../shared/ipc/types'
import { getTagTypeId } from '../types/renderExtra'
import { tagTypeRegistry } from '../registry/tagTypes'

// ============ 排序 ============

/**
 * 按使用次数排序标签
 */
export function sortTagsByUsage(
    tags: TagWithUsageCount[],
    order: 'asc' | 'desc' = 'desc'
): TagWithUsageCount[] {
    return [...tags].sort((a, b) => {
        const diff = a.usageCount - b.usageCount
        return order === 'desc' ? -diff : diff
    })
}

/**
 * 按名称排序标签
 */
export function sortTagsByName(
    tags: TagWithMeta[],
    order: 'asc' | 'desc' = 'asc'
): TagWithMeta[] {
    return [...tags].sort((a, b) => {
        const result = a.name.localeCompare(b.name, 'zh-CN')
        return order === 'desc' ? -result : result
    })
}

// ============ 搜索 ============

/**
 * 搜索标签
 */
export function searchTags<T extends TagWithMeta>(tags: T[], keyword: string): T[] {
    if (!keyword.trim()) return tags

    const lowerKeyword = keyword.toLowerCase()
    return tags.filter((tag) => {
        const name = tag.name.toLowerCase()
        const desc = (tag.description || '').toLowerCase()
        return name.includes(lowerKeyword) || desc.includes(lowerKeyword)
    })
}

// ============ 类型相关 ============

/**
 * 获取标签的类型定义
 */
export function getTagTypeDefinition(tag: TagWithMeta) {
    const typeId = getTagTypeId(tag.extra)
    return tagTypeRegistry.get(typeId) || tagTypeRegistry.getDefault()
}

/**
 * 获取标签的渲染组件
 */
export function getTagRenderer(tag: TagWithMeta) {
    return getTagTypeDefinition(tag).renderer
}

// ============ 显示样式 ============

export type TagStyle = 'solid' | 'outline' | 'ghost'

export interface TagDisplayInfo {
    name: string
    color: string
    bgColor: string
    textColor: string
    borderColor: string
    icon: string | null
}

/**
 * 获取标签的显示信息
 */
export function getTagDisplayInfo(
    tag: TagWithMeta,
    style: TagStyle = 'solid'
): TagDisplayInfo {
    const baseColor = tag.color || '#6b7280'
    const icon = tag.icon || null

    let bgColor: string
    let textColor: string
    let borderColor: string

    switch (style) {
        case 'solid':
            bgColor = baseColor
            textColor = '#ffffff'
            borderColor = baseColor
            break
        case 'outline':
            bgColor = 'transparent'
            textColor = baseColor
            borderColor = baseColor
            break
        case 'ghost':
            bgColor = `${baseColor}1a` // 10% opacity
            textColor = baseColor
            borderColor = 'transparent'
            break
    }

    return {
        name: tag.name,
        color: baseColor,
        bgColor,
        textColor,
        borderColor,
        icon,
    }
}
