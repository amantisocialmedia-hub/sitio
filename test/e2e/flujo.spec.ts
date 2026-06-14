import { test, expect } from '@playwright/test'

test('home muestra el mosaico de categorías', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.mosaic')).toBeVisible()
  await expect(page.locator('.mosaic')).toContainText('Vibradores')
  await expect(page.locator('.mosaic')).toContainText('Dildos')
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
  await expect(page.locator('h1')).toContainText('Vibrating G')

  // el botón de WhatsApp de la ficha apunta a wa.me con el número
  const waHref = await page.locator('a.btn.wa').getAttribute('href')
  expect(waHref).toContain('wa.me/5214431112233')

  // agregar al carrito
  await page.getByRole('button', { name: /Añadir al carrito/i }).click()
  const badge = page.locator('a[href="/carrito"] .cart-c').first()
  await expect(badge).toHaveText('1')

  // ir al carrito
  await page.goto('/carrito')
  await expect(page.getByText('Vibrating G').first()).toBeVisible()
  await expect(page.locator('.sline.total')).toContainText('1,013')

  // botón de WhatsApp del pedido existe
  await expect(page.getByRole('button', { name: /Ordenar por WhatsApp/i })).toBeVisible()
})
