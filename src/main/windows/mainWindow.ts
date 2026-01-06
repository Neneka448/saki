import { BrowserWindow } from 'electron'
import path from 'path'
import { getRendererUrl } from './rendererUrl'

export const createMainWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false, // 允许加载本地 Live2D 模型文件
    }
  })

  const rendererUrl = getRendererUrl('index.html')
  if (rendererUrl.startsWith('http')) {
    mainWindow.loadURL(rendererUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(rendererUrl)
  }

  return mainWindow
}
