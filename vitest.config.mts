import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [vue()],
    test: {
        include: [
            'src/kernel/__tests__/**/*.test.ts',
            'src/main/__tests__/**/*.test.ts',
            'src/renderer/src/**/__tests__/**/*.test.ts',
        ],
        environment: 'happy-dom',
        setupFiles: ['./src/test/setup.ts'],
    },
})
