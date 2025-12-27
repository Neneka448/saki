import { describe, it, expect, beforeEach } from 'vitest'
import { TagService } from '../../domain/services/TagService'
import { MockTagRepository, MockRelationRepository } from '../mocks'

describe('TagService', () => {
    let tagService: TagService
    let tagRepo: MockTagRepository
    let relationRepo: MockRelationRepository
    const projectId = 1 // 默认项目 ID

    beforeEach(() => {
        tagRepo = new MockTagRepository()
        relationRepo = new MockRelationRepository()
        tagService = new TagService(tagRepo, relationRepo)
    })

    describe('create', () => {
        it('should create a tag with name', () => {
            const tag = tagService.create(projectId, '学习笔记')

            expect(tag.id).toBe(1)
            expect(tag.name).toBe('学习笔记')
            expect(tag.namespace).toBe('user')
            expect(tag.createdAt).toBeInstanceOf(Date)
        })

        it('should create a tag with color', () => {
            const tag = tagService.create(projectId, '重要', '#ff0000')

            expect(tag.name).toBe('重要')
            expect(tag.color).toBe('#ff0000')
        })

        it('should create a tag with meta', () => {
            const tag = tagService.create(projectId, '技术', undefined, { description: '技术相关笔记' })

            expect(tag.description).toBe('技术相关笔记')
        })
    })

    describe('getById', () => {
        it('should return tag by id', () => {
            const created = tagService.create(projectId, 'Test')
            const found = tagService.getById(created.id)

            expect(found).toBeDefined()
            expect(found!.name).toBe('Test')
        })

        it('should return undefined for non-existent id', () => {
            const found = tagService.getById(999)
            expect(found).toBeUndefined()
        })
    })

    describe('getByName', () => {
        it('should return tag by name', () => {
            tagService.create(projectId, 'MyTag')
            const found = tagService.getByName(projectId, 'MyTag')

            expect(found).toBeDefined()
            expect(found!.name).toBe('MyTag')
        })

        it('should return undefined for non-existent name', () => {
            const found = tagService.getByName(projectId, 'NonExistent')
            expect(found).toBeUndefined()
        })
    })

    describe('getOrCreate', () => {
        it('should return existing tag', () => {
            const created = tagService.create(projectId, 'Existing')
            const found = tagService.getOrCreate(projectId, 'Existing')

            expect(found.id).toBe(created.id)
        })

        it('should create new tag if not exists', () => {
            const tag = tagService.getOrCreate(projectId, 'NewTag', '#00ff00')

            expect(tag.name).toBe('NewTag')
            expect(tag.color).toBe('#00ff00')
        })
    })

    describe('getAllUserTags', () => {
        it('should return all user tags', () => {
            tagService.create(projectId, 'Tag1')
            tagService.create(projectId, 'Tag2')

            const tags = tagService.getAllUserTags(projectId)

            expect(tags).toHaveLength(2)
        })

        it('should not return system tags', () => {
            tagService.create(projectId, 'UserTag')
            // 直接通过 repo 创建系统标签
            tagRepo.create({ projectId, name: 'SystemTag', namespace: 'system:status' })

            const userTags = tagService.getAllUserTags(projectId)

            expect(userTags).toHaveLength(1)
            expect(userTags[0].name).toBe('UserTag')
        })
    })

    describe('update', () => {
        it('should update tag name', () => {
            const created = tagService.create(projectId, 'Original')
            const updated = tagService.update(created.id, { name: 'Updated' })

            expect(updated).toBeDefined()
            expect(updated!.name).toBe('Updated')
        })

        it('should update tag color', () => {
            const created = tagService.create(projectId, 'Test', '#000000')
            const updated = tagService.update(created.id, { color: '#ffffff' })

            expect(updated!.color).toBe('#ffffff')
        })

        it('should return undefined for non-existent tag', () => {
            const updated = tagService.update(999, { name: 'Test' })
            expect(updated).toBeUndefined()
        })
    })

    describe('updateMeta', () => {
        it('should update tag meta', () => {
            const created = tagService.create(projectId, 'Test')
            const meta = tagService.updateMeta(created.id, { description: 'New Description' })

            expect(meta).toBeDefined()
            expect(meta!.description).toBe('New Description')
        })
    })

    describe('delete', () => {
        it('should delete tag', () => {
            const tag = tagService.create(projectId, 'ToDelete')
            const result = tagService.delete(tag.id)

            expect(result).toBe(true)
            expect(tagService.getById(tag.id)).toBeUndefined()
        })

        it('should delete related relations', () => {
            const tag = tagService.create(projectId, 'Test')

            // 模拟一个卡片打上这个标签
            relationRepo.create({
                sourceId: 1,
                sourceType: 'card',
                targetId: tag.id,
                targetType: 'tag',
                relationType: 'tagged',
            })

            tagService.delete(tag.id)

            expect(relationRepo.getAll()).toHaveLength(0)
        })

        it('should return false for non-existent tag', () => {
            const result = tagService.delete(999)
            expect(result).toBe(false)
        })
    })

    describe('merge', () => {
        it('should merge source tag into target tag', () => {
            const sourceTag = tagService.create(projectId, 'Source')
            const targetTag = tagService.create(projectId, 'Target')

            // 模拟两张卡片分别打上这两个标签
            relationRepo.create({
                sourceId: 1,
                sourceType: 'card',
                targetId: sourceTag.id,
                targetType: 'tag',
                relationType: 'tagged',
            })
            relationRepo.create({
                sourceId: 2,
                sourceType: 'card',
                targetId: targetTag.id,
                targetType: 'tag',
                relationType: 'tagged',
            })

            const result = tagService.merge(sourceTag.id, targetTag.id)

            expect(result).toBe(true)
            // 源标签被删除
            expect(tagService.getById(sourceTag.id)).toBeUndefined()
            // 目标标签仍存在
            expect(tagService.getById(targetTag.id)).toBeDefined()
            // 关系应该被迁移
            const relations = relationRepo.find({ targetId: targetTag.id, relationType: 'tagged' })
            expect(relations).toHaveLength(2)
        })

        it('should not duplicate relations when merging', () => {
            const sourceTag = tagService.create(projectId, 'Source')
            const targetTag = tagService.create(projectId, 'Target')

            // 同一张卡片同时打上两个标签
            relationRepo.create({
                sourceId: 1,
                sourceType: 'card',
                targetId: sourceTag.id,
                targetType: 'tag',
                relationType: 'tagged',
            })
            relationRepo.create({
                sourceId: 1,
                sourceType: 'card',
                targetId: targetTag.id,
                targetType: 'tag',
                relationType: 'tagged',
            })

            tagService.merge(sourceTag.id, targetTag.id)

            // 合并后只有一条关系
            const relations = relationRepo.find({ targetId: targetTag.id, relationType: 'tagged' })
            expect(relations).toHaveLength(1)
        })

        it('should return false when source tag not found', () => {
            const targetTag = tagService.create(projectId, 'Target')
            const result = tagService.merge(999, targetTag.id)
            expect(result).toBe(false)
        })

        it('should return false when target tag not found', () => {
            const sourceTag = tagService.create(projectId, 'Source')
            const result = tagService.merge(sourceTag.id, 999)
            expect(result).toBe(false)
        })
    })

    describe('usage count', () => {
        it('should get usage count for tag', () => {
            const tag = tagService.create(projectId, 'Test')

            // 模拟 3 张卡片打上这个标签
            for (let i = 1; i <= 3; i++) {
                relationRepo.create({
                    sourceId: i,
                    sourceType: 'card',
                    targetId: tag.id,
                    targetType: 'tag',
                    relationType: 'tagged',
                })
            }

            const count = tagService.getUsageCount(tag.id)
            expect(count).toBe(3)
        })

        it('should get all tags with usage count', () => {
            const tag1 = tagService.create(projectId, 'Tag1')
            const tag2 = tagService.create(projectId, 'Tag2')

            relationRepo.create({
                sourceId: 1,
                sourceType: 'card',
                targetId: tag1.id,
                targetType: 'tag',
                relationType: 'tagged',
            })

            const tagsWithCount = tagService.getAllWithUsageCount(projectId)

            expect(tagsWithCount).toHaveLength(2)
            const t1 = tagsWithCount.find((t) => t.id === tag1.id)!
            const t2 = tagsWithCount.find((t) => t.id === tag2.id)!
            expect(t1.usageCount).toBe(1)
            expect(t2.usageCount).toBe(0)
        })
    })
})
