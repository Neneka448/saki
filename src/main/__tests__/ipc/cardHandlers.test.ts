import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockKernel, createIpcMainMock } from './testUtils'
import { channels } from '../../../shared/ipc/channels'
import type { CreateCardParams, UpdateCardParams } from '../../../shared/ipc/types'

// Mock electron
vi.mock('electron', () => ({
    ipcMain: createIpcMainMock(),
}))

describe('Card IPC Handlers', () => {
    let kernel: ReturnType<typeof createMockKernel>
    let ipcMain: ReturnType<typeof createIpcMainMock>

    beforeEach(async () => {
        // Reset mocks
        vi.resetModules()

        // Create fresh kernel
        kernel = createMockKernel()

        // Get fresh ipcMain mock
        const electron = await import('electron')
        ipcMain = electron.ipcMain as unknown as ReturnType<typeof createIpcMainMock>
        ipcMain.clear()

        // Register handlers
        const { registerCardHandlers } = await import('../../ipc/handlers/cardHandlers')
        registerCardHandlers(kernel)
    })

    describe('card:create', () => {
        it('should create a card', async () => {
            const params: CreateCardParams = { projectId: 1, content: 'Test content' }

            const result = await ipcMain.invoke(channels.card.create, params)

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.content).toBe('Test content')
                expect(result.data.id).toBe(1)
            }
        })

        it('should return error for empty content', async () => {
            const params: CreateCardParams = { projectId: 1, content: '' }

            const result = await ipcMain.invoke(channels.card.create, params)

            expect(result.success).toBe(false)
        })
    })

    describe('card:getById', () => {
        it('should get card by id', async () => {
            // Create a card first
            await ipcMain.invoke(channels.card.create, { projectId: 1, content: 'Test' })

            const result = await ipcMain.invoke(channels.card.getById, 1)

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.id).toBe(1)
            }
        })

        it('should return error for non-existent card', async () => {
            const result = await ipcMain.invoke(channels.card.getById, 999)

            expect(result.success).toBe(false)
        })
    })

    describe('card:getListByProject', () => {
        it('should get card list by project', async () => {
            await ipcMain.invoke(channels.card.create, { projectId: 1, content: 'Card 1' })
            await ipcMain.invoke(channels.card.create, { projectId: 1, content: 'Card 2' })

            const result = await ipcMain.invoke(channels.card.getListByProject, 1)

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data).toHaveLength(2)
            }
        })
    })

    describe('card:update', () => {
        it('should update card', async () => {
            await ipcMain.invoke(channels.card.create, { projectId: 1, content: 'Original' })

            const params: UpdateCardParams = { id: 1, content: 'Updated' }
            const result = await ipcMain.invoke(channels.card.update, params)

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.content).toBe('Updated')
            }
        })
    })

    describe('card:delete', () => {
        it('should delete card', async () => {
            await ipcMain.invoke(channels.card.create, { projectId: 1, content: 'Test' })

            const result = await ipcMain.invoke(channels.card.delete, 1)

            expect(result.success).toBe(true)

            // Verify card is deleted
            const getResult = await ipcMain.invoke(channels.card.getById, 1)
            expect(getResult.success).toBe(false)
        })
    })

    describe('card:addTag and card:getTags', () => {
        it('should add and get tags for card', async () => {
            // Create card and tag
            await ipcMain.invoke(channels.card.create, { projectId: 1, content: 'Test' })
            kernel.tag.create(1, 'Tag1')

            // Add tag to card
            const addResult = await ipcMain.invoke(channels.card.addTag, { cardId: 1, tagId: 1 })
            expect(addResult.success).toBe(true)

            // Get tags
            const tagsResult = await ipcMain.invoke(channels.card.getTags, 1)
            expect(tagsResult.success).toBe(true)
            if (tagsResult.success) {
                expect(tagsResult.data).toHaveLength(1)
                expect(tagsResult.data[0].name).toBe('Tag1')
            }
        })
    })

    describe('card:removeTag', () => {
        it('should remove tag from card', async () => {
            await ipcMain.invoke(channels.card.create, { projectId: 1, content: 'Test' })
            kernel.tag.create(1, 'Tag1')
            await ipcMain.invoke(channels.card.addTag, { cardId: 1, tagId: 1 })

            const removeResult = await ipcMain.invoke(channels.card.removeTag, { cardId: 1, tagId: 1 })
            expect(removeResult.success).toBe(true)

            const tagsResult = await ipcMain.invoke(channels.card.getTags, 1)
            if (tagsResult.success) {
                expect(tagsResult.data).toHaveLength(0)
            }
        })
    })

    describe('card:addReference', () => {
        it('should add reference between cards', async () => {
            await ipcMain.invoke(channels.card.create, { projectId: 1, content: 'Card 1' })
            await ipcMain.invoke(channels.card.create, { projectId: 1, content: 'Card 2' })

            const result = await ipcMain.invoke(channels.card.addReference, { fromCardId: 1, toCardId: 2 })
            expect(result.success).toBe(true)

            const referencedResult = await ipcMain.invoke(channels.card.getReferencedCards, 1)
            if (referencedResult.success) {
                expect(referencedResult.data).toHaveLength(1)
                expect(referencedResult.data[0].id).toBe(2)
            }
        })
    })

    describe('card:getByTag', () => {
        it('should filter cards by tag', async () => {
            await ipcMain.invoke(channels.card.create, { projectId: 1, content: 'Card 1' })
            await ipcMain.invoke(channels.card.create, { projectId: 1, content: 'Card 2' })
            kernel.tag.create(1, 'Tag1')

            await ipcMain.invoke(channels.card.addTag, { cardId: 1, tagId: 1 })

            const result = await ipcMain.invoke(channels.card.getByTag, 1)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data).toHaveLength(1)
                expect(result.data[0].id).toBe(1)
            }
        })
    })

    describe('card:getByTags', () => {
        it('should filter cards by multiple tags (AND)', async () => {
            await ipcMain.invoke(channels.card.create, { projectId: 1, content: 'Card 1' })
            await ipcMain.invoke(channels.card.create, { projectId: 1, content: 'Card 2' })
            kernel.tag.create(1, 'Tag1')
            kernel.tag.create(1, 'Tag2')

            await ipcMain.invoke(channels.card.addTag, { cardId: 1, tagId: 1 })
            await ipcMain.invoke(channels.card.addTag, { cardId: 1, tagId: 2 })
            await ipcMain.invoke(channels.card.addTag, { cardId: 2, tagId: 1 })

            const result = await ipcMain.invoke(channels.card.getByTags, [1, 2])
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data).toHaveLength(1)
                expect(result.data[0].id).toBe(1)
            }
        })
    })
})
