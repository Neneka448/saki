import { EventEmitter } from 'events'

type ActiveProjectListener = (projectId: number | null) => void

const emitter = new EventEmitter()
let activeProjectId: number | null = null

export const appState = {
  getActiveProjectId: () => activeProjectId,
  setActiveProjectId: (projectId: number | null) => {
    if (activeProjectId === projectId) return
    activeProjectId = projectId
    emitter.emit('activeProjectChanged', activeProjectId)
  },
  onActiveProjectChanged: (listener: ActiveProjectListener) => {
    emitter.on('activeProjectChanged', listener)
    return () => emitter.off('activeProjectChanged', listener)
  },
}
