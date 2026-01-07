/**
 * Live2D 控制器
 * 管理 PixiJS 舞台和 Live2D 模型的渲染与交互
 */

import * as PIXI from 'pixi.js'
import { live2DCore } from './Live2DCore'
import {
    BlinkParam,
    FocusParam,
    DEFAULT_BLINK_PARAM,
    DEFAULT_FOCUS_PARAM,
    Live2DModelConfig,
    Live2DState,
} from './types'

export class Live2DController {
    private app: PIXI.Application | null = null
    private container: HTMLElement | null = null
    private model: any = null
    private modelKey = 'main-model'
    private modelScale = 1 // 保存模型的缩放比例

    private state: Live2DState = {
        isLoaded: false,
        currentMotion: '',
        currentExpression: '',
        blinkParam: { ...DEFAULT_BLINK_PARAM },
        focusParam: { ...DEFAULT_FOCUS_PARAM },
    }

    constructor() { }

    /**
     * 初始化 PixiJS 应用
     * @param container 挂载的 DOM 容器
     */
    async initialize(container: HTMLElement): Promise<boolean> {
        this.container = container

        // 先初始化 Live2D 核心
        const coreReady = await live2DCore.init()
        if (!coreReady) {
            console.error('[Live2DController] Live2D core not available')
            return false
        }

        // 创建 PixiJS 应用 - 不使用 resizeTo，手动控制大小
        this.app = new PIXI.Application({
            backgroundAlpha: 0,
            width: container.clientWidth,
            height: container.clientHeight,
            antialias: true,
            resolution: 1, // 使用固定分辨率，避免变形
        })

        // 注册 Ticker 用于 Live2D 动画更新
        live2DCore.Live2DModel.registerTicker(PIXI.Ticker)

        // 挂载到容器
        container.innerHTML = ''
        container.appendChild(this.app.view as HTMLCanvasElement)

        // 不设置 CSS 尺寸，让 canvas 保持自己的物理尺寸
        const canvas = this.app.view as HTMLCanvasElement
        canvas.style.display = 'block'

        console.log('[Live2DController] Initialized')
        return true
    }

    /**
     * 加载 Live2D 模型
     * @param modelJsonPath model.json 的完整路径（内置模型为相对路径，用户导入模型为绝对路径）
     * @param isBuiltin 是否为内置模型
     */
    async loadModel(modelJsonPath: string, isBuiltin = false): Promise<boolean> {
        if (!this.app || !live2DCore.isAvailable) {
            console.error('[Live2DController] Not initialized or Live2D not available')
            return false
        }

        try {
            // 移除旧模型
            if (this.model) {
                this.app.stage.removeChild(this.model)
                this.model.destroy()
                this.model = null
            }

            // 内置模型使用相对路径，用户导入模型使用 file:// 协议
            let modelUrl: string
            if (isBuiltin) {
                // 内置模型直接使用相对路径
                modelUrl = modelJsonPath
            } else {
                // 用户导入模型使用 file:// 协议
                modelUrl = modelJsonPath.startsWith('file://')
                    ? modelJsonPath
                    : `file://${modelJsonPath}`
            }

            // 加载新模型
            this.model = await live2DCore.Live2DModel.from(modelUrl, {
                autoInteract: false,
            })

            if (!this.model) {
                throw new Error('Failed to create Live2D model')
            }

            // 计算缩放 - 固定人物高度为 450px
            const containerWidth = this.container?.clientWidth || 800
            const containerHeight = this.container?.clientHeight || 600

            // 使用模型的原始尺寸来计算缩放，保持宽高比
            const modelHeight = this.model.internalModel?.originalHeight || this.model.height

            // 固定人物显示高度为 450px
            const targetHeight = 450
            const scale = targetHeight / modelHeight

            // 保存缩放值，分别设置 x 和 y（使用相同值保持宽高比）
            this.modelScale = scale
            this.model.scale.x = scale
            this.model.scale.y = scale

            // 锚点设置在底部中心，让人物贴底边
            this.model.anchor.set(0.5, 1)
            this.model.position.set(containerWidth / 2, containerHeight)

            // 添加到舞台
            this.app.stage.addChild(this.model)

            // 更新状态
            this.state.isLoaded = true
            this.state.currentMotion = ''
            this.state.currentExpression = ''

            // 应用默认参数
            this.setBlinkParam(this.state.blinkParam)

            console.log('[Live2DController] Model loaded:', modelJsonPath)
            return true
        } catch (error) {
            console.error('[Live2DController] Failed to load model:', error)
            this.state.isLoaded = false
            return false
        }
    }

    /**
     * 播放动作
     * @param motionName 动作名称
     * @param priority 优先级 (0-3, 3最高)
     */
    playMotion(motionName: string, priority = 3): boolean {
        if (!this.model || !this.state.isLoaded) {
            return false
        }

        try {
            // 停止当前动作
            this.model.internalModel?.motionManager?.stopAllMotions?.()

            // 播放新动作
            this.model.motion(motionName, 0, priority)
            this.state.currentMotion = motionName

            console.log('[Live2DController] Playing motion:', motionName)
            return true
        } catch (error) {
            console.error('[Live2DController] Failed to play motion:', error)
            return false
        }
    }

    /**
     * 设置表情
     * @param expressionName 表情名称
     */
    setExpression(expressionName: string): boolean {
        if (!this.model || !this.state.isLoaded) {
            return false
        }

        try {
            this.model.expression(expressionName)
            this.state.currentExpression = expressionName

            console.log('[Live2DController] Setting expression:', expressionName)
            return true
        } catch (error) {
            console.error('[Live2DController] Failed to set expression:', error)
            return false
        }
    }

    /**
     * 设置眨眼参数
     */
    setBlinkParam(param: Partial<BlinkParam>): void {
        this.state.blinkParam = { ...this.state.blinkParam, ...param }

        if (this.model?.internalModel?.setBlinkParam) {
            this.model.internalModel.setBlinkParam(this.state.blinkParam)
        }
    }

    /**
     * 设置注视焦点
     */
    setFocus(param: Partial<FocusParam>): void {
        this.state.focusParam = { ...this.state.focusParam, ...param }

        if (this.model?.internalModel?.focusController) {
            this.model.internalModel.focusController.focus(
                this.state.focusParam.x,
                this.state.focusParam.y,
                this.state.focusParam.instant
            )
        }
    }

    /**
     * 设置嘴部张开程度 (口型同步接口，暂未实现)
     * @param y 张开程度 (0-100)
     */
    setMouthY(y: number): void {
        if (!this.model?.internalModel?.coreModel) {
            return
        }

        // 映射到 0-1 范围
        const paramY = y < 50 ? 0 : (y - 50) / 50

        const coreModel = this.model.internalModel.coreModel

        // Live2D 2.x
        if (coreModel.setParamFloat) {
            coreModel.setParamFloat('PARAM_MOUTH_OPEN_Y', paramY)
        }

        // Live2D 4.x (Cubism 4)
        if (coreModel.setParameterValueById) {
            coreModel.setParameterValueById('ParamMouthOpenY', paramY)
        }
    }

    /**
     * 获取模型可用的动作列表
     */
    getMotionList(): string[] {
        if (!this.model?.internalModel?.motionManager?.definitions) {
            return []
        }

        const definitions = this.model.internalModel.motionManager.definitions
        return Object.keys(definitions)
    }

    /**
     * 获取模型可用的表情列表
     */
    getExpressionList(): string[] {
        if (!this.model?.internalModel?.motionManager?.expressionManager?.definitions) {
            return []
        }

        const definitions = this.model.internalModel.motionManager.expressionManager.definitions
        return definitions.map((def: any) => def.name || def.Name || '')
    }

    /**
     * 获取当前状态
     */
    getState(): Live2DState {
        return { ...this.state }
    }

    /**
     * 调整大小
     */
    resize(): void {
        if (!this.app || !this.container) {
            return
        }

        const width = this.container.clientWidth
        const height = this.container.clientHeight

        // 调整渲染器和画布大小
        this.app.renderer.resize(width, height)

        // 重新计算模型位置（大小保持固定）
        if (this.model) {
            // 位置跟随容器，贴底边居中
            this.model.position.set(width / 2, height)
        }
    }

    /**
     * 销毁控制器
     */
    destroy(): void {
        if (this.model) {
            this.model.destroy()
            this.model = null
        }

        if (this.app) {
            this.app.destroy(true, { children: true, texture: true, baseTexture: true })
            this.app = null
        }

        this.container = null
        this.state.isLoaded = false

        console.log('[Live2DController] Destroyed')
    }
}
