import { app } from 'electron'
import fs from 'fs'
import path from 'path'

export const DEFAULT_QUICK_CAPTURE_SHORTCUT = 'CommandOrControl+Shift+N'

export interface AppSettings {
  quickCaptureShortcut: string
  lastProjectId: number | null
}

let cachedSettings: AppSettings = {
  quickCaptureShortcut: DEFAULT_QUICK_CAPTURE_SHORTCUT,
  lastProjectId: null,
}

const getSettingsPath = () => {
  return path.join(app.getPath('userData'), 'app-settings.json')
}

const sanitizeShortcut = (value: unknown) => {
  if (typeof value !== 'string') return DEFAULT_QUICK_CAPTURE_SHORTCUT
  const trimmed = value.trim()
  return trimmed || DEFAULT_QUICK_CAPTURE_SHORTCUT
}

export const loadAppSettings = (): AppSettings => {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    cachedSettings = {
      ...cachedSettings,
      ...parsed,
    }
    cachedSettings.quickCaptureShortcut = sanitizeShortcut(cachedSettings.quickCaptureShortcut)
  } catch {
    // ignore missing or invalid file, keep defaults
  }
  return cachedSettings
}

export const getAppSettings = () => cachedSettings

export const saveAppSettings = (next: Partial<AppSettings>) => {
  cachedSettings = {
    ...cachedSettings,
    ...next,
  }
  cachedSettings.quickCaptureShortcut = sanitizeShortcut(cachedSettings.quickCaptureShortcut)
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(cachedSettings, null, 2))
  } catch {
    // ignore persistence errors
  }
  return cachedSettings
}
