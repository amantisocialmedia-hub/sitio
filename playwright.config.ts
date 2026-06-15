import { defineConfig, devices } from '@playwright/test'

const PORT = 3010
const BASE = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30_000,
  fullyParallel: false,
  // 1 reintento: absorbe hipos transitorios de los tests que tocan Supabase (rate-limit de auth).
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE,
    headless: true,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node .output/server/index.mjs`,
    env: { PORT: String(PORT), NUXT_PUBLIC_WHATSAPP_PHONE: '5214431112233' },
    port: PORT,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
