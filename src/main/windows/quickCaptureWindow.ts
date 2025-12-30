import { BrowserWindow, screen } from 'electron'
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
    autoHideMenuBar: true,
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
    if (window.isVisible()) {
      window.hide()
    }
  })

  window.on('closed', () => {
    if (quickCaptureWindow === window) {
      quickCaptureWindow = null
    }
  })

  quickCaptureWindow = window
  return window
}

export const showQuickCaptureWindow = () => {
  const window = createQuickCaptureWindow()
  positionWindow(window)
  window.show()
  window.focus()
}

export const hideQuickCaptureWindow = () => {
  if (quickCaptureWindow?.isVisible()) {
    quickCaptureWindow.hide()
  }
}

export const getQuickCaptureWindow = () => quickCaptureWindow
