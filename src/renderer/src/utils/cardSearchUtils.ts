import type { CardListItem, CardDetail } from '../../../shared/ipc/types'

/**
 * 搜索结果项
 */
export interface CardSearchResult {
    card: CardListItem
    /** 匹配的内容片段 */
    snippet: string
    /** 匹配位置 */
    matchIndex: number
}

/**
 * 规范化文本用于搜索
 */
export const normalizeText = (value: string): string => value.toLowerCase()

/**
 * 压缩文本（去除多余空白）
 */
export const compactText = (value: string): string => value.replace(/\s+/g, ' ').trim()

/**
 * 构建匹配片段
 */
export const buildMatchSnippet = (
    text: string,
    matchIndex: number,
    matchLength: number,
    radius = 30
): string => {
    const start = Math.max(0, matchIndex - radius)
    const end = Math.min(text.length, matchIndex + matchLength + radius)
    let snippet = text.slice(start, end)
    if (start > 0) snippet = '...' + snippet
    if (end < text.length) snippet = snippet + '...'
    return compactText(snippet)
}

/**
 * 在卡片列表中搜索
 * @param cards 卡片列表（需要包含 content）
 * @param query 搜索关键词
 * @param limit 返回数量限制
 */
export const searchCardsInMemory = (
    cards: Array<CardListItem & { content?: string }>,
    query: string,
    limit = 20
): CardSearchResult[] => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return []

    const lowerQuery = normalizeText(trimmedQuery)
    const results: CardSearchResult[] = []

    for (const card of cards) {
        // 搜索标题
        const title = card.title || ''
        const lowerTitle = normalizeText(title)
        const titleIndex = lowerTitle.indexOf(lowerQuery)

        if (titleIndex >= 0) {
            results.push({
                card,
                snippet: buildMatchSnippet(title, titleIndex, trimmedQuery.length),
                matchIndex: titleIndex,
            })
            continue
        }

        // 搜索摘要
        const summary = card.summary || ''
        const lowerSummary = normalizeText(summary)
        const summaryIndex = lowerSummary.indexOf(lowerQuery)

        if (summaryIndex >= 0) {
            results.push({
                card,
                snippet: buildMatchSnippet(summary, summaryIndex, trimmedQuery.length),
                matchIndex: summaryIndex,
            })
            continue
        }

        // 搜索正文（如果有）
        const content = (card as any).content || ''
        if (content) {
            const lowerContent = normalizeText(content)
            const contentIndex = lowerContent.indexOf(lowerQuery)

            if (contentIndex >= 0) {
                results.push({
                    card,
                    snippet: buildMatchSnippet(content, contentIndex, trimmedQuery.length),
                    matchIndex: contentIndex,
                })
            }
        }
    }

    return results.slice(0, limit)
}

/**
 * 根据标签筛选卡片（AND 逻辑：必须包含所有标签）
 * @param projectId 项目ID
 * @param tagIds 标签ID数组
 */
export const filterCardsByTags = async (
    projectId: number,
    tagIds: number[]
): Promise<CardListItem[]> => {
    // 转换为普通数组，避免 Proxy 对象无法通过 IPC 序列化
    const plainTagIds = [...tagIds]

    if (plainTagIds.length === 0) {
        const result = await window.card.getListByProject(projectId)
        return result.success ? result.data : []
    }

    if (plainTagIds.length === 1) {
        const result = await window.card.getByTag(plainTagIds[0])
        return result.success ? result.data : []
    }

    const result = await window.card.getByTags(plainTagIds)
    return result.success ? result.data : []
}

/**
 * 全文搜索卡片（需要加载完整内容）
 * @param projectId 项目ID
 * @param query 搜索关键词
 */
export const searchCardsFullText = async (
    projectId: number,
    query: string
): Promise<CardSearchResult[]> => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return []

    // 获取所有卡片列表
    const listResult = await window.card.getListByProject(projectId)
    if (!listResult.success) return []

    const lowerQuery = normalizeText(trimmedQuery)
    const results: CardSearchResult[] = []

    // 并行加载卡片详情并搜索
    const searchPromises = listResult.data.map(async (card) => {
        // 先搜索标题和摘要
        const title = card.title || ''
        const summary = card.summary || ''

        const titleIndex = normalizeText(title).indexOf(lowerQuery)
        if (titleIndex >= 0) {
            return {
                card,
                snippet: buildMatchSnippet(title, titleIndex, trimmedQuery.length),
                matchIndex: titleIndex,
            }
        }

        const summaryIndex = normalizeText(summary).indexOf(lowerQuery)
        if (summaryIndex >= 0) {
            return {
                card,
                snippet: buildMatchSnippet(summary, summaryIndex, trimmedQuery.length),
                matchIndex: summaryIndex,
            }
        }

        // 加载完整内容搜索
        const detailResult = await window.card.getById(card.id)
        if (!detailResult.success) return null

        const content = detailResult.data.content || ''
        const contentIndex = normalizeText(content).indexOf(lowerQuery)

        if (contentIndex >= 0) {
            return {
                card,
                snippet: buildMatchSnippet(content, contentIndex, trimmedQuery.length),
                matchIndex: contentIndex,
            }
        }

        return null
    })

    const searchResults = await Promise.all(searchPromises)
    return searchResults.filter((r): r is CardSearchResult => r !== null)
}
