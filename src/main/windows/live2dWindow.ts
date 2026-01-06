import { BrowserWindow, screen } from 'electron'
import path from 'path'
import { getRendererUrl } from './rendererUrl'

let live2dWindow: BrowserWindow | null = null

export const createLive2DWindow = () => {
    if (live2dWindow && !live2dWindow.isDestroyed()) {
        live2dWindow.focus()
        return live2dWindow
    }

    // 获取主显示器尺寸，放在右下角
    const display = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = display.workAreaSize
    const windowWidth = 350
    const windowHeight = 500  // 适当降低高度

    live2dWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        x: screenWidth - windowWidth - 50,
        y: screenHeight - windowHeight - 50,
        frame: false,           // 无边框
        transparent: true,      // 透明背景
        alwaysOnTop: true,      // 置顶
        hasShadow: false,       // 无阴影
        resizable: false,       // 不可调整大小
        skipTaskbar: true,      // 不显示在任务栏（更像桌宠）
        focusable: true,        // 可获取焦点
        webPreferences: {
            preload: path.join(__dirname, '..', '..', 'preload', 'index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webSecurity: false,
        }
    })

    // 设置窗口级别为浮动（macOS），确保其他窗口关闭不影响它
    live2dWindow.setAlwaysOnTop(true, 'floating')

    // 防止窗口被其他窗口的关闭操作影响
    live2dWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    const rendererUrl = getRendererUrl('live2d.html')
    if (rendererUrl.startsWith('http')) {
        live2dWindow.loadURL(rendererUrl)
    } else {
        live2dWindow.loadFile(rendererUrl)
    }

    live2dWindow.on('closed', () => {
        live2dWindow = null
    })

    // 当窗口失去焦点时，确保它仍然置顶
    live2dWindow.on('blur', () => {
        if (live2dWindow && !live2dWindow.isDestroyed()) {
            live2dWindow.setAlwaysOnTop(true, 'floating')
        }
    })

    return live2dWindow
}

export const showLive2DWindow = () => {
    createLive2DWindow()
}

export const closeLive2DWindow = () => {
    if (live2dWindow && !live2dWindow.isDestroyed()) {
        live2dWindow.close()
        live2dWindow = null
    }
}

export const getLive2DWindow = () => live2dWindow
