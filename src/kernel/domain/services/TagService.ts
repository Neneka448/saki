import type { ITagRepository } from '../repositories/ITagRepository'
import type { IRelationRepository } from '../repositories/IRelationRepository'
import type { TagWithMeta, TagMeta, CreateTagInput, UpdateTagInput, UpdateTagMetaInput } from '../entities/Tag'

/**
 * 标签领域服务
 * 处理标签相关的业务逻辑
 */
export class TagService {
    constructor(
        private tagRepo: ITagRepository,
        private relationRepo: IRelationRepository
    ) { }

    /**
     * 创建标签
     */
    create(
        projectId: number,
        name: string,
        color?: string,
        meta?: Partial<Omit<TagMeta, 'tagId'>>,
        namespace: string = 'user'
    ): TagWithMeta {
        return this.tagRepo.create({ projectId, name, namespace, color, meta })
    }

    /**
     * 获取标签
     */
    getById(id: number): TagWithMeta | undefined {
        return this.tagRepo.getById(id)
    }

    /**
     * 根据项目和名称获取标签
     */
    getByName(projectId: number, name: string, namespace: string = 'user'): TagWithMeta | undefined {
        return this.tagRepo.getByName(projectId, name, namespace)
    }

    /**
     * 获取或创建标签
     */
    getOrCreate(projectId: number, name: string, color?: string): TagWithMeta {
        const existing = this.tagRepo.getByName(projectId, name, 'user')
        if (existing) return existing
        return this.tagRepo.create({ projectId, name, namespace: 'user', color })
    }

    /**
     * 获取项目下所有用户标签
     */
    getAllUserTags(projectId: number): TagWithMeta[] {
        return this.tagRepo.getAllUserTags(projectId)
    }

    /**
     * 更新标签
     */
    update(id: number, input: UpdateTagInput): TagWithMeta | undefined {
        const result = this.tagRepo.update(id, input)
        if (!result) return undefined
        return this.tagRepo.getById(id)
    }

    /**
     * 更新标签元信息
     */
    updateMeta(tagId: number, meta: UpdateTagMetaInput): TagMeta | undefined {
        return this.tagRepo.updateMeta(tagId, meta)
    }

    /**
     * 删除标签
     */
    delete(id: number): boolean {
        this.relationRepo.deleteByTarget(id, 'tag')
        this.relationRepo.deleteBySource(id, 'tag')
        return this.tagRepo.delete(id)
    }

    /**
     * 合并标签
     */
    merge(sourceTagId: number, targetTagId: number): boolean {
        const sourceTag = this.tagRepo.getById(sourceTagId)
        const targetTag = this.tagRepo.getById(targetTagId)
        if (!sourceTag || !targetTag) return false

        const relations = this.relationRepo.find({
            targetId: sourceTagId,
            targetType: 'tag',
            relationType: 'tagged',
        })

        for (const rel of relations) {
            const exists = this.relationRepo.exists(
                rel.sourceId,
                rel.sourceType,
                targetTagId,
                'tag',
                'tagged'
            )

            if (!exists) {
                this.relationRepo.create({
                    sourceId: rel.sourceId,
                    sourceType: rel.sourceType,
                    targetId: targetTagId,
                    targetType: 'tag',
                    relationType: 'tagged',
                })
            }

            this.relationRepo.delete(rel.id)
        }

        return this.tagRepo.delete(sourceTagId)
    }

    /**
     * 获取标签使用次数
     */
    getUsageCount(tagId: number): number {
        const relations = this.relationRepo.find({
            targetId: tagId,
            targetType: 'tag',
            relationType: 'tagged',
        })
        return relations.length
    }

    /**
     * 获取项目下所有标签及使用次数
     */
    getAllWithUsageCount(projectId: number): Array<TagWithMeta & { usageCount: number }> {
        const tags = this.tagRepo.getAllUserTags(projectId)
        return tags.map((tag) => ({
            ...tag,
            usageCount: this.getUsageCount(tag.id),
        }))
    }
}
