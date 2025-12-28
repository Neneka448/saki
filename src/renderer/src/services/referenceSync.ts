import type { CardListItem, TagWithMeta } from '../../../shared/ipc/types'
import { normalizeCardReferences, REFERENCE_NAMESPACE, REFERENCE_META_TYPE, type CardReferenceToken } from '../utils/referenceUtils'

interface CardReferenceMeta {
  type: string
  refId: string
  sourceCardId: number
  targetCardId: number
  titleSnapshot: string
  placeholder: string
}

interface ExistingRefTag {
  tag: TagWithMeta
  refId: string
}

/**
 * 构建标题到卡片的映射，用于引用解析
 * 如果存在重名标题，则该标题对应 null（无法解析）
 */
const buildTitleMap = (cards: CardListItem[], sourceCardId: number): Map<string, CardListItem | null> => {
  const map = new Map<string, CardListItem | null>()
  for (const card of cards) {
    if (!card.title || card.id === sourceCardId) continue
    const key = card.title.trim()
    if (!key) continue
    // 重名时设为 null，表示无法唯一解析
    map.set(key, map.has(key) ? null : card)
  }
  return map
}

/**
 * 从标签的 extra 字段提取 refId
 */
const getTagRefId = (extra: Record<string, unknown> | null): string | null => {
  if (!extra) return null
  const refId = extra.refId
  return typeof refId === 'string' && refId.trim() ? refId : null
}

/**
 * 构建标签名称：优先使用 placeholder，否则使用标题
 */
const buildTagName = (placeholder: string, title: string): string => {
  return placeholder.trim() || title.trim() || 'card-ref'
}

/**
 * 构建引用的元数据
 */
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

interface ExtractResult {
  withRefId: ExistingRefTag[]
  orphaned: TagWithMeta[]  // 没有 refId 的系统标签，需要清理
}

/**
 * 提取现有的引用标签
 * - withRefId: 有 refId 的标签，可以匹配更新或删除
 * - orphaned: 没有 refId 的系统标签（脏数据），需要直接删除
 */
const extractExistingRefTags = (tags: TagWithMeta[]): ExtractResult => {
  const withRefId: ExistingRefTag[] = []
  const orphaned: TagWithMeta[] = []

  for (const tag of tags) {
    if (tag.namespace !== REFERENCE_NAMESPACE) continue
    const refId = getTagRefId(tag.extra)
    if (refId) {
      withRefId.push({ tag, refId })
    } else {
      orphaned.push(tag)
    }
  }
  return { withRefId, orphaned }
}

/**
 * 同步卡片内容中的引用到系统标签
 * - 解析内容中的引用
 * - 为可解析的引用创建/更新系统标签
 * - 删除不再使用的系统标签
 */
export const syncCardReferences = async (
  cardId: number,
  projectId: number,
  content: string
): Promise<{ content: string; references: CardReferenceToken[] }> => {
  const parsed = normalizeCardReferences(content)

  // 并行获取卡片列表和现有标签
  const [listResult, tagsResult] = await Promise.all([
    window.card.getListByProject(projectId),
    window.card.getTags(cardId),
  ])

  if (!listResult.success) {
    return { content: parsed.content, references: parsed.references }
  }

  const titleMap = buildTitleMap(listResult.data, cardId)
  const { withRefId: existingRefTags, orphaned: orphanedTags } = extractExistingRefTags(
    tagsResult.success ? tagsResult.data : []
  )
  const existingByRefId = new Map(existingRefTags.map(({ refId, tag }) => [refId, tag]))

  // 收集需要执行的操作
  const createOps: Array<{ token: CardReferenceToken; targetId: number }> = []
  const updateOps: Array<{ tag: TagWithMeta; tagName: string; meta: CardReferenceMeta }> = []
  const keepRefIds = new Set<string>()

  for (const token of parsed.references) {
    const target = titleMap.get(token.title.trim())
    // 目标不存在或重名无法解析时，跳过但不保留该 refId（会被删除）
    if (!target) continue

    keepRefIds.add(token.refId)
    const tagName = buildTagName(token.placeholder, token.title)
    const meta = buildMeta(token, cardId, target.id)
    const existing = existingByRefId.get(token.refId)

    if (existing) {
      updateOps.push({ tag: existing, tagName, meta })
    } else {
      createOps.push({ token, targetId: target.id })
    }
  }

  // 并行执行更新操作
  await Promise.all(
    updateOps.map(async ({ tag, tagName, meta }) => {
      const promises: Promise<unknown>[] = []
      if (tag.name !== tagName) {
        promises.push(window.tag.update({ id: tag.id, name: tagName }))
      }
      promises.push(window.tag.updateMeta({ tagId: tag.id, meta: { extra: meta } }))
      await Promise.all(promises)
    })
  )

  // 并行执行创建操作
  await Promise.all(
    createOps.map(async ({ token, targetId }) => {
      const tagName = buildTagName(token.placeholder, token.title)
      const meta = buildMeta(token, cardId, targetId)
      const tagResult = await window.tag.create({
        projectId,
        name: tagName,
        namespace: REFERENCE_NAMESPACE,
        meta: { extra: meta },
      })
      if (tagResult.success) {
        await window.card.addTag(cardId, tagResult.data.id)
      }
    })
  )

  // 删除不再使用的标签（refId 不在 keepRefIds 中的）以及没有 refId 的脏数据
  const deleteOps = [
    ...existingRefTags
      .filter(({ refId }) => !keepRefIds.has(refId))
      .map(({ tag }) => window.tag.delete(tag.id)),
    ...orphanedTags.map((tag) => window.tag.delete(tag.id)),
  ]

  await Promise.all(deleteOps)

  return { content: parsed.content, references: parsed.references }
}
