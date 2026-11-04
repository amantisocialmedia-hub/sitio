import base from './playwright.config'
// UI aislada: sin credenciales de Supabase ni conexión a la base real.
export default {
  ...base,
  testMatch: '**/shipping.spec.ts',
  webServer: {
    ...base.webServer,
    reuseExistingServer: false,
    env: { ...(base.webServer as any).env,
      NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
      NUXT_PUBLIC_SUPABASE_KEY: 'local-test-only',
    },
  },
}
