import type { CardListItem, CardDetail, CardMeta, CreateCardInput, UpdateCardInput, UpdateCardMetaInput } from '../entities/Card'

/**
 * 卡片仓储接口 - 定义数据访问契约
 * 具体实现由 Infrastructure 层提供
 */
export interface ICardRepository {
    /**
     * 创建卡片
     */
    create(input: CreateCardInput): CardDetail

    /**
     * 根据 ID 获取卡片详情（含 content）
     */
    getById(id: number): CardDetail | undefined

    /**
     * 获取项目下的卡片列表（不含 content）
     */
    getListByProject(projectId: number): CardListItem[]

    /**
     * 更新卡片
     */
    update(id: number, input: UpdateCardInput): CardDetail | undefined

    /**
     * 仅更新元信息
     */
    updateMeta(cardId: number, meta: UpdateCardMetaInput): CardMeta | undefined

    /**
     * 删除卡片
     */
    delete(id: number): boolean

    /**
     * 获取项目下的卡片数量
     */
    countByProject(projectId: number): number

    /**
     * 删除项目下所有卡片
     */
    deleteByProject(projectId: number): number
}
