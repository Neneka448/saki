/**
 * Live2D 核心模块
 * 负责动态加载 Live2D 插件
 */

export class Live2DCore {
    public isAvailable = false
    public Live2DModel: any = null
    public SoundManager: any = null
    public Config: any = null

    private _initialized = false
    private _initPromise: Promise<boolean> | null = null

    constructor() {
        // 构造时不自动初始化，需要手动调用 init()
    }

    /**
     * 初始化 Live2D 插件
     * @returns 是否初始化成功
     */
    async init(): Promise<boolean> {
        if (this._initialized) {
            return this.isAvailable
        }

        if (this._initPromise) {
            return this._initPromise
        }

        this._initPromise = this._doInit()
        return this._initPromise
    }

    private async _doInit(): Promise<boolean> {
        try {
            // 动态导入 pixi-live2d-display-webgal
            const { Live2DModel, SoundManager, config } = await import('pixi-live2d-display-webgal')

            this.Live2DModel = Live2DModel
            this.SoundManager = SoundManager
            this.Config = config
            this.isAvailable = true
            this._initialized = true

            // 关闭 Live2D 自带的声音（我们会用自己的音频系统）
            if (this.SoundManager) {
                this.SoundManager.volume = 0
            }

            console.log('[Live2DCore] Live2D plugin loaded successfully')
            return true
        } catch (error) {
            console.error('[Live2DCore] Failed to load Live2D plugin:', error)
            this.isAvailable = false
            this._initialized = true
            return false
        }
    }

    /**
     * 检查是否已初始化
     */
    get initialized(): boolean {
        return this._initialized
    }
}

// 全局单例
export const live2DCore = new Live2DCore()
