# Architecture Overview

## Runtime boundaries
- main: Electron main process, window lifecycle and IPC handlers.
- preload: Secure bridge for exposing APIs to the renderer.
- renderer: Vue app (webview-facing UI).
- shared: Shared constants and IPC channel names.

## Source layout
- src/main: backend logic, window creation, and IPC handlers.
- src/preload: bridge modules exposed via contextBridge.
- src/renderer: Vite-powered renderer entry (Vue, script setup).
- src/shared: shared IPC definitions.
