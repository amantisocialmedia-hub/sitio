import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('./', import.meta.url))

export default defineConfig({
  resolve: {
    alias: { '~': root, '@': root },
  },
  test: {
    environment: 'happy-dom',
    include: ['test/unit/**/*.test.ts', 'test/smoke/**/*.test.ts'],
    globals: true,
  },
})
