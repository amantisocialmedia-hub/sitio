import { test, expect } from '@playwright/test'

// Modo discreto (ojo del header): al activarlo SIEMPRE debe haber un aviso visible con
// salida obvia — antes en móvil quedaba todo difuminado "sin explicación" (QA móvil).
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
})

test.describe('Modo discreto — aviso visible y salida obvia', () => {
  test('activar muestra la franja; tocarla desactiva y restaura todo', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })

    // Sin modo discreto no hay franja.
    await expect(page.locator('.discreet-note')).toHaveCount(0)

    await page.locator('.discreet-btn').click()
    await expect(page.locator('html')).toHaveClass(/discreet/)

    const note = page.locator('.discreet-note')
    await expect(note).toBeVisible()
    await expect(note).toContainText('Modo discreto activado')

    // La franja misma es la salida: tocarla apaga el modo y desaparece.
    await note.click()
    await expect(page.locator('html')).not.toHaveClass(/discreet/)
    await expect(page.locator('.discreet-note')).toHaveCount(0)
  })

  test('el modo persiste al recargar y el aviso sigue presente (también @390)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/', { waitUntil: 'networkidle' })

    await page.locator('.discreet-btn').click()
    await expect(page.locator('html')).toHaveClass(/discreet/)

    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('html')).toHaveClass(/discreet/)
    await expect(page.locator('.discreet-note')).toBeVisible()

    // Y el ojo sigue permitiendo volver (paridad con la franja).
    await page.locator('.discreet-btn').click()
    await expect(page.locator('html')).not.toHaveClass(/discreet/)
    await expect(page.locator('.discreet-note')).toHaveCount(0)
  })
})
