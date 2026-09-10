import { test, expect } from '@playwright/test'
import { precioVigente } from '../../utils/campana'

// Suprime age-gate y banner de cookies (overlays globales) para poder interactuar.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
})

test('home muestra el carrusel de productos más populares', async ({ page }) => {
  await page.goto('/')
  // "Sex toys más populares" es un carrusel de tarjetas de producto con foto + overlay.
  await expect(page.locator('.poprail')).toBeVisible()
  await expect(page.locator('.poprail .popcard').first()).toBeVisible()
  // Cada tarjeta enlaza a su ficha de producto.
  await expect(page.locator('.poprail .popcard').first()).toHaveAttribute('href', /\/tienda\/.+/)
})

test('tienda: filtrar por categoría y abrir una ficha', async ({ page }) => {
  await page.goto('/tienda')
  await expect(page.locator('.pcard').first()).toBeVisible()

  // filtrar por una categoría (el filtro usa estado local; el título refleja la categoría)
  await page.locator('label.fopt', { hasText: 'Vibradores' }).click()
  await expect(page.locator('h1')).toHaveText('Vibradores')
  await expect(page.locator('.pcard').first()).toBeVisible()

  // abrir una ficha
  await page.locator('.pcard a.pthumb').first().click()
  await expect(page).toHaveURL(/\/tienda\/.+/)
  await expect(page.locator('h1')).toBeVisible()
})

test('agregar al carrito sube el badge y aparece en /carrito', async ({ page }) => {
  await page.goto('/tienda/vibrating-g')
  await expect(page.locator('h1')).toContainText('Firmeza Vibrante')

  // el botón de WhatsApp de la ficha apunta a wa.me con el número
  const waHref = await page.locator('a.btn.wa').getAttribute('href')
  expect(waHref).toContain('wa.me/5214431112233')

  // agregar al carrito
  await page.getByRole('button', { name: /Añadir al carrito/i }).click()
  const badge = page.locator('a[href="/carrito"] .cart-c').first()
  await expect(badge).toHaveText('1')

  // ir al carrito
  await page.goto('/carrito')
  await expect(page.getByText('Firmeza Vibrante').first()).toBeVisible()
  // El total sale del precio de lista pasado por la campana, no de un numero fijo: con el
  // 40% encendido "Firmeza Vibrante" cobra 553 y no 921, y clavar cualquiera de los dos
  // deja el test rojo en cuanto alguien prenda o apague la venta (utils/campana.ts).
  const esperado = precioVigente(921)
  await expect(page.locator('.sline.total')).toContainText(String(esperado))

  // botón de WhatsApp del pedido existe
  await expect(page.getByRole('button', { name: /Ordenar por WhatsApp/i })).toBeVisible()
})
