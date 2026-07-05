import { test, expect } from '@playwright/test'

// Modo discreto (ojo del header): al activarlo SIEMPRE debe haber un aviso visible con
// salida obvia — antes en móvil quedaba todo difuminado "sin explicación" (QA móvil).
test.beforeEach(async ({ context, page }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
  // Suprime el WelcomeModal (timer): su overlay intercepta clicks a media prueba.
  await page.addInitScript(() => localStorage.setItem('amanti_welcome_seen', '1'))
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

  test('difumina lo sensible pero NUNCA la página completa (bug :global del hero)', async ({ page }) => {
    // La home carga el chunk de HeroEditorial, cuyo :global mal compilado emitía
    // html.discreet{filter:blur(12px)} y difuminaba TODO el viewport.
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.locator('.discreet-btn').click()
    await expect(page.locator('html')).toHaveClass(/discreet/)

    const htmlFilter = await page.evaluate(() => getComputedStyle(document.documentElement).filter)
    expect(htmlFilter).toBe('none') // la página NO se difumina completa

    const imgFilter = await page.evaluate(() => {
      const el = document.querySelector('.hm-img, .pimg')
      return el ? getComputedStyle(el).filter : 'sin-imagen'
    })
    expect(imgFilter).toContain('blur') // lo sensible SÍ se difumina
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
