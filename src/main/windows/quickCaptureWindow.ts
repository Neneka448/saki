import { BrowserWindow, screen, app } from 'electron'
import path from 'path'
import { getRendererUrl } from './rendererUrl'

const WINDOW_WIDTH = 560
const WINDOW_HEIGHT = 420
const CURSOR_OFFSET_Y = 12

let quickCaptureWindow: BrowserWindow | null = null

const positionWindow = (window: BrowserWindow) => {
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { x, y, width, height } = display.workArea

  const bounds = window.getBounds()
  const winWidth = bounds.width
  const winHeight = bounds.height

  const nextX = Math.round(
    Math.min(Math.max(cursor.x - winWidth / 2, x), x + width - winWidth)
  )
  const nextY = Math.round(
    Math.min(Math.max(cursor.y + CURSOR_OFFSET_Y, y), y + height - winHeight)
  )

  window.setPosition(nextX, nextY, false)
}

export const createQuickCaptureWindow = () => {
  if (quickCaptureWindow) return quickCaptureWindow

  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    resizable: false,
    show: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    backgroundColor: '#f7f9fd',
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  })

  const rendererUrl = getRendererUrl('quick.html')
  if (rendererUrl.startsWith('http')) {
    window.loadURL(rendererUrl)
  } else {
    window.loadFile(rendererUrl)
  }

  window.on('blur', () => {
    if (!window.isDestroyed() && !isPinned) {
      window.close()
    }
  })

  window.on('closed', () => {
    if (quickCaptureWindow === window) {
      quickCaptureWindow = null
      // 不重置 isPinned，保持用户的选择
    }
  })

  quickCaptureWindow = window
  return window
}

// 窗口固定状态（默认置顶）
let isPinned = true

export const setQuickCapturePinned = (pinned: boolean) => {
  isPinned = pinned
}

export const isQuickCapturePinned = () => isPinned

export const showQuickCaptureWindow = () => {
  const window = createQuickCaptureWindow()
  if (process.platform === 'darwin' && typeof window.moveToActiveSpace === 'function') {
    window.moveToActiveSpace()
  }
  positionWindow(window)
  window.show()
  window.focus()
}

export const hideQuickCaptureWindow = () => {
  if (!quickCaptureWindow || quickCaptureWindow.isDestroyed()) return
  quickCaptureWindow.close()
  // 不重置 isPinned，保持用户的选择
  if (process.platform === 'darwin') {
    app.hide()
  }
}

export const getQuickCaptureWindow = () => quickCaptureWindow
