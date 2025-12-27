/// <reference types="vite/client" />

import type { appBridge } from '../../preload/bridges/appBridge'
import type { projectBridge } from '../../preload/bridges/projectBridge'
import type { cardBridge } from '../../preload/bridges/cardBridge'
import type { tagBridge } from '../../preload/bridges/tagBridge'
import type { relationBridge } from '../../preload/bridges/relationBridge'
import type { assetBridge } from '../../preload/bridges/assetBridge'

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>
  export default component
}

declare global {
  interface Window {
    app: typeof appBridge
    project: typeof projectBridge
    card: typeof cardBridge
    tag: typeof tagBridge
    relation: typeof relationBridge
    asset: typeof assetBridge
  }
}

export { }
