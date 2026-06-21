import { test, expect } from '@playwright/test'

// Cobertura móvil (~393px, bajo el breakpoint de 560px): burger/drawer, toggle de filtros y
// el flujo de carrito sin recorte. Fija el viewport explícitamente para no depender del device.
const MOBILE = { width: 393, height: 851 }

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
  await page.setViewportSize(MOBILE)
})

test('móvil: el drawer abre desde el burger y expone subcategorías + carrito', async ({ page }) => {
  await page.goto('/')
  // El menú de escritorio está oculto por CSS; el acceso móvil es el burger.
  await expect(page.locator('ul.menu')).toBeHidden()
  await page.locator('button.burger').click()
  const panel = page.locator('.drawer.open .panel')
  await expect(panel).toBeVisible()

  // Acordeón: abrir "Vibradores" revela subcategorías (no solo el rótulo).
  await panel.locator('summary', { hasText: 'Vibradores' }).click()
  await expect(panel.locator('a.sub', { hasText: 'Bala Vibradora' })).toBeVisible()
  // Enlaces de cuenta/favoritos/carrito presentes en el drawer.
  await expect(panel.getByRole('link', { name: /Carrito/ })).toBeVisible()
})

test('móvil: los filtros están colapsados y el botón "Filtrar" los revela', async ({ page }) => {
  await page.goto('/tienda')
  await expect(page.locator('.pcard').first()).toBeVisible()
  // Los filtros NO se ven hasta tocar "Filtrar" (productos primero).
  await expect(page.locator('aside.filters')).toBeHidden()
  await page.getByRole('button', { name: 'Filtrar' }).click()
  await expect(page.locator('aside.filters')).toBeVisible()
  await page.locator('label.fopt', { hasText: 'Vibradores' }).click()
  await expect(page.locator('h1')).toHaveText('Vibradores')
})

test('móvil: flujo carrito + WhatsApp no se recorta a 393px', async ({ page }) => {
  await page.goto('/tienda/vibrating-g')
  await page.getByRole('button', { name: /Añadir al carrito/i }).click()
  await page.goto('/carrito')
  await expect(page.getByText('Vibrating G').first()).toBeVisible()
  await expect(page.locator('.sline.total')).toBeVisible()
  const wa = page.getByRole('button', { name: /Ordenar por WhatsApp/i })
  await expect(wa).toBeVisible()
  await wa.scrollIntoViewIfNeeded()
  await expect(wa).toBeInViewport() // detecta recorte/cobertura del CTA tras hacer scroll
})
