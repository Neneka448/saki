/**
 * Live2D 相关类型定义
 */

/** 眨眼参数，毫秒 */
export interface BlinkParam {
    blinkInterval: number       // 眨眼间隔
    blinkIntervalRandom: number // 眨眼间隔随机范围
    closingDuration: number     // 闭眼持续时间
    closedDuration: number      // 保持闭眼时间
    openingDuration: number     // 睁眼持续时间
}

/** 注视焦点参数 */
export interface FocusParam {
    x: number       // 焦点X位置 (-1 到 1)
    y: number       // 焦点Y位置 (-1 到 1)
    instant: boolean // 是否瞬间切换焦点
}

/** 默认眨眼参数 */
export const DEFAULT_BLINK_PARAM: BlinkParam = {
    blinkInterval: 4000,        // 4秒眨眼一次
    blinkIntervalRandom: 2000,  // 随机范围2秒
    closingDuration: 100,
    closedDuration: 50,
    openingDuration: 150,
}

/** 默认注视参数 */
export const DEFAULT_FOCUS_PARAM: FocusParam = {
    x: 0,
    y: 0,
    instant: false,
}

/** Live2D 模型配置 (model.json 结构) */
export interface Live2DModelConfig {
    version?: string
    model: string                           // .moc 文件路径
    textures: string[]                       // 纹理文件路径数组
    physics?: string                         // 物理配置文件路径
    motions?: Record<string, MotionDef[]>    // 动作定义
    expressions?: ExpressionDef[]            // 表情定义
    layout?: {
        center_x?: number
        center_y?: number
        width?: number
    }
    hit_areas_custom?: Record<string, number[]>
}

/** 动作定义 */
export interface MotionDef {
    file: string        // .mtn 文件路径
    sound?: string      // 关联音频
    fade_in?: number    // 淡入时间
    fade_out?: number   // 淡出时间
}

/** 表情定义 */
export interface ExpressionDef {
    name: string   // 表情名称
    file: string   // .exp.json 文件路径
}

/** 已导入的 Live2D 模型资源 */
export interface Live2DModelAsset {
    id: string              // 唯一ID
    name: string            // 显示名称
    folderPath: string      // 模型文件夹路径
    modelJsonPath: string   // model.json 完整路径
    motions: string[]       // 可用动作列表
    expressions: string[]   // 可用表情列表
    thumbnail?: string      // 缩略图路径 (可选)
    createdAt: number       // 导入时间戳
}

/** Live2D 控制器状态 */
export interface Live2DState {
    isLoaded: boolean
    currentMotion: string
    currentExpression: string
    blinkParam: BlinkParam
    focusParam: FocusParam
}
