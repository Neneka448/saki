import type { ITagRepository } from '../../domain/repositories/ITagRepository'
import type { Tag, TagWithMeta, TagMeta, CreateTagInput, UpdateTagInput, UpdateTagMetaInput } from '../../domain/entities/Tag'

/**
 * Mock 标签仓储 - 用于单元测试
 */
export class MockTagRepository implements ITagRepository {
    private tags: Map<number, Tag> = new Map()
    private metas: Map<number, Omit<TagMeta, 'tagId'>> = new Map()
    private nextId = 1

    create(input: CreateTagInput): TagWithMeta {
        const id = this.nextId++
        const now = new Date()

        const tag: Tag = {
            id,
            projectId: input.projectId,
            name: input.name,
            namespace: input.namespace ?? 'user',
            color: input.color ?? null,
            createdAt: now,
        }
        this.tags.set(id, tag)

        const meta = {
            description: input.meta?.description ?? null,
            icon: input.meta?.icon ?? null,
            extra: input.meta?.extra ?? null,
        }
        if (input.meta) {
            this.metas.set(id, meta)
        }

        return { ...tag, ...meta }
    }

    getById(id: number): TagWithMeta | undefined {
        const tag = this.tags.get(id)
        if (!tag) return undefined

        const meta = this.metas.get(id) ?? { description: null, icon: null, extra: null }
        return { ...tag, ...meta }
    }

    getByName(projectId: number, name: string, namespace: string = 'user'): TagWithMeta | undefined {
        for (const [id, tag] of this.tags) {
            if (tag.projectId === projectId && tag.name === name && tag.namespace === namespace) {
                const meta = this.metas.get(id) ?? { description: null, icon: null, extra: null }
                return { ...tag, ...meta }
            }
        }
        return undefined
    }

    getAllUserTags(projectId: number): TagWithMeta[] {
        return this.getByNamespace(projectId, 'user')
    }

    getByNamespace(projectId: number, namespace: string): TagWithMeta[] {
        const result: TagWithMeta[] = []
        for (const [id, tag] of this.tags) {
            if (tag.projectId === projectId && tag.namespace === namespace) {
                const meta = this.metas.get(id) ?? { description: null, icon: null, extra: null }
                result.push({ ...tag, ...meta })
            }
        }
        return result
    }

    update(id: number, input: UpdateTagInput): Tag | undefined {
        const tag = this.tags.get(id)
        if (!tag) return undefined

        if (input.name !== undefined) tag.name = input.name
        if (input.color !== undefined) tag.color = input.color

        return tag
    }

    updateMeta(tagId: number, meta: UpdateTagMetaInput): TagMeta | undefined {
        if (!this.tags.has(tagId)) return undefined

        const existing = this.metas.get(tagId) ?? { description: null, icon: null, extra: null }
        const updated = { ...existing, ...meta }
        this.metas.set(tagId, updated)

        return { tagId, ...updated }
    }

    delete(id: number): boolean {
        if (!this.tags.has(id)) return false
        this.tags.delete(id)
        this.metas.delete(id)
        return true
    }

    deleteByProject(projectId: number): number {
        let count = 0
        for (const [id, tag] of this.tags) {
            if (tag.projectId === projectId) {
                this.tags.delete(id)
                this.metas.delete(id)
                count++
            }
        }
        return count
    }

    // 测试辅助方法
    clear(): void {
        this.tags.clear()
        this.metas.clear()
        this.nextId = 1
    }
}
