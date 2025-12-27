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
const REF_REGEX = /\[\[([^\]]+)\]\]\(([^)]*)\)(?:<!--ref:([a-zA-Z0-9_-]+)-->){0,1}/g

export const createReferenceId = () => {
    const now = Date.now().toString(36)
    const rand = Math.random().toString(36).slice(2, 8)
    return `${now}${rand}`
}

export const assertReferenceInvariant = (content: string) => {
    const normalized = normalizeCardReferences(content, { allowInsert: false })
    if (normalized.errors.length > 0) {
        throw new Error(normalized.errors[0])
    }
}

export const normalizeCardReferences = (
    content: string,
    options: { allowInsert?: boolean } = {}
): ReferenceParseResult & { errors: string[] } => {
    const allowInsert = options.allowInsert !== false
    const references: CardReferenceToken[] = []
    const errors: string[] = []

    const replaced = content.replace(REF_REGEX, (match, title, placeholder, refId, offset) => {
        const cleanTitle = String(title || '').trim()
        const cleanPlaceholder = String(placeholder || '')
        let resolvedRefId = typeof refId === 'string' && refId.length > 0 ? refId : ''

        if (!resolvedRefId) {
            if (!allowInsert) {
                errors.push('Reference missing ref id comment')
                return match
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

    const leftovers = replaced.match(REF_COMMENT_PATTERN)
    if (leftovers && leftovers.length > references.length) {
        errors.push('Orphan ref comment detected')
    }

    if (errors.length > 0) {
        throw new Error(errors[0])
    }

    return {
        content: replaced,
        references,
        errors,
    }
}
