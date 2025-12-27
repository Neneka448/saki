import { ipcRenderer } from 'electron'
import { channels } from '../../shared/ipc/channels'

export interface SaveImageResult {
    success: boolean
    fileName?: string
    filePath?: string
    error?: string
}

/**
 * 资源管理 API - 暴露给渲染进程
 */
export const assetBridge = {
    /**
     * 保存图片（从 Base64 Data URL）
     */
    saveImage(dataUrl: string): Promise<SaveImageResult> {
        return ipcRenderer.invoke(channels.asset.saveImage, dataUrl)
    },

    /**
     * 获取资源文件的完整路径
     */
    getAssetPath(fileName: string): Promise<string> {
        return ipcRenderer.invoke(channels.asset.getAssetPath, fileName)
    },

    /**
     * 删除资源文件
     */
    deleteAsset(fileName: string): Promise<{ success: boolean; error?: string }> {
        return ipcRenderer.invoke(channels.asset.deleteAsset, fileName)
    },
}
