import { EventEmitter } from 'events'
import { getAppSettings, saveAppSettings } from './appSettings'

type ActiveProjectListener = (projectId: number | null) => void

const emitter = new EventEmitter()
let activeProjectId: number | null = null

export const appState = {
  getActiveProjectId: () => activeProjectId,
  setActiveProjectId: (projectId: number | null) => {
    if (activeProjectId === projectId) return
    activeProjectId = projectId
    // 保存到设置，下次启动时恢复
    saveAppSettings({ lastProjectId: projectId })
    emitter.emit('activeProjectChanged', activeProjectId)
  },
  // 初始化时从设置中恢复上次的项目
  restoreLastProject: () => {
    const settings = getAppSettings()
    activeProjectId = settings.lastProjectId ?? null
    return activeProjectId
  },
  onActiveProjectChanged: (listener: ActiveProjectListener) => {
    emitter.on('activeProjectChanged', listener)
    return () => emitter.off('activeProjectChanged', listener)
  },
}
