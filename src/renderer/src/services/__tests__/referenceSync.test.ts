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
    })

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
})
