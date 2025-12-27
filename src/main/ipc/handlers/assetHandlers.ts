import { ipcMain, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { channels } from '../../../shared/ipc/channels'

/**
 * 资源文件管理
 * 处理图片等资源文件的保存和读取
 */

let assetsDir: string | null = null

/**
 * 获取资源目录路径
 */
function getAssetsDir(): string {
    if (!assetsDir) {
        const userDataPath = app.getPath('userData')
        assetsDir = path.join(userDataPath, 'assets')

        // 确保目录存在
        if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true })
        }
    }
    return assetsDir
}

/**
 * 生成唯一文件名
 */
function generateFileName(extension: string): string {
    const timestamp = Date.now()
    const random = crypto.randomBytes(4).toString('hex')
    return `${timestamp}-${random}${extension}`
}

/**
 * 从 Base64 数据 URL 中提取信息
 */
function parseDataUrl(dataUrl: string): { mimeType: string; extension: string; data: Buffer } | null {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) return null

    const mimeType = match[1]
    const base64Data = match[2]
    const data = Buffer.from(base64Data, 'base64')

    // 根据 MIME 类型确定扩展名
    const extensionMap: Record<string, string> = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/svg+xml': '.svg',
    }

    const extension = extensionMap[mimeType] || '.png'

    return { mimeType, extension, data }
}

export interface SaveImageResult {
    success: boolean
    fileName?: string
    filePath?: string
    error?: string
}

/**
 * 注册资源管理相关的 IPC handlers
 */
export function registerAssetHandlers(): void {
    // 保存图片
    ipcMain.handle(
        channels.asset.saveImage,
        async (_, dataUrl: string): Promise<SaveImageResult> => {
            try {
                const parsed = parseDataUrl(dataUrl)
                if (!parsed) {
                    return { success: false, error: 'Invalid data URL format' }
                }

                const fileName = generateFileName(parsed.extension)
                const filePath = path.join(getAssetsDir(), fileName)

                fs.writeFileSync(filePath, parsed.data)

                console.log(`[Asset] Saved image: ${fileName}`)

                return {
                    success: true,
                    fileName,
                    filePath,
                }
            } catch (error) {
                console.error('[Asset] Failed to save image:', error)
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                }
            }
        }
    )

    // 获取资源文件的完整路径
    ipcMain.handle(
        channels.asset.getAssetPath,
        (_, fileName: string): string => {
            return path.join(getAssetsDir(), fileName)
        }
    )

    // 删除资源文件
    ipcMain.handle(
        channels.asset.deleteAsset,
        async (_, fileName: string): Promise<{ success: boolean; error?: string }> => {
            try {
                const filePath = path.join(getAssetsDir(), fileName)
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath)
                    console.log(`[Asset] Deleted: ${fileName}`)
                }
                return { success: true }
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                }
            }
        }
    )

    console.log('[IPC] Asset handlers registered')
}
