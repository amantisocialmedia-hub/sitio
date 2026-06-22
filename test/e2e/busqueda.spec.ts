import { test, expect } from '@playwright/test'

// Buscador instantáneo del header (components/SiteHeader.vue + assets/css/main.css).
// El input vive en .searchrow .searchbox con placeholder "Búsqueda Rápida"; al enfocar
// y escribir >= 2 caracteres aparece .searchpop con hasta 6 .sr-item (slice(0,6) en el
// composable). Cada .sr-item es un NuxtLink a /tienda/<slug>. Sin coincidencias se muestra
// .sr-empty. Verificamos también que a 390px de ancho no haya overflow horizontal.

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
})

// Mide el overflow horizontal real del documento.
async function horizontalOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
  )
}

test('home: escribir "vibra" muestra .searchpop con 1-6 resultados y el primero navega a /tienda/<slug>', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })

  // El input del buscador instantáneo (placeholder real "Búsqueda Rápida").
  const input = page.getByPlaceholder('Búsqueda Rápida')
  await expect(input).toBeVisible()

  // Foco + texto: el dropdown se abre cuando hay >= 2 caracteres y el input tiene foco.
  await input.click()
  await input.fill('vibra')
  await page.waitForTimeout(300) // estabiliza el render reactivo del dropdown

  const pop = page.locator('.searchpop')
  await expect(pop).toBeVisible()

  // Entre 1 y 6 resultados (el composable hace slice(0, 6)).
  const items = pop.locator('.sr-item')
  const count = await items.count()
  expect(count).toBeGreaterThanOrEqual(1)
  expect(count).toBeLessThanOrEqual(6)

  // Con resultados, NO debe verse el estado vacío y SÍ el botón "ver todos".
  await expect(pop.locator('.sr-empty')).toHaveCount(0)
  await expect(pop.locator('.sr-all')).toBeVisible()

  // Cada .sr-item enlaza a una ficha de producto /tienda/<slug>.
  const first = items.first()
  const href = await first.getAttribute('href')
  expect(href).toMatch(/^\/tienda\/[^/]+$/)

  // Click en el primero: navega a la ficha del producto.
  await first.click()
  await page.waitForTimeout(400) // transición de navegación
  await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
  // La ruta resultante es una ficha de /tienda/<slug>.
  expect(new URL(page.url()).pathname).toMatch(/^\/tienda\/[^/]+$/)
})

test('home: escribir "zxqwk" (sin coincidencias) muestra .sr-empty', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })

  const input = page.getByPlaceholder('Búsqueda Rápida')
  await expect(input).toBeVisible()

  await input.click()
  await input.fill('zxqwk')
  await page.waitForTimeout(300)

  const pop = page.locator('.searchpop')
  await expect(pop).toBeVisible()

  // Sin resultados: aparece .sr-empty y no hay .sr-item ni el botón "ver todos".
  await expect(pop.locator('.sr-empty')).toBeVisible()
  await expect(pop.locator('.sr-item')).toHaveCount(0)
  await expect(pop.locator('.sr-all')).toHaveCount(0)
})

test('home: a 390px de ancho el buscador no provoca overflow horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'networkidle' })

  const input = page.getByPlaceholder('Búsqueda Rápida')
  await expect(input).toBeVisible()

  // Con el dropdown abierto (que es absolute y podría desbordar si estuviera mal contenido).
  await input.click()
  await input.fill('vibra')
  await page.waitForTimeout(300)
  await expect(page.locator('.searchpop')).toBeVisible()

  const ov = await horizontalOverflow(page)
  expect(ov).toBeLessThanOrEqual(1)
})