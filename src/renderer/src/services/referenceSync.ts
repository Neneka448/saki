import type { CardListItem } from '../../../shared/ipc/types'
import { normalizeCardReferences, REFERENCE_NAMESPACE, REFERENCE_META_TYPE, type CardReferenceToken } from '../utils/referenceUtils'

interface CardReferenceMeta {
  type: string
  refId: string
  sourceCardId: number
  targetCardId: number
  titleSnapshot: string
  placeholder: string
}

const buildTitleMap = (cards: CardListItem[], sourceCardId: number) => {
  const map = new Map<string, CardListItem | null>()
  cards.forEach((card) => {
    if (!card.title || card.id === sourceCardId) return
    const key = card.title.trim()
    if (!key) return
    if (!map.has(key)) {
      map.set(key, card)
      return
    }
    map.set(key, null)
  })
  return map
}

const resolveTargetCard = (titleMap: Map<string, CardListItem | null>, title: string) => {
  if (!title) return null
  const result = titleMap.get(title.trim())
  if (!result) return null
  return result
}

const getTagRefId = (extra: Record<string, unknown> | null): string | null => {
  if (!extra) return null
  const refId = extra.refId
  if (typeof refId === 'string' && refId.trim()) return refId
  return null
}

const buildTagName = (placeholder: string, title: string) => {
  const trimmed = placeholder.trim()
  if (trimmed) return trimmed
  return title.trim() || 'card-ref'
}

const buildMeta = (
  token: CardReferenceToken,
  sourceCardId: number,
  targetCardId: number
): CardReferenceMeta => ({
  type: REFERENCE_META_TYPE,
  refId: token.refId,
  sourceCardId,
  targetCardId,
  titleSnapshot: token.title,
  placeholder: token.placeholder,
})

export const syncCardReferences = async (
  cardId: number,
  projectId: number,
  content: string
) => {
  const parsed = normalizeCardReferences(content)
  const listResult = await window.card.getListByProject(projectId)
  if (!listResult.success) {
    return { content: parsed.content, references: parsed.references }
  }

  const titleMap = buildTitleMap(listResult.data, cardId)
  const tagsResult = await window.card.getTags(cardId)
  const existingTags = tagsResult.success ? tagsResult.data.filter((tag) => tag.namespace === REFERENCE_NAMESPACE) : []
  const existingMap = new Map<string, typeof existingTags[number]>()
  existingTags.forEach((tag) => {
    const refId = getTagRefId(tag.extra)
    if (refId) {
      existingMap.set(refId, tag)
    }
  })

  const nextRefIds = new Set<string>()
  for (const token of parsed.references) {
    const target = resolveTargetCard(titleMap, token.title)
    if (!target) continue
    nextRefIds.add(token.refId)

    const existing = existingMap.get(token.refId)
    const tagName = buildTagName(token.placeholder, token.title)
    const meta = buildMeta(token, cardId, target.id)

    if (existing) {
      if (existing.name !== tagName) {
        await window.tag.update({ id: existing.id, name: tagName })
      }
      await window.tag.updateMeta({ tagId: existing.id, meta: { extra: meta } })
      continue
    }

    const tagResult = await window.tag.create({
      projectId,
      name: tagName,
      namespace: REFERENCE_NAMESPACE,
      meta: { extra: meta },
    })
    if (tagResult.success) {
      await window.card.addTag(cardId, tagResult.data.id)
    }
  }

  for (const tag of existingTags) {
    const refId = getTagRefId(tag.extra)
    if (!refId) {
      await window.tag.delete(tag.id)
      continue
    }
    if (!nextRefIds.has(refId)) {
      await window.tag.delete(tag.id)
    }
  }

  return { content: parsed.content, references: parsed.references }
}
