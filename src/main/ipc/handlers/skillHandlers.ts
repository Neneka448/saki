/**
 * Skill IPC Handlers
 */

import { ipcMain } from 'electron'
import { channels } from '../../../shared/ipc/channels'
import type { KernelApi } from '../../../kernel'

export function registerSkillHandlers(kernel: KernelApi): void {
  ipcMain.handle(channels.skill.getAll, () => {
    return kernel.skill.getAll()
  })

  ipcMain.handle(channels.skill.getSummaries, () => {
    return kernel.skill.getSummaries()
  })

  ipcMain.handle(channels.skill.getById, (_event, id: string) => {
    return kernel.skill.getById(id)
  })

  ipcMain.handle(channels.skill.getByName, (_event, name: string) => {
    return kernel.skill.getByName(name)
  })

  ipcMain.handle(channels.skill.validate, (_event, content: string, excludeId?: string) => {
    return kernel.skill.validate(content, excludeId)
  })

  ipcMain.handle(channels.skill.add, (_event, content: string) => {
    const result = kernel.skill.create(content)
    if (result.success) {
      _event.sender.send(channels.skill.onChanged)
    }
    return result
  })

  ipcMain.handle(channels.skill.update, (_event, id: string, content: string) => {
    const result = kernel.skill.update(id, content)
    if (result.success) {
      _event.sender.send(channels.skill.onChanged)
    }
    return result
  })

  ipcMain.handle(channels.skill.delete, (_event, id: string) => {
    const result = kernel.skill.delete(id)
    if (result.success) {
      _event.sender.send(channels.skill.onChanged)
    }
    return result
  })

  ipcMain.handle(channels.skill.getPromptXml, () => {
    return kernel.skill.getPromptXml()
  })

  ipcMain.handle(channels.skill.getNames, () => {
    return kernel.skill.getNames()
  })

  ipcMain.handle(channels.skill.formatActivatedSkill, (_event, skill: any) => {
    return kernel.skill.formatActivatedSkill(skill)
  })
}
