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
// 匹配卡片引用，但排除图片语法 [[!image]...]
// 卡片引用格式: [[标题]](显示文本)<!--ref:id-->
const REF_REGEX = /\[\[(?!!(?:image|img))([^\]]+)\]\]\(([^)]*)\)(?:<!--ref:([a-zA-Z0-9_-]+)-->)?/g

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
 * 获取内容中所有代码区域的范围（代码块和行内代码）
 */
const getCodeRanges = (content: string): Array<{ start: number; end: number }> => {
    const ranges: Array<{ start: number; end: number }> = []

    // 匹配围栏代码块 ```...```
    const fencePattern = /```[\s\S]*?```/g
    let match
    while ((match = fencePattern.exec(content)) !== null) {
        ranges.push({ start: match.index, end: match.index + match[0].length })
    }

    // 匹配行内代码 `...`（但不匹配 ```）
    const inlinePattern = /(?<!`)`(?!``)[^`\n]+`(?!`)/g
    while ((match = inlinePattern.exec(content)) !== null) {
        ranges.push({ start: match.index, end: match.index + match[0].length })
    }

    return ranges
}

/**
 * 检查位置是否在代码区域内
 */
const isInCodeRange = (pos: number, ranges: Array<{ start: number; end: number }>): boolean => {
    return ranges.some(r => pos >= r.start && pos < r.end)
}

/**
 * 解析并规范化内容中的卡片引用
 * - 为缺少 refId 的引用自动生成 ID（当 allowInsert=true）
 * - 检测孤立的 ref 注释
 * - 跳过代码块内的内容
 */
export const normalizeCardReferences = (
    content: string,
    options: { allowInsert?: boolean } = {}
): ReferenceParseResult => {
    const allowInsert = options.allowInsert !== false
    const references: CardReferenceToken[] = []
    const codeRanges = getCodeRanges(content)

    const replaced = content.replace(REF_REGEX, (match, title, placeholder, refId, offset) => {
        // 跳过代码区域内的引用
        if (isInCodeRange(offset, codeRanges)) {
            return match
        }

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
    // 只记录警告，不阻止保存
    const allRefComments = replaced.match(REF_COMMENT_PATTERN)
    if (allRefComments && allRefComments.length > references.length) {
        console.warn('Orphan ref comment detected, will be cleaned up')
        // 清理孤立的 ref 注释（但跳过代码块内的）
        const validRefIds = new Set(references.map(r => r.refId))
        let cleanedContent = ''
        let lastIndex = 0

        REF_COMMENT_PATTERN.lastIndex = 0
        let commentMatch
        while ((commentMatch = REF_COMMENT_PATTERN.exec(replaced)) !== null) {
            const refId = commentMatch[1]
            const pos = commentMatch.index

            // 保留代码块内的注释或有效的引用注释
            if (isInCodeRange(pos, codeRanges) || validRefIds.has(refId)) {
                cleanedContent += replaced.slice(lastIndex, pos + commentMatch[0].length)
            } else {
                cleanedContent += replaced.slice(lastIndex, pos)
            }
            lastIndex = pos + commentMatch[0].length
        }
        cleanedContent += replaced.slice(lastIndex)

        return { content: cleanedContent, references }
    }

    return { content: replaced, references }
}
