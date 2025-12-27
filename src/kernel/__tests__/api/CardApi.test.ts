import { describe, it, expect, beforeEach } from 'vitest'
import { CardApi } from '../../api/CardApi'
import { CardService } from '../../domain/services/CardService'
import { MockCardRepository, MockTagRepository, MockRelationRepository } from '../mocks'

describe('CardApi', () => {
    let cardApi: CardApi
    let cardRepo: MockCardRepository
    let tagRepo: MockTagRepository
    let relationRepo: MockRelationRepository
    const projectId = 1 // 默认项目 ID

    beforeEach(() => {
        cardRepo = new MockCardRepository()
        tagRepo = new MockTagRepository()
        relationRepo = new MockRelationRepository()
        const cardService = new CardService(cardRepo, tagRepo, relationRepo)
        cardApi = new CardApi(cardService)
    })

    describe('create', () => {
        it('should return success result when creating card', () => {
            const result = cardApi.create(projectId, 'Test content')

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.id).toBe(1)
                expect(result.data.content).toBe('Test content')
            }
        })

        it('should return error when content is empty', () => {
            const result = cardApi.create(projectId, '')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toContain('empty')
            }
        })

        it('should return error when content is whitespace only', () => {
            const result = cardApi.create(projectId, '   ')

            expect(result.success).toBe(false)
        })
    })

    describe('getById', () => {
        it('should return success when card exists', () => {
            cardApi.create(projectId, 'Test')
            const result = cardApi.getById(1)

            expect(result.success).toBe(true)
        })

        it('should return error when card not found', () => {
            const result = cardApi.getById(999)

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toContain('not found')
            }
        })
    })

    describe('getListByProject', () => {
        it('should return success with card list', () => {
            cardApi.create(projectId, 'Card 1')
            cardApi.create(projectId, 'Card 2')

            const result = cardApi.getListByProject(projectId)

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data).toHaveLength(2)
            }
        })
    })

    describe('update', () => {
        it('should return success when updating existing card', () => {
            cardApi.create(projectId, 'Original')
            const result = cardApi.update(1, 'Updated')

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.content).toBe('Updated')
            }
        })

        it('should return error when content is empty', () => {
            cardApi.create(projectId, 'Original')
            const result = cardApi.update(1, '')

            expect(result.success).toBe(false)
        })

        it('should return error when card not found', () => {
            const result = cardApi.update(999, 'Test')

            expect(result.success).toBe(false)
        })
    })

    describe('delete', () => {
        it('should return success when deleting existing card', () => {
            cardApi.create(projectId, 'Test')
            const result = cardApi.delete(1)

            expect(result.success).toBe(true)
        })

        it('should return error when card not found', () => {
            const result = cardApi.delete(999)

            expect(result.success).toBe(false)
        })
    })

    describe('addTag', () => {
        it('should return success when adding tag to card', () => {
            cardApi.create(projectId, 'Test')
            tagRepo.create({ projectId, name: 'Tag1' })

            const result = cardApi.addTag(1, 1)

            expect(result.success).toBe(true)
        })

        it('should return error when card or tag not found', () => {
            cardApi.create(projectId, 'Test')
            const result = cardApi.addTag(1, 999)

            expect(result.success).toBe(false)
        })
    })

    describe('addReference', () => {
        it('should return success when adding reference', () => {
            cardApi.create(projectId, 'Card 1')
            cardApi.create(projectId, 'Card 2')

            const result = cardApi.addReference(1, 2)

            expect(result.success).toBe(true)
        })

        it('should return error when referencing self', () => {
            cardApi.create(projectId, 'Card 1')

            const result = cardApi.addReference(1, 1)

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toContain('self')
            }
        })
    })

    describe('getCardsByTags', () => {
        it('should return cards matching all tags', () => {
            cardApi.create(projectId, 'Card 1')
            cardApi.create(projectId, 'Card 2')
            const tag1 = tagRepo.create({ projectId, name: 'Tag1' })
            const tag2 = tagRepo.create({ projectId, name: 'Tag2' })

            cardApi.addTag(1, tag1.id)
            cardApi.addTag(1, tag2.id)
            cardApi.addTag(2, tag1.id)

            const result = cardApi.getCardsByTags([tag1.id, tag2.id])

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data).toHaveLength(1)
                expect(result.data[0].id).toBe(1)
            }
        })
    })
})
