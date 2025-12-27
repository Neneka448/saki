import type { Tag, TagWithMeta, TagMeta, CreateTagInput, UpdateTagInput, UpdateTagMetaInput } from '../entities/Tag'

/**
 * 标签仓储接口 - 定义数据访问契约
 * 具体实现由 Infrastructure 层提供
 */
export interface ITagRepository {
    /**
     * 创建标签
     */
    create(input: CreateTagInput): TagWithMeta

    /**
     * 根据 ID 获取标签
     */
    getById(id: number): TagWithMeta | undefined

    /**
     * 根据项目、名称和命名空间获取标签
     */
    getByName(projectId: number, name: string, namespace?: string): TagWithMeta | undefined

    /**
     * 获取项目下所有用户标签
     */
    getAllUserTags(projectId: number): TagWithMeta[]

    /**
     * 获取项目下指定命名空间的所有标签
     */
    getByNamespace(projectId: number, namespace: string): TagWithMeta[]

    /**
     * 更新标签
     */
    update(id: number, input: UpdateTagInput): Tag | undefined

    /**
     * 更新标签元信息
     */
    updateMeta(tagId: number, meta: UpdateTagMetaInput): TagMeta | undefined

    /**
     * 删除标签
     */
    delete(id: number): boolean

    /**
     * 删除项目下所有标签
     */
    deleteByProject(projectId: number): number
}
