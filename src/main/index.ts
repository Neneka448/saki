import { app, BrowserWindow, protocol, globalShortcut, Menu } from 'electron'
import path from 'path'
import fs from 'fs'
import { createMainWindow } from './windows/mainWindow'
import { registerIpcHandlers } from './ipc'
import { createKernel, KernelApi } from '../kernel'
import { initShortcutManager } from './services/shortcutManager'

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL) || process.env.NODE_ENV === 'development'

if (isDev) {
  app.setPath('userData', path.join(app.getAppPath(), '.runtime'))
}

let kernel: KernelApi | null = null

/**
 * 获取数据库路径
 */
function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'knowledge.db')
}

/**
 * 获取资源目录路径
 */
function getAssetsPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'assets')
}

// 注册自定义协议（必须在 app ready 之前）
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'asset',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
    },
  },
])

app.whenReady().then(() => {
  // 注册 asset:// 协议处理器
  protocol.handle('asset', (request) => {
    const filename = request.url.replace('asset://', '')
    const filePath = path.join(getAssetsPath(), filename)

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return new Response('Not Found', { status: 404 })
    }

    // 读取文件并返回
    const fileBuffer = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
    }
    const contentType = mimeTypes[ext] || 'application/octet-stream'

    return new Response(fileBuffer, {
      headers: { 'Content-Type': contentType },
    })
  })

  // 初始化 Kernel
  const dbPath = getDbPath()
  console.log(`[Main] Initializing kernel with db: ${dbPath}`)
  kernel = createKernel({ dbPath })

  // 注册 IPC handlers
  registerIpcHandlers(kernel)

  // 设置应用菜单（macOS 需要菜单才能使用 Cmd+C/V/X/A 等快捷键）
  if (process.platform === 'darwin') {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: '编辑',
        submenu: [
          { role: 'undo', label: '撤销' },
          { role: 'redo', label: '重做' },
          { type: 'separator' },
          { role: 'cut', label: '剪切' },
          { role: 'copy', label: '复制' },
          { role: 'paste', label: '粘贴' },
          { role: 'pasteAndMatchStyle', label: '粘贴并匹配样式' },
          { role: 'delete', label: '删除' },
          { role: 'selectAll', label: '全选' },
        ],
      },
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  }

  // 创建主窗口
  createMainWindow()

  initShortcutManager()

  app.on('activate', () => {
    if (process.platform === 'darwin' && BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  // 关闭 Kernel
  if (kernel) {
    kernel.close()
    console.log('[Main] Kernel closed')
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
