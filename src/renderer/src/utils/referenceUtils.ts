export const REFERENCE_NAMESPACE = 'system:card_ref'
export const REFERENCE_META_TYPE = 'card_ref'

export interface CardReferenceToken {
    title: string
    placeholder: string
    refId: string
    index: number
    raw: string
}

export interface ReferenceParseResult {
    content: string
    references: CardReferenceToken[]
}

const REF_COMMENT_PATTERN = /<!--ref:([a-zA-Z0-9_-]+)-->/g
const REF_REGEX = /\[\[([^\]]+)\]\]\(([^)]*)\)(?:<!--ref:([a-zA-Z0-9_-]+)-->)?/g

/**
 * 生成唯一的引用 ID
 */
export const createReferenceId = (): string => {
    const now = Date.now().toString(36)
    const rand = Math.random().toString(36).slice(2, 8)
    return `${now}${rand}`
}

/**
 * 校验内容中的引用结构是否完整（所有引用必须有 refId）
 * @throws 如果引用结构不完整则抛出错误
 */
export const assertReferenceInvariant = (content: string): void => {
    normalizeCardReferences(content, { allowInsert: false })
}

/**
 * 解析并规范化内容中的卡片引用
 * - 为缺少 refId 的引用自动生成 ID（当 allowInsert=true）
 * - 检测孤立的 ref 注释
 * @throws 如果存在孤立的 ref 注释，或 allowInsert=false 时存在缺少 refId 的引用
 */
export const normalizeCardReferences = (
    content: string,
    options: { allowInsert?: boolean } = {}
): ReferenceParseResult => {
    const allowInsert = options.allowInsert !== false
    const references: CardReferenceToken[] = []

    const replaced = content.replace(REF_REGEX, (match, title, placeholder, refId, offset) => {
        const cleanTitle = String(title || '').trim()
        const cleanPlaceholder = String(placeholder || '')
        let resolvedRefId = typeof refId === 'string' && refId.length > 0 ? refId : ''

        if (!resolvedRefId) {
            if (!allowInsert) {
                throw new Error('Reference missing ref id comment')
            }
            resolvedRefId = createReferenceId()
        }

        const raw = `[[${cleanTitle}]](${cleanPlaceholder})<!--ref:${resolvedRefId}-->`
        references.push({
            title: cleanTitle,
            placeholder: cleanPlaceholder,
            refId: resolvedRefId,
            index: offset,
            raw,
        })
        return raw
    })

    // 检测孤立的 ref 注释（不属于任何引用的注释）
    const allRefComments = replaced.match(REF_COMMENT_PATTERN)
    if (allRefComments && allRefComments.length > references.length) {
        throw new Error('Orphan ref comment detected')
    }

    return { content: replaced, references }
}
