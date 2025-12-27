import { describe, it, expect, beforeEach } from 'vitest'
import { CardService } from '../../domain/services/CardService'
import { MockCardRepository, MockTagRepository, MockRelationRepository } from '../mocks'

describe('CardService', () => {
    let cardService: CardService
    let cardRepo: MockCardRepository
    let tagRepo: MockTagRepository
    let relationRepo: MockRelationRepository
    const projectId = 1 // 默认项目 ID

    beforeEach(() => {
        cardRepo = new MockCardRepository()
        tagRepo = new MockTagRepository()
        relationRepo = new MockRelationRepository()
        cardService = new CardService(cardRepo, tagRepo, relationRepo)
    })

    describe('create', () => {
        it('should create a card with content', () => {
            const card = cardService.create({ projectId, content: '# Hello\nThis is a test' })

            expect(card.id).toBe(1)
            expect(card.content).toBe('# Hello\nThis is a test')
            expect(card.title).toBeTruthy()
            expect(card.createdAt).toBeInstanceOf(Date)
            expect(card.updatedAt).toBeInstanceOf(Date)
        })

        it('should create a card with custom meta', () => {
            const card = cardService.create({
                projectId,
                content: 'Test content',
                meta: {
                    title: 'Custom Title',
                    summary: 'Custom Summary',
                },
            })

            expect(card.title).toBe('Custom Title')
            expect(card.summary).toBe('Custom Summary')
        })

        it('should increment card id', () => {
            const card1 = cardService.create({ projectId, content: 'Card 1' })
            const card2 = cardService.create({ projectId, content: 'Card 2' })

            expect(card1.id).toBe(1)
            expect(card2.id).toBe(2)
        })
    })

    describe('getById', () => {
        it('should return card by id', () => {
            const created = cardService.create({ projectId, content: 'Test' })
            const found = cardService.getById(created.id)

            expect(found).toBeDefined()
            expect(found!.id).toBe(created.id)
            expect(found!.content).toBe('Test')
        })

        it('should return undefined for non-existent id', () => {
            const found = cardService.getById(999)
            expect(found).toBeUndefined()
        })
    })

    describe('getListByProject', () => {
        it('should return empty list when no cards', () => {
            const list = cardService.getListByProject(projectId)
            expect(list).toHaveLength(0)
        })

        it('should return all cards without content', () => {
            cardService.create({ projectId, content: 'Card 1' })
            cardService.create({ projectId, content: 'Card 2' })

            const list = cardService.getListByProject(projectId)

            expect(list).toHaveLength(2)
            // CardListItem 不包含 content
            expect((list[0] as any).content).toBeUndefined()
        })
    })

    describe('update', () => {
        it('should update card content', () => {
            const created = cardService.create({ projectId, content: 'Original' })
            const updated = cardService.update(created.id, { content: 'Updated' })

            expect(updated).toBeDefined()
            expect(updated!.content).toBe('Updated')
            expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime())
        })

        it('should return undefined for non-existent card', () => {
            const updated = cardService.update(999, { content: 'Test' })
            expect(updated).toBeUndefined()
        })
    })

    describe('updateMeta', () => {
        it('should update card meta', () => {
            const created = cardService.create({ projectId, content: 'Test' })
            const meta = cardService.updateMeta(created.id, { summary: 'New Summary' })

            expect(meta).toBeDefined()
            expect(meta!.summary).toBe('New Summary')
        })
    })

    describe('delete', () => {
        it('should delete card and its relations', () => {
            const card = cardService.create({ projectId, content: 'Test' })
            const tag = tagRepo.create({ projectId, name: 'Tag1' })

            // 添加关系
            cardService.addTag(card.id, tag.id)

            // 删除卡片
            const result = cardService.delete(card.id)

            expect(result).toBe(true)
            expect(cardService.getById(card.id)).toBeUndefined()
            // 关系也应该被删除
            expect(relationRepo.getAll()).toHaveLength(0)
        })

        it('should return false for non-existent card', () => {
            const result = cardService.delete(999)
            expect(result).toBe(false)
        })
    })

    describe('tag operations', () => {
        it('should add tag to card', () => {
            const card = cardService.create({ projectId, content: 'Test' })
            const tag = tagRepo.create({ projectId, name: 'Tag1' })

            const result = cardService.addTag(card.id, tag.id)

            expect(result).toBe(true)
            const tags = cardService.getTagsForCard(card.id)
            expect(tags).toHaveLength(1)
            expect(tags[0].name).toBe('Tag1')
        })

        it('should not duplicate tag', () => {
            const card = cardService.create({ projectId, content: 'Test' })
            const tag = tagRepo.create({ projectId, name: 'Tag1' })

            cardService.addTag(card.id, tag.id)
            cardService.addTag(card.id, tag.id) // 重复添加

            const tags = cardService.getTagsForCard(card.id)
            expect(tags).toHaveLength(1)
        })

        it('should remove tag from card', () => {
            const card = cardService.create({ projectId, content: 'Test' })
            const tag = tagRepo.create({ projectId, name: 'Tag1' })

            cardService.addTag(card.id, tag.id)
            const result = cardService.removeTag(card.id, tag.id)

            expect(result).toBe(true)
            const tags = cardService.getTagsForCard(card.id)
            expect(tags).toHaveLength(0)
        })

        it('should return false when removing non-existent tag', () => {
            const card = cardService.create({ projectId, content: 'Test' })
            const result = cardService.removeTag(card.id, 999)
            expect(result).toBe(false)
        })
    })

    describe('reference operations', () => {
        it('should add reference between cards', () => {
            const card1 = cardService.create({ projectId, content: 'Card 1' })
            const card2 = cardService.create({ projectId, content: 'Card 2' })

            const result = cardService.addReference(card1.id, card2.id)

            expect(result).toBe(true)
            const referenced = cardService.getReferencedCards(card1.id)
            expect(referenced).toHaveLength(1)
            expect(referenced[0].id).toBe(card2.id)
        })

        it('should not allow self-reference', () => {
            const card = cardService.create({ projectId, content: 'Test' })
            const result = cardService.addReference(card.id, card.id)
            expect(result).toBe(false)
        })

        it('should get referencing cards (backlinks)', () => {
            const card1 = cardService.create({ projectId, content: 'Card 1' })
            const card2 = cardService.create({ projectId, content: 'Card 2' })

            cardService.addReference(card1.id, card2.id)

            const referencing = cardService.getReferencingCards(card2.id)
            expect(referencing).toHaveLength(1)
            expect(referencing[0].id).toBe(card1.id)
        })
    })

    describe('filter by tags', () => {
        it('should get cards by single tag', () => {
            const card1 = cardService.create({ projectId, content: 'Card 1' })
            const card2 = cardService.create({ projectId, content: 'Card 2' })
            const tag = tagRepo.create({ projectId, name: 'Tag1' })

            cardService.addTag(card1.id, tag.id)

            const cards = cardService.getCardsByTag(tag.id)
            expect(cards).toHaveLength(1)
            expect(cards[0].id).toBe(card1.id)
        })

        it('should get cards by multiple tags (AND logic)', () => {
            const card1 = cardService.create({ projectId, content: 'Card 1' })
            const card2 = cardService.create({ projectId, content: 'Card 2' })
            const tag1 = tagRepo.create({ projectId, name: 'Tag1' })
            const tag2 = tagRepo.create({ projectId, name: 'Tag2' })

            cardService.addTag(card1.id, tag1.id)
            cardService.addTag(card1.id, tag2.id)
            cardService.addTag(card2.id, tag1.id)

            // card1 有两个标签，card2 只有一个
            const cards = cardService.getCardsByTags([tag1.id, tag2.id])
            expect(cards).toHaveLength(1)
            expect(cards[0].id).toBe(card1.id)
        })

        it('should return empty for non-matching tags', () => {
            const card = cardService.create({ projectId, content: 'Card' })
            const tag1 = tagRepo.create({ projectId, name: 'Tag1' })
            const tag2 = tagRepo.create({ projectId, name: 'Tag2' })

            cardService.addTag(card.id, tag1.id)

            const cards = cardService.getCardsByTags([tag1.id, tag2.id])
            expect(cards).toHaveLength(0)
        })
    })
})
