import { test, expect } from '@playwright/test'

// Suprime age-gate y banner de cookies (overlays globales).
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
})

// Bug 4: entrar a una subcolección debe filtrar por esa subcategoría, no mostrar
// TODA la categoría. Solo navega y cuenta (sin clicks → no depende de overlays).
test('subcategoría: muestra SOLO sus productos, no toda la categoría', async ({ page }) => {
  // Categoría completa.
  await page.goto('/tienda?cat=masturbadores', { waitUntil: 'networkidle' })
  await expect(page.locator('.pcard').first()).toBeVisible()
  const totalCat = await page.locator('.pcard').count()
  expect(totalCat).toBeGreaterThan(1)

  // Subcategoría: el título refleja la subcategoría y el listado es un subconjunto.
  await page.goto('/tienda?cat=masturbadores&sub=pocket-pussy', { waitUntil: 'networkidle' })
  await expect(page.locator('h1')).toHaveText('Pocket Pussy')
  await expect(page.locator('.pcard').first()).toBeVisible()
  const subCount = await page.locator('.pcard').count()
  expect(subCount).toBeGreaterThan(0)
  expect(subCount).toBeLessThan(totalCat)
})

// Bug 3: el menú no muestra subcategorías vacías. "Calzón Vibrador" (0 productos) no
// debe aparecer en el desplegable de Vibradores, mientras que "Bala Vibradora" sí.
test('menú: oculta subcategorías sin productos y muestra las que sí tienen', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  // El desplegable de Vibradores es el único que contiene "Bala Vibradora".
  // (Los enlaces están en el DOM aunque el dropdown solo se muestre al hover → contamos por DOM.)
  const dropdown = page.locator('ul.menu .dropdown', { hasText: 'Bala Vibradora' })
  await expect(dropdown).toHaveCount(1)
  await expect(dropdown.locator('a', { hasText: 'Bala Vibradora' })).toHaveCount(1)
  // "Calzón Vibrador" (0 productos) no aparece.
  await expect(dropdown.locator('a', { hasText: 'Calzón Vibrador' })).toHaveCount(0)
})
