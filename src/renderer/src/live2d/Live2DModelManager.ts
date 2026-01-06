/**
 * Live2D 模型资源管理器
 * 负责管理用户导入的 Live2D 模型文件夹
 */

import type { Live2DModelAsset, Live2DModelConfig } from './types'

const STORAGE_KEY = 'saki.live2d.models'

/**
 * 解析 model.json 文件，提取动作和表情列表
 */
async function parseModelJson(modelJsonPath: string): Promise<{
    motions: string[]
    expressions: string[]
} | null> {
    try {
        // 通过 Electron IPC 读取本地文件
        // @ts-ignore - window.app 是 preload 注入的
        const result = await window.app?.readFile?.(modelJsonPath)
        if (!result?.success || !result.data) {
            console.error('[Live2DModelManager] Failed to read file:', result?.error)
            return null
        }

        const config: Live2DModelConfig = JSON.parse(result.data)

        const motions = config.motions ? Object.keys(config.motions) : []
        const expressions = config.expressions?.map((e) => e.name) || []

        return { motions, expressions }
    } catch (error) {
        console.error('[Live2DModelManager] Failed to parse model.json:', error)
        return null
    }
}

/**
 * 生成唯一ID
 */
function generateId(): string {
    return `l2d_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Live2D 模型资源管理类
 */
export class Live2DModelManager {
    private models: Live2DModelAsset[] = []

    constructor() {
        this.loadFromStorage()
    }

    /**
     * 从 localStorage 加载已保存的模型列表
     */
    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
                this.models = JSON.parse(stored)
            }
        } catch (error) {
            console.error('[Live2DModelManager] Failed to load from storage:', error)
            this.models = []
        }
    }

    /**
     * 保存模型列表到 localStorage
     */
    private saveToStorage(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.models))
        } catch (error) {
            console.error('[Live2DModelManager] Failed to save to storage:', error)
        }
    }

    /**
     * 导入 Live2D 模型文件夹
     * @param folderPath 文件夹路径
     * @param name 可选的显示名称
     * @returns 导入的模型资源，或 null 表示失败
     */
    async importModel(folderPath: string, name?: string): Promise<Live2DModelAsset | null> {
        try {
            // 构建 model.json 路径
            const modelJsonPath = `${folderPath}/model.json`

            // 解析 model.json
            const parsed = await parseModelJson(modelJsonPath)
            if (!parsed) {
                console.error('[Live2DModelManager] Invalid model folder, no valid model.json found')
                return null
            }

            // 检查是否已导入
            const existing = this.models.find((m) => m.folderPath === folderPath)
            if (existing) {
                console.log('[Live2DModelManager] Model already imported:', existing.name)
                return existing
            }

            // 创建模型资源
            const asset: Live2DModelAsset = {
                id: generateId(),
                name: name || folderPath.split('/').pop() || 'Unnamed Model',
                folderPath,
                modelJsonPath,
                motions: parsed.motions,
                expressions: parsed.expressions,
                createdAt: Date.now(),
            }

            // 添加到列表
            this.models.push(asset)
            this.saveToStorage()

            console.log('[Live2DModelManager] Model imported:', asset.name)
            return asset
        } catch (error) {
            console.error('[Live2DModelManager] Failed to import model:', error)
            return null
        }
    }

    /**
     * 移除模型
     * @param id 模型ID
     */
    removeModel(id: string): boolean {
        const index = this.models.findIndex((m) => m.id === id)
        if (index === -1) {
            return false
        }

        this.models.splice(index, 1)
        this.saveToStorage()
        return true
    }

    /**
     * 获取所有已导入的模型
     */
    getModels(): Live2DModelAsset[] {
        return [...this.models]
    }

    /**
     * 根据ID获取模型
     */
    getModelById(id: string): Live2DModelAsset | undefined {
        return this.models.find((m) => m.id === id)
    }

    /**
     * 更新模型名称
     */
    updateModelName(id: string, name: string): boolean {
        const model = this.models.find((m) => m.id === id)
        if (!model) {
            return false
        }

        model.name = name
        this.saveToStorage()
        return true
    }

    /**
     * 刷新模型的动作和表情列表
     */
    async refreshModel(id: string): Promise<boolean> {
        const model = this.models.find((m) => m.id === id)
        if (!model) {
            return false
        }

        const parsed = await parseModelJson(model.modelJsonPath)
        if (!parsed) {
            return false
        }

        model.motions = parsed.motions
        model.expressions = parsed.expressions
        this.saveToStorage()
        return true
    }

    /**
     * 清空所有模型
     */
    clearAll(): void {
        this.models = []
        this.saveToStorage()
    }
}

// 全局单例
export const live2DModelManager = new Live2DModelManager()
