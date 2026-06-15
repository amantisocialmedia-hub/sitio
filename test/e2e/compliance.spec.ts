import { test, expect } from '@playwright/test'

// SIN beforeEach de cookies: aquí validamos los overlays en su estado inicial.

test('age gate aparece, se acepta, y el banner de cookies funciona', async ({ page }) => {
  await page.goto('/tienda')

  // El contenido SSR existe (SEO) aunque el overlay tape visualmente
  await expect(page.locator('.pcard').first()).toBeVisible()

  // Age gate +18 visible
  const gate = page.locator('.ag')
  await expect(gate).toBeVisible()
  await expect(gate).toContainText('mayor de 18')

  // Aceptar +18 -> desaparece
  await page.getByRole('button', { name: /Sí, soy mayor de 18/i }).click()
  await expect(gate).toHaveCount(0)

  // Banner de cookies visible -> Rechazar lo cierra (y no carga trackers)
  const cc = page.locator('.cc')
  await expect(cc).toBeVisible()
  await page.getByRole('button', { name: 'Rechazar' }).click()
  await expect(cc).toHaveCount(0)

  // No se cargó GA tras rechazar
  const hasGA = await page.evaluate(() => typeof (window as any).gtag === 'function')
  expect(hasGA).toBe(false)
})

test('age gate: "No" muestra mensaje de salida', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^No$/ }).click()
  await expect(page.locator('.ag')).toContainText(/debes ser mayor de 18/i)
})
