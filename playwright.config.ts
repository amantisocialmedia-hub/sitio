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
    env: {
      PORT: String(PORT),
      NUXT_PUBLIC_WHATSAPP_PHONE: '5214431112233',
      // Para los tests de pedidos (Etapa 3): se pasa la service_role desde el shell (SB_SVC),
      // nunca hardcodeada. Sin ella, los endpoints de orden responden 500 (tests env-gated).
      SUPABASE_SERVICE_ROLE_KEY: process.env.SB_SVC || '',
      // Token MP dummy: deja pasar el check y ejercita la creación del order; la llamada a MP
      // falla (401) y el order queda 'pending'. En prod el token real va en NUXT_MP_ACCESS_TOKEN.
      NUXT_MP_ACCESS_TOKEN: 'TEST-MP-INVALID',
    },
    port: PORT,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
