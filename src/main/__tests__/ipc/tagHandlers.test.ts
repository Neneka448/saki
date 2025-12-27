import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockKernel, createIpcMainMock } from './testUtils'
import { channels } from '../../../shared/ipc/channels'
import type { CreateTagParams, UpdateTagParams } from '../../../shared/ipc/types'

// Mock electron
vi.mock('electron', () => ({
    ipcMain: createIpcMainMock(),
}))

describe('Tag IPC Handlers', () => {
    let kernel: ReturnType<typeof createMockKernel>
    let ipcMain: ReturnType<typeof createIpcMainMock>

    beforeEach(async () => {
        vi.resetModules()

        kernel = createMockKernel()

        const electron = await import('electron')
        ipcMain = electron.ipcMain as unknown as ReturnType<typeof createIpcMainMock>
        ipcMain.clear()

        const { registerTagHandlers } = await import('../../ipc/handlers/tagHandlers')
        registerTagHandlers(kernel)
    })

    describe('tag:create', () => {
        it('should create a tag', async () => {
            const params: CreateTagParams = { projectId: 1, name: '学习笔记', color: '#ff0000' }

            const result = await ipcMain.invoke(channels.tag.create, params)

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.name).toBe('学习笔记')
                expect(result.data.color).toBe('#ff0000')
            }
        })

        it('should return error for empty name', async () => {
            const params: CreateTagParams = { projectId: 1, name: '' }

            const result = await ipcMain.invoke(channels.tag.create, params)

            expect(result.success).toBe(false)
        })
    })

    describe('tag:getById', () => {
        it('should get tag by id', async () => {
            await ipcMain.invoke(channels.tag.create, { projectId: 1, name: 'Test' })

            const result = await ipcMain.invoke(channels.tag.getById, 1)

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.name).toBe('Test')
            }
        })

        it('should return error for non-existent tag', async () => {
            const result = await ipcMain.invoke(channels.tag.getById, 999)

            expect(result.success).toBe(false)
        })
    })

    describe('tag:getByName', () => {
        it('should get tag by name', async () => {
            await ipcMain.invoke(channels.tag.create, { projectId: 1, name: 'MyTag' })

            const result = await ipcMain.invoke(channels.tag.getByName, { projectId: 1, name: 'MyTag' })

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.name).toBe('MyTag')
            }
        })
    })

    describe('tag:getOrCreate', () => {
        it('should return existing tag', async () => {
            await ipcMain.invoke(channels.tag.create, { projectId: 1, name: 'Existing' })

            const result = await ipcMain.invoke(channels.tag.getOrCreate, { projectId: 1, name: 'Existing' })

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.id).toBe(1)
            }
        })

        it('should create new tag if not exists', async () => {
            const result = await ipcMain.invoke(channels.tag.getOrCreate, { projectId: 1, name: 'NewTag', color: '#00ff00' })

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.name).toBe('NewTag')
            }
        })
    })

    describe('tag:getAllUserTags', () => {
        it('should get all user tags', async () => {
            await ipcMain.invoke(channels.tag.create, { projectId: 1, name: 'Tag1' })
            await ipcMain.invoke(channels.tag.create, { projectId: 1, name: 'Tag2' })

            const result = await ipcMain.invoke(channels.tag.getAllUserTags, 1)

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data).toHaveLength(2)
            }
        })
    })

    describe('tag:update', () => {
        it('should update tag', async () => {
            await ipcMain.invoke(channels.tag.create, { projectId: 1, name: 'Original' })

            const params: UpdateTagParams = { id: 1, name: 'Updated' }
            const result = await ipcMain.invoke(channels.tag.update, params)

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.name).toBe('Updated')
            }
        })
    })

    describe('tag:delete', () => {
        it('should delete tag', async () => {
            await ipcMain.invoke(channels.tag.create, { projectId: 1, name: 'ToDelete' })

            const result = await ipcMain.invoke(channels.tag.delete, 1)

            expect(result.success).toBe(true)

            const getResult = await ipcMain.invoke(channels.tag.getById, 1)
            expect(getResult.success).toBe(false)
        })
    })

    describe('tag:merge', () => {
        it('should merge tags', async () => {
            await ipcMain.invoke(channels.tag.create, { projectId: 1, name: 'Source' })
            await ipcMain.invoke(channels.tag.create, { projectId: 1, name: 'Target' })

            const result = await ipcMain.invoke(channels.tag.merge, { sourceTagId: 1, targetTagId: 2 })

            expect(result.success).toBe(true)

            // Source should be deleted
            const sourceResult = await ipcMain.invoke(channels.tag.getById, 1)
            expect(sourceResult.success).toBe(false)

            // Target should still exist
            const targetResult = await ipcMain.invoke(channels.tag.getById, 2)
            expect(targetResult.success).toBe(true)
        })
    })

    describe('tag:getAllWithUsageCount', () => {
        it('should get all tags with usage count', async () => {
            await ipcMain.invoke(channels.tag.create, { projectId: 1, name: 'Tag1' })
            await ipcMain.invoke(channels.tag.create, { projectId: 1, name: 'Tag2' })

            // Create a card and add tag (simulate usage)
            kernel.card.create(1, 'Test card')
            kernel.card.addTag(1, 1)

            const result = await ipcMain.invoke(channels.tag.getAllWithUsageCount, 1)

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data).toHaveLength(2)
                const tag1 = result.data.find((t: any) => t.name === 'Tag1')
                const tag2 = result.data.find((t: any) => t.name === 'Tag2')
                expect(tag1.usageCount).toBe(1)
                expect(tag2.usageCount).toBe(0)
            }
        })
    })
})
