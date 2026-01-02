/**
 * 正文标签同步服务
 * 
 * 功能：
 * - 解析正文中的 #tag 语法
 * - 自动创建不存在的标签
 * - 自动关联标签到卡片
 */

import { extractUniqueTagNames, isValidTagName } from '../utils/tagParseUtils'

export interface SyncTagsResult {
    addedTags: string[]
    failedTags: string[]
}

/**
 * 同步卡片正文中的标签
 * @param cardId 卡片ID
 * @param projectId 项目ID
 * @param content 卡片正文
 * @returns 同步结果，包含新增和失败的标签名列表
 */
export async function syncContentTags(
    cardId: number,
    projectId: number,
    content: string
): Promise<SyncTagsResult> {
    const result: SyncTagsResult = { addedTags: [], failedTags: [] }

    // 1. 提取正文中的所有标签名
    const tagNames = extractUniqueTagNames(content)

    if (tagNames.length === 0) return result

    // 2. 获取卡片当前的标签
    const currentTagsResult = await window.card.getTags(cardId)
    const currentTags = currentTagsResult.success ? currentTagsResult.data : []
    const currentTagNames = new Set(currentTags.map(t => t.name))

    // 3. 找出需要新增的标签
    const tagsToAdd = tagNames.filter(name =>
        isValidTagName(name) && !currentTagNames.has(name)
    )

    if (tagsToAdd.length === 0) return result

    // 4. 对每个需要新增的标签，先 getOrCreate，再关联到卡片
    for (const tagName of tagsToAdd) {
        try {
            // getOrCreate：如果标签不存在就创建
            const tagResult = await window.tag.getOrCreate(projectId, tagName)

            if (tagResult.success) {
                // 关联到卡片
                const addResult = await window.card.addTag(cardId, tagResult.data.id)
                if (addResult.success) {
                    result.addedTags.push(tagName)
                } else {
                    result.failedTags.push(tagName)
                }
            } else {
                result.failedTags.push(tagName)
            }
        } catch (e) {
            console.error(`Failed to sync tag "${tagName}":`, e)
            result.failedTags.push(tagName)
        }
    }

    return result
}
