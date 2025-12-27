import { describe, it, expect, beforeEach } from 'vitest'
import { RelationService } from '../../domain/services/RelationService'
import { MockRelationRepository } from '../mocks'

describe('RelationService', () => {
    let relationService: RelationService
    let relationRepo: MockRelationRepository

    beforeEach(() => {
        relationRepo = new MockRelationRepository()
        relationService = new RelationService(relationRepo)
    })

    describe('create', () => {
        it('should create a relation', () => {
            const relation = relationService.create({
                sourceId: 1,
                sourceType: 'card',
                targetId: 2,
                targetType: 'tag',
                relationType: 'tagged',
            })

            expect(relation.id).toBe(1)
            expect(relation.sourceId).toBe(1)
            expect(relation.sourceType).toBe('card')
            expect(relation.targetId).toBe(2)
            expect(relation.targetType).toBe('tag')
            expect(relation.relationType).toBe('tagged')
            expect(relation.createdAt).toBeInstanceOf(Date)
        })

        it('should create relation with meta', () => {
            const relation = relationService.create({
                sourceId: 1,
                sourceType: 'card',
                targetId: 2,
                targetType: 'card',
                relationType: 'references',
                meta: { context: 'some context' },
            })

            expect(relation.meta).toEqual({ context: 'some context' })
        })
    })

    describe('getById', () => {
        it('should return relation by id', () => {
            const created = relationService.create({
                sourceId: 1,
                sourceType: 'card',
                targetId: 2,
                targetType: 'tag',
                relationType: 'tagged',
            })

            const found = relationService.getById(created.id)

            expect(found).toBeDefined()
            expect(found!.id).toBe(created.id)
        })

        it('should return undefined for non-existent id', () => {
            const found = relationService.getById(999)
            expect(found).toBeUndefined()
        })
    })

    describe('find', () => {
        beforeEach(() => {
            // 创建一些测试数据
            relationService.create({
                sourceId: 1,
                sourceType: 'card',
                targetId: 1,
                targetType: 'tag',
                relationType: 'tagged',
            })
            relationService.create({
                sourceId: 1,
                sourceType: 'card',
                targetId: 2,
                targetType: 'tag',
                relationType: 'tagged',
            })
            relationService.create({
                sourceId: 2,
                sourceType: 'card',
                targetId: 1,
                targetType: 'tag',
                relationType: 'tagged',
            })
            relationService.create({
                sourceId: 1,
                sourceType: 'card',
                targetId: 2,
                targetType: 'card',
                relationType: 'references',
            })
        })

        it('should find by sourceId', () => {
            const relations = relationService.find({ sourceId: 1 })
            expect(relations).toHaveLength(3)
        })

        it('should find by sourceType', () => {
            const relations = relationService.find({ sourceType: 'card' })
            expect(relations).toHaveLength(4)
        })

        it('should find by targetId', () => {
            const relations = relationService.find({ targetId: 1 })
            expect(relations).toHaveLength(2)
        })

        it('should find by relationType', () => {
            const relations = relationService.find({ relationType: 'tagged' })
            expect(relations).toHaveLength(3)
        })

        it('should find by multiple criteria', () => {
            const relations = relationService.find({
                sourceId: 1,
                sourceType: 'card',
                relationType: 'tagged',
            })
            expect(relations).toHaveLength(2)
        })

        it('should return all when no criteria', () => {
            const relations = relationService.find({})
            expect(relations).toHaveLength(4)
        })
    })

    describe('delete', () => {
        it('should delete relation', () => {
            const relation = relationService.create({
                sourceId: 1,
                sourceType: 'card',
                targetId: 1,
                targetType: 'tag',
                relationType: 'tagged',
            })

            const result = relationService.delete(relation.id)

            expect(result).toBe(true)
            expect(relationService.getById(relation.id)).toBeUndefined()
        })

        it('should return false for non-existent relation', () => {
            const result = relationService.delete(999)
            expect(result).toBe(false)
        })
    })

    describe('exists', () => {
        it('should return true when relation exists', () => {
            relationService.create({
                sourceId: 1,
                sourceType: 'card',
                targetId: 1,
                targetType: 'tag',
                relationType: 'tagged',
            })

            const exists = relationService.exists(1, 'card', 1, 'tag', 'tagged')
            expect(exists).toBe(true)
        })

        it('should return false when relation does not exist', () => {
            const exists = relationService.exists(1, 'card', 1, 'tag', 'tagged')
            expect(exists).toBe(false)
        })
    })

    describe('getOutgoing', () => {
        it('should get all outgoing relations for entity', () => {
            relationService.create({
                sourceId: 1,
                sourceType: 'card',
                targetId: 1,
                targetType: 'tag',
                relationType: 'tagged',
            })
            relationService.create({
                sourceId: 1,
                sourceType: 'card',
                targetId: 2,
                targetType: 'card',
                relationType: 'references',
            })
            relationService.create({
                sourceId: 2,
                sourceType: 'card',
                targetId: 1,
                targetType: 'card',
                relationType: 'references',
            })

            const outgoing = relationService.getOutgoing(1, 'card')

            expect(outgoing).toHaveLength(2)
        })
    })

    describe('getIncoming', () => {
        it('should get all incoming relations for entity', () => {
            relationService.create({
                sourceId: 1,
                sourceType: 'card',
                targetId: 2,
                targetType: 'card',
                relationType: 'references',
            })
            relationService.create({
                sourceId: 3,
                sourceType: 'card',
                targetId: 2,
                targetType: 'card',
                relationType: 'references',
            })

            const incoming = relationService.getIncoming(2, 'card')

            expect(incoming).toHaveLength(2)
        })
    })
})
