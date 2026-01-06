import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

const root = path.resolve(__dirname, 'src/renderer')

export default defineConfig({
  root,
  base: './',
  publicDir: path.resolve(root, 'public'),
  plugins: [vue()],
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(root, 'index.html'),
        quick: path.resolve(root, 'quick.html'),
        live2d: path.resolve(root, 'live2d.html'),
      },
    },
  },
})
