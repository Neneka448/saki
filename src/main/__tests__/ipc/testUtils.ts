import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { KernelApi } from '../../../kernel'
import { ProjectApi } from '../../../kernel/api/ProjectApi'
import { CardApi } from '../../../kernel/api/CardApi'
import { TagApi } from '../../../kernel/api/TagApi'
import { RelationApi } from '../../../kernel/api/RelationApi'
import { ProjectService } from '../../../kernel/domain/services/ProjectService'
import { CardService } from '../../../kernel/domain/services/CardService'
import { TagService } from '../../../kernel/domain/services/TagService'
import { RelationService } from '../../../kernel/domain/services/RelationService'
import {
    MockCardRepository,
    MockTagRepository,
    MockRelationRepository,
} from '../../../kernel/__tests__/mocks'
import { MockProjectRepository } from './MockProjectRepository'

/**
 * 创建一个模拟的 Kernel 实例，用于测试 IPC handlers
 */
export function createMockKernel(): KernelApi & {
    _mocks: {
        projectRepo: MockProjectRepository
        cardRepo: MockCardRepository
        tagRepo: MockTagRepository
        relationRepo: MockRelationRepository
    }
} {
    const projectRepo = new MockProjectRepository()
    const cardRepo = new MockCardRepository()
    const tagRepo = new MockTagRepository()
    const relationRepo = new MockRelationRepository()

    const projectService = new ProjectService(projectRepo)
    const cardService = new CardService(cardRepo, tagRepo, relationRepo)
    const tagService = new TagService(tagRepo, relationRepo)
    const relationService = new RelationService(relationRepo)

    const projectApi = new ProjectApi(projectService)
    const cardApi = new CardApi(cardService)
    const tagApi = new TagApi(tagService)
    const relationApi = new RelationApi(relationService)

    return {
        project: projectApi,
        card: cardApi,
        tag: tagApi,
        relation: relationApi,
        close: vi.fn(),
        _mocks: {
            projectRepo,
            cardRepo,
            tagRepo,
            relationRepo,
        },
    }
}

/**
 * 模拟 ipcMain.handle
 */
export function createIpcMainMock() {
    const handlers = new Map<string, (...args: any[]) => any>()

    return {
        handle: (channel: string, handler: (...args: any[]) => any) => {
            handlers.set(channel, handler)
        },
        invoke: async (channel: string, ...args: any[]) => {
            const handler = handlers.get(channel)
            if (!handler) {
                throw new Error(`No handler for channel: ${channel}`)
            }
            // 第一个参数是 event，我们传入 null
            return handler(null, ...args)
        },
        getHandler: (channel: string) => handlers.get(channel),
        clear: () => handlers.clear(),
    }
}
