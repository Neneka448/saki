import { contextBridge } from 'electron'
import { appBridge } from './bridges/appBridge'
import { projectBridge } from './bridges/projectBridge'
import { cardBridge } from './bridges/cardBridge'
import { tagBridge } from './bridges/tagBridge'
import { relationBridge } from './bridges/relationBridge'
import { assetBridge } from './bridges/assetBridge'

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('app', appBridge)
contextBridge.exposeInMainWorld('project', projectBridge)
contextBridge.exposeInMainWorld('card', cardBridge)
contextBridge.exposeInMainWorld('tag', tagBridge)
contextBridge.exposeInMainWorld('relation', relationBridge)
contextBridge.exposeInMainWorld('asset', assetBridge)
