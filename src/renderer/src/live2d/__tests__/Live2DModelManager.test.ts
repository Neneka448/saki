import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Live2DModelManager } from '../Live2DModelManager'

// Mock localStorage
const localStorageMock = {
    store: {} as Record<string, string>,
    getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
        localStorageMock.store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
        delete localStorageMock.store[key]
    }),
    clear: vi.fn(() => {
        localStorageMock.store = {}
    }),
}

vi.stubGlobal('localStorage', localStorageMock)

describe('Live2DModelManager', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorageMock.store = {}
    })

    describe('constructor and builtin models', () => {
        it('should load builtin models on construction', () => {
            const manager = new Live2DModelManager()
            const models = manager.getModels()

            expect(models.length).toBeGreaterThanOrEqual(1)

            // Check that the first model is the builtin model
            const builtinModel = models.find(m => m.id === 'builtin-sakiko-casual')
            expect(builtinModel).toBeDefined()
            expect(builtinModel?.isBuiltin).toBe(true)
            expect(builtinModel?.name).toBe('Sakiko (Casual)')
            expect(builtinModel?.modelJsonPath).toBe('assets/live2d/sakiko/casual/model.json')
        })

        it('should log builtin models count', () => {
            const consoleSpy = vi.spyOn(console, 'log')
            new Live2DModelManager()

            expect(consoleSpy).toHaveBeenCalledWith('[Live2DModelManager] Loaded builtin models:', 1)
        })
    })

    describe('getModels', () => {
        it('should return combined builtin and user models', () => {
            // Pre-set some user models in localStorage
            const userModels = [
                {
                    id: 'user-model-1',
                    name: 'User Model 1',
                    folderPath: '/path/to/model1',
                    modelJsonPath: '/path/to/model1/model.json',
                    motions: [],
                    expressions: [],
                    createdAt: Date.now(),
                }
            ]
            localStorageMock.store['saki.live2d.models'] = JSON.stringify(userModels)

            const manager = new Live2DModelManager()
            const models = manager.getModels()

            // Should have at least 2 models (1 builtin + 1 user)
            expect(models.length).toBeGreaterThanOrEqual(2)

            // First model should be the builtin one
            expect(models[0].isBuiltin).toBe(true)

            // Second model should be the user model
            const userModel = models.find(m => m.id === 'user-model-1')
            expect(userModel).toBeDefined()
            expect(userModel?.isBuiltin).toBeUndefined()
        })
    })

    describe('getModelById', () => {
        it('should find builtin model by id', () => {
            const manager = new Live2DModelManager()
            const model = manager.getModelById('builtin-sakiko-casual')

            expect(model).toBeDefined()
            expect(model?.isBuiltin).toBe(true)
            expect(model?.name).toBe('Sakiko (Casual)')
        })

        it('should find user model by id', () => {
            const userModels = [
                {
                    id: 'user-model-test',
                    name: 'Test Model',
                    folderPath: '/test/path',
                    modelJsonPath: '/test/path/model.json',
                    motions: [],
                    expressions: [],
                    createdAt: Date.now(),
                }
            ]
            localStorageMock.store['saki.live2d.models'] = JSON.stringify(userModels)

            const manager = new Live2DModelManager()
            const model = manager.getModelById('user-model-test')

            expect(model).toBeDefined()
            expect(model?.name).toBe('Test Model')
        })

        it('should return undefined for non-existent id', () => {
            const manager = new Live2DModelManager()
            const model = manager.getModelById('non-existent-id')

            expect(model).toBeUndefined()
        })
    })

    describe('removeModel', () => {
        it('should not remove builtin models from user storage', () => {
            const manager = new Live2DModelManager()
            // Builtin models are not in this.models, so trying to remove them should return false
            const result = manager.removeModel('builtin-sakiko-casual')
            expect(result).toBe(false)

            // Builtin model should still be accessible
            const models = manager.getModels()
            const builtinModel = models.find(m => m.id === 'builtin-sakiko-casual')
            expect(builtinModel).toBeDefined()
        })

        it('should remove user models', () => {
            const userModels = [
                {
                    id: 'user-model-to-remove',
                    name: 'To Remove',
                    folderPath: '/remove/path',
                    modelJsonPath: '/remove/path/model.json',
                    motions: [],
                    expressions: [],
                    createdAt: Date.now(),
                }
            ]
            localStorageMock.store['saki.live2d.models'] = JSON.stringify(userModels)

            const manager = new Live2DModelManager()

            // Verify model exists
            let model = manager.getModelById('user-model-to-remove')
            expect(model).toBeDefined()

            // Remove the model
            const result = manager.removeModel('user-model-to-remove')
            expect(result).toBe(true)

            // Verify model is removed
            model = manager.getModelById('user-model-to-remove')
            expect(model).toBeUndefined()
        })
    })
})
