import { describe, it, expect, beforeEach, vi } from 'vitest'
import { syncCardReferences } from '../referenceSync'
import { REFERENCE_NAMESPACE, REFERENCE_META_TYPE } from '../../utils/referenceUtils'

const mockCardApi = {
    getListByProject: vi.fn(),
    getTags: vi.fn(),
    addTag: vi.fn(),
}

const mockTagApi = {
    create: vi.fn(),
    update: vi.fn(),
    updateMeta: vi.fn(),
    delete: vi.fn(),
}

vi.stubGlobal('window', {
    card: mockCardApi,
    tag: mockTagApi,
})

describe('referenceSync', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // 默认返回空数据
        mockCardApi.getListByProject.mockResolvedValue({ success: true, data: [] })
        mockCardApi.getTags.mockResolvedValue({ success: true, data: [] })
    })

    describe('basic functionality', () => {
        it('creates a system tag for a resolved reference', async () => {
            mockCardApi.getListByProject.mockResolvedValue({
                success: true,
                data: [
                    { id: 2, title: 'Target', summary: 'Summary' },
                    { id: 10, title: 'Source', summary: 'From' },
                ],
            })
            mockCardApi.getTags.mockResolvedValue({ success: true, data: [] })
            mockTagApi.create.mockResolvedValue({ success: true, data: { id: 99 } })
            mockCardApi.addTag.mockResolvedValue({ success: true })

            await syncCardReferences(10, 1, 'see [[Target]](go there)')

            expect(mockTagApi.create).toHaveBeenCalledTimes(1)
            const params = mockTagApi.create.mock.calls[0][0]
            expect(params.namespace).toBe(REFERENCE_NAMESPACE)
            expect(params.name).toBe('go there')
            expect(params.meta.extra.type).toBe(REFERENCE_META_TYPE)
            expect(params.meta.extra.sourceCardId).toBe(10)
            expect(params.meta.extra.targetCardId).toBe(2)
            expect(params.meta.extra.titleSnapshot).toBe('Target')
            expect(params.meta.extra.placeholder).toBe('go there')
            expect(params.meta.extra.refId).toMatch(/[a-z0-9]/i)
            expect(mockCardApi.addTag).toHaveBeenCalledWith(10, 99)
        })

        it('updates an existing system tag when ref id is reused', async () => {
            mockCardApi.getListByProject.mockResolvedValue({
                success: true,
                data: [
                    { id: 2, title: 'Target', summary: 'Summary' },
                    { id: 10, title: 'Source', summary: 'From' },
                ],
            })
            mockCardApi.getTags.mockResolvedValue({
                success: true,
                data: [
                    {
                        id: 5,
                        name: 'old name',
                        namespace: REFERENCE_NAMESPACE,
                        color: null,
                        usageCount: 0,
                        extra: { refId: 'fixed', type: REFERENCE_META_TYPE, targetCardId: 2 },
                    },
                ],
            })
            mockTagApi.update.mockResolvedValue({ success: true })
            mockTagApi.updateMeta.mockResolvedValue({ success: true })

            await syncCardReferences(10, 1, '[[Target]](new name)<!--ref:fixed-->')

            expect(mockTagApi.create).not.toHaveBeenCalled()
            expect(mockTagApi.update).toHaveBeenCalledWith({ id: 5, name: 'new name' })
            expect(mockTagApi.updateMeta).toHaveBeenCalledTimes(1)
            const updateMetaParams = mockTagApi.updateMeta.mock.calls[0][0]
            expect(updateMetaParams.tagId).toBe(5)
            expect(updateMetaParams.meta.extra.refId).toBe('fixed')
            expect(updateMetaParams.meta.extra.sourceCardId).toBe(10)
            expect(updateMetaParams.meta.extra.targetCardId).toBe(2)
            expect(updateMetaParams.meta.extra.titleSnapshot).toBe('Target')
            expect(updateMetaParams.meta.extra.placeholder).toBe('new name')
        })

        it('skips update when tag name unchanged', async () => {
            mockCardApi.getListByProject.mockResolvedValue({
                success: true,
                data: [{ id: 2, title: 'Target', summary: '' }],
            })
            mockCardApi.getTags.mockResolvedValue({
                success: true,
                data: [
                    {
                        id: 5,
                        name: 'same name',
                        namespace: REFERENCE_NAMESPACE,
                        extra: { refId: 'fixed', type: REFERENCE_META_TYPE },
                    },
                ],
            })
            mockTagApi.updateMeta.mockResolvedValue({ success: true })

            await syncCardReferences(10, 1, '[[Target]](same name)<!--ref:fixed-->')

            expect(mockTagApi.update).not.toHaveBeenCalled()
            expect(mockTagApi.updateMeta).toHaveBeenCalledTimes(1)
        })
    })

    describe('deletion and cleanup', () => {
        it('deletes orphaned system tags', async () => {
            mockCardApi.getListByProject.mockResolvedValue({
                success: true,
                data: [{ id: 2, title: 'Target', summary: '' }],
            })
            mockCardApi.getTags.mockResolvedValue({
                success: true,
                data: [
                    {
                        id: 5,
                        name: 'orphan',
                        namespace: REFERENCE_NAMESPACE,
                        extra: { refId: 'oldRef', type: REFERENCE_META_TYPE },
                    },
                ],
            })
            mockTagApi.delete.mockResolvedValue({ success: true })

            await syncCardReferences(10, 1, 'no references here')

            expect(mockTagApi.delete).toHaveBeenCalledWith(5)
        })

        it('deletes system tags without refId (orphaned data)', async () => {
            mockCardApi.getListByProject.mockResolvedValue({
                success: true,
                data: [{ id: 2, title: 'Target', summary: '' }],
            })
            mockCardApi.getTags.mockResolvedValue({
                success: true,
                data: [
                    {
                        id: 7,
                        name: 'corrupted tag',
                        namespace: REFERENCE_NAMESPACE,
                        extra: { type: REFERENCE_META_TYPE }, // missing refId!
                    },
                    {
                        id: 8,
                        name: 'no extra',
                        namespace: REFERENCE_NAMESPACE,
                        extra: null, // no extra at all
                    },
                ],
            })
            mockTagApi.delete.mockResolvedValue({ success: true })

            await syncCardReferences(10, 1, 'no references here')

            expect(mockTagApi.delete).toHaveBeenCalledWith(7)
            expect(mockTagApi.delete).toHaveBeenCalledWith(8)
            expect(mockTagApi.delete).toHaveBeenCalledTimes(2)
        })

        it('deletes tag when target card no longer exists', async () => {
            mockCardApi.getListByProject.mockResolvedValue({
                success: true,
                data: [], // Target card was deleted
            })
            mockCardApi.getTags.mockResolvedValue({
                success: true,
                data: [
                    {
                        id: 5,
                        name: 'old ref',
                        namespace: REFERENCE_NAMESPACE,
                        extra: { refId: 'ref1', type: REFERENCE_META_TYPE, targetCardId: 999 },
                    },
                ],
            })
            mockTagApi.delete.mockResolvedValue({ success: true })

            // Content still has the reference but target card is gone
            await syncCardReferences(10, 1, '[[DeletedCard]](link)<!--ref:ref1-->')

            expect(mockTagApi.delete).toHaveBeenCalledWith(5)
            expect(mockTagApi.create).not.toHaveBeenCalled()
        })

        it('deletes tag when title has duplicates (cannot resolve)', async () => {
            mockCardApi.getListByProject.mockResolvedValue({
                success: true,
                data: [
                    { id: 2, title: 'Duplicate', summary: '' },
                    { id: 3, title: 'Duplicate', summary: '' }, // Same title!
                ],
            })
            mockCardApi.getTags.mockResolvedValue({
                success: true,
                data: [
                    {
                        id: 5,
                        name: 'ref',
                        namespace: REFERENCE_NAMESPACE,
                        extra: { refId: 'ref1', type: REFERENCE_META_TYPE },
                    },
                ],
            })
            mockTagApi.delete.mockResolvedValue({ success: true })

            await syncCardReferences(10, 1, '[[Duplicate]](link)<!--ref:ref1-->')

            expect(mockTagApi.delete).toHaveBeenCalledWith(5)
            expect(mockTagApi.create).not.toHaveBeenCalled()
        })
    })

    describe('edge cases', () => {
        it('handles empty content', async () => {
            const result = await syncCardReferences(10, 1, '')
            expect(result.content).toBe('')
            expect(result.references).toEqual([])
        })

        it('handles content without references', async () => {
            const result = await syncCardReferences(10, 1, 'just plain text')
            expect(result.content).toBe('just plain text')
            expect(result.references).toEqual([])
        })

        it('ignores self-reference', async () => {
            mockCardApi.getListByProject.mockResolvedValue({
                success: true,
                data: [{ id: 10, title: 'Self', summary: '' }],
            })

            await syncCardReferences(10, 1, '[[Self]](link)')

            expect(mockTagApi.create).not.toHaveBeenCalled()
        })

        it('handles failed getListByProject gracefully', async () => {
            mockCardApi.getListByProject.mockResolvedValue({ success: false, error: 'Network error' })

            const result = await syncCardReferences(10, 1, '[[Card]](link)')

            expect(result.references.length).toBe(1)
            expect(mockTagApi.create).not.toHaveBeenCalled()
        })

        it('handles failed getTags gracefully', async () => {
            mockCardApi.getListByProject.mockResolvedValue({
                success: true,
                data: [{ id: 2, title: 'Target', summary: '' }],
            })
            mockCardApi.getTags.mockResolvedValue({ success: false, error: 'Error' })
            mockTagApi.create.mockResolvedValue({ success: true, data: { id: 99 } })
            mockCardApi.addTag.mockResolvedValue({ success: true })

            await syncCardReferences(10, 1, '[[Target]](link)')

            // Should still create new tag
            expect(mockTagApi.create).toHaveBeenCalledTimes(1)
        })

        it('uses title as tag name when placeholder is empty', async () => {
            mockCardApi.getListByProject.mockResolvedValue({
                success: true,
                data: [{ id: 2, title: 'CardTitle', summary: '' }],
            })
            mockTagApi.create.mockResolvedValue({ success: true, data: { id: 99 } })
            mockCardApi.addTag.mockResolvedValue({ success: true })

            await syncCardReferences(10, 1, '[[CardTitle]]()')

            const params = mockTagApi.create.mock.calls[0][0]
            expect(params.name).toBe('CardTitle')
        })

        it('handles failed tag creation gracefully', async () => {
            mockCardApi.getListByProject.mockResolvedValue({
                success: true,
                data: [{ id: 2, title: 'Target', summary: '' }],
            })
            mockTagApi.create.mockResolvedValue({ success: false, error: 'Failed' })

            // Should not throw
            await expect(syncCardReferences(10, 1, '[[Target]](link)')).resolves.toBeDefined()
            expect(mockCardApi.addTag).not.toHaveBeenCalled()
        })
    })

    describe('multiple references', () => {
        it('handles multiple references in parallel', async () => {
            mockCardApi.getListByProject.mockResolvedValue({
                success: true,
                data: [
                    { id: 2, title: 'A', summary: '' },
                    { id: 3, title: 'B', summary: '' },
                    { id: 4, title: 'C', summary: '' },
                ],
            })
            mockTagApi.create.mockResolvedValue({ success: true, data: { id: 99 } })
            mockCardApi.addTag.mockResolvedValue({ success: true })

            await syncCardReferences(10, 1, '[[A]](a) [[B]](b) [[C]](c)')

            expect(mockTagApi.create).toHaveBeenCalledTimes(3)
        })

        it('creates and deletes in same sync', async () => {
            mockCardApi.getListByProject.mockResolvedValue({
                success: true,
                data: [{ id: 2, title: 'New', summary: '' }],
            })
            mockCardApi.getTags.mockResolvedValue({
                success: true,
                data: [
                    {
                        id: 5,
                        name: 'old',
                        namespace: REFERENCE_NAMESPACE,
                        extra: { refId: 'oldRef', type: REFERENCE_META_TYPE },
                    },
                ],
            })
            mockTagApi.create.mockResolvedValue({ success: true, data: { id: 99 } })
            mockCardApi.addTag.mockResolvedValue({ success: true })
            mockTagApi.delete.mockResolvedValue({ success: true })

            await syncCardReferences(10, 1, '[[New]](new link)')

            expect(mockTagApi.create).toHaveBeenCalledTimes(1)
            expect(mockTagApi.delete).toHaveBeenCalledWith(5)
        })
    })
})
