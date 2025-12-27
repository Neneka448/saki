import { describe, it, expect, beforeEach } from 'vitest'
import { TagApi } from '../../api/TagApi'
import { TagService } from '../../domain/services/TagService'
import { MockTagRepository, MockRelationRepository } from '../mocks'

describe('TagApi', () => {
    let tagApi: TagApi
    let tagRepo: MockTagRepository
    let relationRepo: MockRelationRepository
    const projectId = 1 // 默认项目 ID

    beforeEach(() => {
        tagRepo = new MockTagRepository()
        relationRepo = new MockRelationRepository()
        const tagService = new TagService(tagRepo, relationRepo)
        tagApi = new TagApi(tagService)
    })

    describe('create', () => {
        it('should return success when creating tag', () => {
            const result = tagApi.create(projectId, '学习笔记')

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.name).toBe('学习笔记')
            }
        })

        it('should return error when name is empty', () => {
            const result = tagApi.create(projectId, '')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toContain('empty')
            }
        })

        it('should return error when tag already exists', () => {
            tagApi.create(projectId, 'Existing')
            const result = tagApi.create(projectId, 'Existing')

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toContain('already exists')
            }
        })
    })

    describe('getById', () => {
        it('should return success when tag exists', () => {
            tagApi.create(projectId, 'Test')
            const result = tagApi.getById(1)

            expect(result.success).toBe(true)
        })

        it('should return error when tag not found', () => {
            const result = tagApi.getById(999)

            expect(result.success).toBe(false)
        })
    })

    describe('getByName', () => {
        it('should return success when tag exists', () => {
            tagApi.create(projectId, 'MyTag')
            const result = tagApi.getByName(projectId, 'MyTag')

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.name).toBe('MyTag')
            }
        })

        it('should return error when tag not found', () => {
            const result = tagApi.getByName(projectId, 'NonExistent')

            expect(result.success).toBe(false)
        })
    })

    describe('getOrCreate', () => {
        it('should return existing tag', () => {
            const created = tagApi.create(projectId, 'Existing')
            const result = tagApi.getOrCreate(projectId, 'Existing')

            expect(result.success).toBe(true)
            if (result.success && created.success) {
                expect(result.data.id).toBe(created.data.id)
            }
        })

        it('should create new tag if not exists', () => {
            const result = tagApi.getOrCreate(projectId, 'NewTag')

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.name).toBe('NewTag')
            }
        })

        it('should return error when name is empty', () => {
            const result = tagApi.getOrCreate(projectId, '')

            expect(result.success).toBe(false)
        })
    })

    describe('update', () => {
        it('should return success when updating existing tag', () => {
            tagApi.create(projectId, 'Original')
            const result = tagApi.update(1, { name: 'Updated' })

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.name).toBe('Updated')
            }
        })

        it('should return error when tag not found', () => {
            const result = tagApi.update(999, { name: 'Test' })

            expect(result.success).toBe(false)
        })
    })

    describe('delete', () => {
        it('should return success when deleting existing tag', () => {
            tagApi.create(projectId, 'ToDelete')
            const result = tagApi.delete(1)

            expect(result.success).toBe(true)
        })

        it('should return error when tag not found', () => {
            const result = tagApi.delete(999)

            expect(result.success).toBe(false)
        })
    })

    describe('merge', () => {
        it('should return success when merging tags', () => {
            tagApi.create(projectId, 'Source')
            tagApi.create(projectId, 'Target')

            const result = tagApi.merge(1, 2)

            expect(result.success).toBe(true)
        })

        it('should return error when merging with self', () => {
            tagApi.create(projectId, 'Test')

            const result = tagApi.merge(1, 1)

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toContain('itself')
            }
        })

        it('should return error when source tag not found', () => {
            tagApi.create(projectId, 'Target')

            const result = tagApi.merge(999, 1)

            expect(result.success).toBe(false)
        })
    })

    describe('getAllWithUsageCount', () => {
        it('should return all tags with usage count', () => {
            const tag1Result = tagApi.create(projectId, 'Tag1')
            tagApi.create(projectId, 'Tag2')

            if (tag1Result.success) {
                // 模拟使用
                relationRepo.create({
                    sourceId: 1,
                    sourceType: 'card',
                    targetId: tag1Result.data.id,
                    targetType: 'tag',
                    relationType: 'tagged',
                })
            }

            const result = tagApi.getAllWithUsageCount(projectId)

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data).toHaveLength(2)
                const t1 = result.data.find((t) => t.name === 'Tag1')!
                const t2 = result.data.find((t) => t.name === 'Tag2')!
                expect(t1.usageCount).toBe(1)
                expect(t2.usageCount).toBe(0)
            }
        })
    })
})
