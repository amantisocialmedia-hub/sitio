import { test, expect } from '@playwright/test'

// Suprime age-gate y banner de cookies para que no tapen el contenido durante el smoke.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
})

// Smoke de montaje: cada página clave responde 200 y renderiza su encabezado, sin errores de consola graves.
const PAGES = [
  '/',
  '/tienda',
  '/tienda/vibrating-g',
  '/carrito',
  '/favoritos',
  '/blog',
  '/terminos',
  '/privacidad',
  '/garantias',
  '/pagos',
]

for (const path of PAGES) {
  test(`monta sin error: ${path}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(String(e)))
    const res = await page.goto(path, { waitUntil: 'domcontentloaded' })
    expect(res?.status(), `status de ${path}`).toBeLessThan(400)
    // hay un encabezado h1/h2 visible (PageHeader o hero)
    await expect(page.locator('h1, h2').first()).toBeVisible()
    expect(errors, `errores JS en ${path}`).toEqual([])
  })
}

test('PDP con slug inexistente muestra "no encontrado" sin crashear', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  // La app renderiza la UI de "no encontrado" en 200 (soft 404), no un 404 duro.
  const res = await page.goto('/tienda/no-existe-xyz', { waitUntil: 'domcontentloaded' })
  expect(res?.status()).toBeLessThan(500)
  await expect(page.getByText(/producto no encontrado/i)).toBeVisible()
  await expect(page.getByRole('link', { name: /volver a la tienda/i })).toBeVisible()
  expect(errors, 'errores JS en slug inexistente').toEqual([])
})
