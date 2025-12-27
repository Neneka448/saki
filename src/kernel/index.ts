import { DatabaseManager } from './infrastructure/persistence/database'
import { DrizzleCardRepository, DrizzleTagRepository, DrizzleRelationRepository } from './infrastructure/persistence/repositories'
import { DrizzleProjectRepository } from './infrastructure/persistence/repositories/DrizzleProjectRepository'
import { CardService, TagService, RelationService } from './domain/services'
import { ProjectService } from './domain/services/ProjectService'
import { CardApi, TagApi, RelationApi, ProjectApi } from './api'

/**
 * Kernel API 接口
 */
export interface KernelApi {
    project: ProjectApi
    card: CardApi
    tag: TagApi
    relation: RelationApi
    close: () => void
}

/**
 * Kernel 配置
 */
export interface KernelConfig {
    dbPath: string
}

/**
 * 创建 Kernel 实例
 *
 * @example
 * ```typescript
 * const kernel = createKernel({ dbPath: '/path/to/knowledge.db' })
 *
 * // 创建项目
 * const project = kernel.project.create({ name: 'My Project' })
 *
 * // 在项目下创建卡片
 * const result = kernel.card.create(project.data.id, 'Hello World')
 * if (result.success) {
 *   console.log(result.data)
 * }
 *
 * // 关闭
 * kernel.close()
 * ```
 */
export function createKernel(config: KernelConfig): KernelApi {
    // 1. 初始化基础设施
    const dbManager = new DatabaseManager(config.dbPath)
    const db = dbManager.init()

    // 2. 创建仓储实现
    const projectRepo = new DrizzleProjectRepository(db)
    const cardRepo = new DrizzleCardRepository(db)
    const tagRepo = new DrizzleTagRepository(db)
    const relationRepo = new DrizzleRelationRepository(db)

    // 3. 创建领域服务
    const projectService = new ProjectService(projectRepo)
    const cardService = new CardService(cardRepo, tagRepo, relationRepo)
    const tagService = new TagService(tagRepo, relationRepo)
    const relationService = new RelationService(relationRepo)

    // 4. 创建 API 层
    const projectApi = new ProjectApi(projectService)
    const cardApi = new CardApi(cardService)
    const tagApi = new TagApi(tagService)
    const relationApi = new RelationApi(relationService)

    return {
        project: projectApi,
        card: cardApi,
        tag: tagApi,
        relation: relationApi,
        close: () => dbManager.close(),
    }
}

// 导出类型和工具
export * from './domain/entities'
export * from './api/Result'
export type { ProjectApi, CardApi, TagApi, RelationApi }
