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

test('la página de nueva contraseña es alcanzable y muestra el formulario (regresión routing)', async ({ page }) => {
  // /cuenta/index.vue + /cuenta/nueva-contrasena.vue son rutas hermanas; la página de reset
  // debe renderizar su propio formulario, no la pantalla de login de /cuenta.
  await page.goto('/cuenta/nueva-contrasena', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: /Guardar contraseña/i })).toBeVisible()
  await expect(page.getByPlaceholder(/Nueva contraseña/i)).toBeVisible()
})

test('quiz: completa los 4 pasos y recomienda productos', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/quiz')
  await expect(page.locator('.quiz-opt').first()).toBeVisible()
  for (let i = 0; i < 4; i++) {
    await page.locator('.quiz-opt').first().click()
    await page.waitForTimeout(180)
  }
  await expect(page.getByText('Esto es para ti')).toBeVisible()
  await expect(page.locator('.quiz-grid .pcard').first()).toBeVisible()
})

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
