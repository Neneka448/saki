import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockKernel, createIpcMainMock } from './testUtils'
import { channels } from '../../../shared/ipc/channels'
import type { CreateRelationParams, RelationQuery } from '../../../shared/ipc/types'

// Mock electron
vi.mock('electron', () => ({
  ipcMain: createIpcMainMock(),
}))

describe('Relation IPC Handlers', () => {
  let kernel: ReturnType<typeof createMockKernel>
  let ipcMain: ReturnType<typeof createIpcMainMock>

  beforeEach(async () => {
    vi.resetModules()

    kernel = createMockKernel()

    const electron = await import('electron')
    ipcMain = electron.ipcMain as unknown as ReturnType<typeof createIpcMainMock>
    ipcMain.clear()

    const { registerRelationHandlers } = await import('../../ipc/handlers/relationHandlers')
    registerRelationHandlers(kernel)
  })

  describe('relation:create', () => {
    it('should create a relation', async () => {
      const params: CreateRelationParams = {
        sourceId: 1,
        sourceType: 'card',
        targetId: 2,
        targetType: 'tag',
        relationType: 'tagged',
      }

      const result = await ipcMain.invoke(channels.relation.create, params)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sourceId).toBe(1)
        expect(result.data.targetId).toBe(2)
        expect(result.data.relationType).toBe('tagged')
      }
    })

    it('should create relation with meta', async () => {
      const params: CreateRelationParams = {
        sourceId: 1,
        sourceType: 'card',
        targetId: 2,
        targetType: 'card',
        relationType: 'references',
        meta: { context: 'some context' },
      }

      const result = await ipcMain.invoke(channels.relation.create, params)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.meta).toEqual({ context: 'some context' })
      }
    })
  })

  describe('relation:getById', () => {
    it('should get relation by id', async () => {
      await ipcMain.invoke(channels.relation.create, {
        sourceId: 1,
        sourceType: 'card',
        targetId: 2,
        targetType: 'tag',
        relationType: 'tagged',
      })

      const result = await ipcMain.invoke(channels.relation.getById, 1)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe(1)
      }
    })

    it('should return error for non-existent relation', async () => {
      const result = await ipcMain.invoke(channels.relation.getById, 999)

      expect(result.success).toBe(false)
    })
  })

  describe('relation:find', () => {
    beforeEach(async () => {
      // Create test relations
      await ipcMain.invoke(channels.relation.create, {
        sourceId: 1,
        sourceType: 'card',
        targetId: 1,
        targetType: 'tag',
        relationType: 'tagged',
      })
      await ipcMain.invoke(channels.relation.create, {
        sourceId: 1,
        sourceType: 'card',
        targetId: 2,
        targetType: 'tag',
        relationType: 'tagged',
      })
      await ipcMain.invoke(channels.relation.create, {
        sourceId: 1,
        sourceType: 'card',
        targetId: 2,
        targetType: 'card',
        relationType: 'references',
      })
    })

    it('should find by sourceId', async () => {
      const query: RelationQuery = { sourceId: 1 }
      const result = await ipcMain.invoke(channels.relation.find, query)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(3)
      }
    })

    it('should find by relationType', async () => {
      const query: RelationQuery = { relationType: 'tagged' }
      const result = await ipcMain.invoke(channels.relation.find, query)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(2)
      }
    })

    it('should find by multiple criteria', async () => {
      const query: RelationQuery = {
        sourceId: 1,
        targetType: 'tag',
        relationType: 'tagged',
      }
      const result = await ipcMain.invoke(channels.relation.find, query)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(2)
      }
    })
  })

  describe('relation:delete', () => {
    it('should delete relation', async () => {
      await ipcMain.invoke(channels.relation.create, {
        sourceId: 1,
        sourceType: 'card',
        targetId: 1,
        targetType: 'tag',
        relationType: 'tagged',
      })

      const result = await ipcMain.invoke(channels.relation.delete, 1)

      expect(result.success).toBe(true)

      const getResult = await ipcMain.invoke(channels.relation.getById, 1)
      expect(getResult.success).toBe(false)
    })

    it('should return error for non-existent relation', async () => {
      const result = await ipcMain.invoke(channels.relation.delete, 999)

      expect(result.success).toBe(false)
    })
  })
})
