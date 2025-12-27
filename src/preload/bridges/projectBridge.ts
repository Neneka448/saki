import { ipcRenderer } from 'electron'
import { channels } from '../../shared/ipc/channels'
import type { IpcResult, Project, CreateProjectParams, UpdateProjectParams } from '../../shared/ipc/types'

/**
 * 项目 API - 暴露给渲染进程
 */
export const projectBridge = {
    create(params: CreateProjectParams): Promise<IpcResult<Project>> {
        return ipcRenderer.invoke(channels.project.create, params)
    },

    getById(id: number): Promise<IpcResult<Project | undefined>> {
        return ipcRenderer.invoke(channels.project.getById, id)
    },

    getAll(): Promise<IpcResult<Project[]>> {
        return ipcRenderer.invoke(channels.project.getAll)
    },

    update(params: UpdateProjectParams): Promise<IpcResult<Project | undefined>> {
        return ipcRenderer.invoke(channels.project.update, params)
    },

    delete(id: number): Promise<IpcResult<boolean>> {
        return ipcRenderer.invoke(channels.project.delete, id)
    },
}
