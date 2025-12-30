import { app } from 'electron'
import path from 'path'

export const getRendererUrl = (page: string): string => {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  if (devServerUrl) {
    return new URL(page, devServerUrl).toString()
  }

  return path.join(app.getAppPath(), 'dist', 'renderer', page)
}
