import { test, expect } from '@playwright/test'

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
