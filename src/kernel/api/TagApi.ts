import { TagService } from '../domain/services/TagService'
import type { TagWithMeta, TagMeta, UpdateTagInput, UpdateTagMetaInput } from '../domain/entities/Tag'
import { Result, ok, err } from './Result'

/**
 * 标签 API - 对外暴露的标签能力
 */
export class TagApi {
    constructor(private tagService: TagService) { }

    /**
     * 创建标签
     */
    create(
        projectId: number,
        name: string,
        color?: string,
        meta?: Partial<Omit<TagMeta, 'tagId'>>,
        namespace: string = 'user'
    ): Result<TagWithMeta> {
        if (!name.trim()) {
            return err('Tag name cannot be empty')
        }

        // 检查是否已存在
        const existing = this.tagService.getByName(projectId, name, namespace)
        if (existing) {
            return err(`Tag already exists: ${name}`)
        }

        try {
            const tag = this.tagService.create(projectId, name, color, meta, namespace)
            return ok(tag)
        } catch (e) {
            return err(`Failed to create tag: ${e}`)
        }
    }

    /**
     * 获取标签
     */
    getById(id: number): Result<TagWithMeta> {
        const tag = this.tagService.getById(id)
        if (!tag) {
            return err(`Tag not found: ${id}`)
        }
        return ok(tag)
    }

    /**
     * 根据项目和名称获取标签
     */
    getByName(projectId: number, name: string, namespace: string = 'user'): Result<TagWithMeta> {
        const tag = this.tagService.getByName(projectId, name, namespace)
        if (!tag) {
            return err(`Tag not found: ${name}`)
        }
        return ok(tag)
    }

    /**
     * 获取或创建标签
     */
    getOrCreate(projectId: number, name: string, color?: string): Result<TagWithMeta> {
        if (!name.trim()) {
            return err('Tag name cannot be empty')
        }

        try {
            const tag = this.tagService.getOrCreate(projectId, name, color)
            return ok(tag)
        } catch (e) {
            return err(`Failed to get or create tag: ${e}`)
        }
    }

    /**
     * 获取项目下所有用户标签
     */
    getAllUserTags(projectId: number): Result<TagWithMeta[]> {
        try {
            const tags = this.tagService.getAllUserTags(projectId)
            return ok(tags)
        } catch (e) {
            return err(`Failed to get tags: ${e}`)
        }
    }

    /**
     * 更新标签
     */
    update(id: number, input: UpdateTagInput): Result<TagWithMeta> {
        const tag = this.tagService.update(id, input)
        if (!tag) {
            return err(`Tag not found: ${id}`)
        }
        return ok(tag)
    }

    /**
     * 更新标签元信息
     */
    updateMeta(tagId: number, meta: UpdateTagMetaInput): Result<TagMeta> {
        const result = this.tagService.updateMeta(tagId, meta)
        if (!result) {
            return err(`Tag not found: ${tagId}`)
        }
        return ok(result)
    }

    /**
     * 删除标签
     */
    delete(id: number): Result<boolean> {
        const success = this.tagService.delete(id)
        if (!success) {
            return err(`Tag not found: ${id}`)
        }
        return ok(true)
    }

    /**
     * 合并标签
     */
    merge(sourceTagId: number, targetTagId: number): Result<boolean> {
        if (sourceTagId === targetTagId) {
            return err('Cannot merge tag with itself')
        }

        const success = this.tagService.merge(sourceTagId, targetTagId)
        if (!success) {
            return err('Tag not found')
        }
        return ok(true)
    }

    /**
     * 获取标签使用次数
     */
    getUsageCount(tagId: number): Result<number> {
        try {
            const count = this.tagService.getUsageCount(tagId)
            return ok(count)
        } catch (e) {
            return err(`Failed to get usage count: ${e}`)
        }
    }

    /**
     * 获取项目下所有标签及使用次数
     */
    getAllWithUsageCount(projectId: number): Result<Array<TagWithMeta & { usageCount: number }>> {
        try {
            const tags = this.tagService.getAllWithUsageCount(projectId)
            return ok(tags)
        } catch (e) {
            return err(`Failed to get tags with usage count: ${e}`)
        }
    }
}
