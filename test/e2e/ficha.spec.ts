import { test, expect } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
})

test.describe('Ficha de producto /tienda/vibrating-g', () => {
  test('contenido, galería con lightbox y sin overflow @390', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/tienda/vibrating-g', { waitUntil: 'networkidle' })

    // El título de la ficha debe estar visible (confirma que el producto cargó).
    await expect(page.locator('h1')).toContainText('Vibrating G')

    // --- Bloque de confianza: exactamente 5 ítems ---
    await expect(page.locator('.trustlist .ti')).toHaveCount(5)

    // --- Nota de meses sin intereses visible (price 1013 ≥ 300) ---
    await expect(page.locator('.msi-note')).toBeVisible()

    // --- Chips de características: la pestaña "Descripción" es la activa por defecto ---
    const firstChip = page.locator('.spec-chips .spec-chip').first()
    await expect(firstChip).toBeVisible()

    // --- Galería: click en la imagen principal "zoomable" abre el lightbox ---
    const mainImg = page.locator('.gallery .main.zoomable')
    await expect(mainImg).toBeVisible()
    await mainImg.click()
    await page.waitForTimeout(400) // transición "lb"

    const lightbox = page.locator('.lightbox')
    await expect(lightbox).toBeVisible()
    await expect(page.locator('.lb-img')).toBeVisible()

    // --- Si hay contador, navegar con .lb-next cambia el número ---
    const count = page.locator('.lb-count')
    if (await count.count()) {
      const before = (await count.textContent())?.trim()
      await page.locator('.lb-next').click()
      await page.waitForTimeout(300)
      const after = (await count.textContent())?.trim()
      expect(after).not.toBe(before)
    }

    // --- Escape cierra el lightbox (teleportado a body: debe desaparecer del DOM) ---
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    await expect(page.locator('.lightbox')).toHaveCount(0)

    // --- Sin overflow horizontal @390 ---
    const ov = await page.evaluate(
      () => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    )
    expect(ov).toBeLessThanOrEqual(1)

    // --- Sin errores de página en toda la interacción ---
    expect(errors).toEqual([])
  })
})
