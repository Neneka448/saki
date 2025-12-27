import { ipcMain } from 'electron'
import { channels } from '../../../shared/ipc/channels'
import type { KernelApi } from '../../../kernel'

export function registerProjectHandlers(kernel: KernelApi): void {
    // 创建项目
    ipcMain.handle(channels.project.create, (_, input: { name: string; description?: string; color?: string; icon?: string }) => {
        return kernel.project.create(input)
    })

    // 获取项目
    ipcMain.handle(channels.project.getById, (_, id: number) => {
        return kernel.project.getById(id)
    })

    // 获取所有项目
    ipcMain.handle(channels.project.getAll, () => {
        return kernel.project.getAll()
    })

    // 更新项目
    ipcMain.handle(channels.project.update, (_, input: { id: number; name?: string; description?: string; color?: string; icon?: string }) => {
        return kernel.project.update(input)
    })

    // 删除项目
    ipcMain.handle(channels.project.delete, (_, id: number) => {
        return kernel.project.delete(id)
    })
}
