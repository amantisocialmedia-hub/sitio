import { defineConfig, devices } from '@playwright/test'

// Puerto configurable, y ya no el 3010: en la maquina de Memo ese cae dentro del rango que
// Windows reserva (Hyper-V/WSL) y node truena con EACCES antes de escuchar, asi que Playwright
// no podia levantar su servidor y NINGUN e2e corria. Se puede pisar con E2E_PORT.
const PORT = Number(process.env.E2E_PORT || 3457)
const BASE = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './test/e2e',
  // 45s: la página /tienda optimiza 143 imágenes con ipx en el primer load del server frío
  // (en prod van por CDN/Vercel). Da holgura bajo varios workers en paralelo.
  timeout: 45_000,
  fullyParallel: false,
  // Cap de 2 workers: reduce la contención cuando varios specs golpean /tienda en frío
  // (optimización de imágenes ipx) y vuelve la suite determinista. En CI fresco sobra holgura.
  workers: 2,
  // 1 reintento: absorbe hipos transitorios de los tests que tocan Supabase (rate-limit de auth).
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE,
    headless: true,
    trace: 'off',
  },
  // Un solo proyecto desktop. La cobertura móvil vive en responsive.spec.ts, que fija el viewport
  // con setViewportSize(393) — así no forzamos a los specs desktop a un layout donde algunos
  // controles (p.ej. los filtros colapsados) quedarían ocultos.
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
      // Modo test del webhook: SOLO se activa fuera de producción. Por eso forzamos NODE_ENV!=production
      // aquí; en prod (Vercel) NODE_ENV='production' deshabilita el bypass aunque la var existiera.
      NODE_ENV: 'test',
      // El webhook exige __test_secret === MP_WEBHOOK_TEST_MODE para simular pagos (ausente en prod).
      MP_WEBHOOK_TEST_MODE: '1',
    },
    port: PORT,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
