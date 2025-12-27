# Development

## Scripts
- yarn dev: run Vite dev server + Electron.
- yarn build: compile main/preload to dist and build the renderer to dist/renderer.
- yarn preview: preview renderer build.

## Notes
- Renderer dev URL is injected via VITE_DEV_SERVER_URL.
- Build output is expected at dist/renderer for packaged builds.
- Main/preload TypeScript outputs to dist/main and dist/preload.
- Yarn is configured with node-modules linker for Electron compatibility.
- Dev runs store cache under .runtime in the project root.
