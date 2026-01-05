/**
 * Skill API Bridge
 */

import { ipcRenderer } from 'electron'
import { channels } from '../../shared/ipc/channels'
import type { SkillDefinition, SkillSummary, ParsedSkill } from '../../shared/skills/types'
import type { Result } from '../../kernel/api/Result'

export const skillBridge = {
  /**
   * 获取所有 Skills
   */
  getAll: (): Promise<Result<SkillDefinition[]>> => {
    return ipcRenderer.invoke(channels.skill.getAll)
  },

  /**
   * 获取所有 Skills 摘要
   */
  getSummaries: (): Promise<Result<SkillSummary[]>> => {
    return ipcRenderer.invoke(channels.skill.getSummaries)
  },

  /**
   * 根据 ID 获取 Skill
   */
  getById: (id: string): Promise<Result<SkillDefinition | null>> => {
    return ipcRenderer.invoke(channels.skill.getById, id)
  },

  /**
   * 根据名称获取 Skill
   */
  getByName: (name: string): Promise<Result<SkillDefinition | null>> => {
    return ipcRenderer.invoke(channels.skill.getByName, name)
  },

  /**
   * 验证 Skill 内容
   */
  validate: (
    content: string,
    excludeId?: string
  ): Promise<Result<ParsedSkill>> => {
    return ipcRenderer.invoke(channels.skill.validate, content, excludeId)
  },

  /**
   * 添加 Skill
   */
  add: (
    content: string
  ): Promise<Result<SkillDefinition>> => {
    return ipcRenderer.invoke(channels.skill.add, content)
  },

  /**
   * 更新 Skill
   */
  update: (
    id: string,
    content: string
  ): Promise<Result<SkillDefinition>> => {
    return ipcRenderer.invoke(channels.skill.update, id, content)
  },

  /**
   * 删除 Skill
   */
  delete: (id: string): Promise<Result<void>> => {
    return ipcRenderer.invoke(channels.skill.delete, id)
  },

  /**
   * 获取 Skills 的 XML 提示词
   */
  getPromptXml: (): Promise<Result<string>> => {
    return ipcRenderer.invoke(channels.skill.getPromptXml)
  },

  /**
   * 获取所有 Skill 名称
   */
  getNames: (): Promise<Result<string[]>> => {
    return ipcRenderer.invoke(channels.skill.getNames)
  },

  /**
   * 格式化激活的 Skill
   */
  formatActivatedSkill: (skill: SkillDefinition): Promise<Result<string>> => {
    return ipcRenderer.invoke(channels.skill.formatActivatedSkill, skill)
  },

  /**
   * 监听 Skills 变化
   */
  onChanged: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on(channels.skill.onChanged, listener)
    return () => {
      ipcRenderer.removeListener(channels.skill.onChanged, listener)
    }
  },
}
