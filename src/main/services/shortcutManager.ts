import { globalShortcut } from 'electron'
import { showQuickCaptureWindow } from '../windows/quickCaptureWindow'
import {
  DEFAULT_QUICK_CAPTURE_SHORTCUT,
  getAppSettings,
  loadAppSettings,
  saveAppSettings,
} from '../state/appSettings'

let currentQuickCaptureShortcut = ''

const normalizeShortcut = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

const applyQuickCaptureShortcut = (shortcut: string) => {
  const normalized = normalizeShortcut(shortcut)
  if (!normalized) {
    return { ok: false, error: '快捷键不能为空', shortcut: '', defaultShortcut: DEFAULT_QUICK_CAPTURE_SHORTCUT }
  }
  if (normalized === currentQuickCaptureShortcut) {
    return { ok: true, shortcut: normalized, defaultShortcut: DEFAULT_QUICK_CAPTURE_SHORTCUT }
  }

  const previous = currentQuickCaptureShortcut
  if (previous) {
    globalShortcut.unregister(previous)
  }

  const registered = globalShortcut.register(normalized, () => {
    showQuickCaptureWindow()
  })

  if (!registered) {
    if (previous) {
      globalShortcut.register(previous, () => {
        showQuickCaptureWindow()
      })
    }
    return { ok: false, error: `无法注册快捷键：${normalized}`, shortcut: previous, defaultShortcut: DEFAULT_QUICK_CAPTURE_SHORTCUT }
  }

  currentQuickCaptureShortcut = normalized
  return { ok: true, shortcut: normalized, defaultShortcut: DEFAULT_QUICK_CAPTURE_SHORTCUT }
}

export const initShortcutManager = () => {
  const settings = loadAppSettings()
  const applied = applyQuickCaptureShortcut(settings.quickCaptureShortcut)
  if (!applied.ok) {
    applyQuickCaptureShortcut(DEFAULT_QUICK_CAPTURE_SHORTCUT)
    saveAppSettings({ quickCaptureShortcut: DEFAULT_QUICK_CAPTURE_SHORTCUT })
  }
}

export const getQuickCaptureShortcutInfo = () => {
  const stored = getAppSettings().quickCaptureShortcut || DEFAULT_QUICK_CAPTURE_SHORTCUT
  return {
    shortcut: currentQuickCaptureShortcut || stored,
    defaultShortcut: DEFAULT_QUICK_CAPTURE_SHORTCUT,
  }
}

export const setQuickCaptureShortcut = (shortcut: string) => {
  const applied = applyQuickCaptureShortcut(shortcut)
  if (!applied.ok) return applied
  saveAppSettings({ quickCaptureShortcut: applied.shortcut })
  return applied
}

export const resetQuickCaptureShortcut = () => {
  return setQuickCaptureShortcut(DEFAULT_QUICK_CAPTURE_SHORTCUT)
}
