import { test, expect } from '@playwright/test'
import { esperarHidratacion } from './hidratacion'

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
  // Suprime el WelcomeModal (timer): su overlay intercepta clicks a media prueba.
  await page.addInitScript(() => localStorage.setItem('amanti_welcome_seen', '1'))
})

test.describe('Carrito · extras (vacío, freeship, paytrust)', () => {
  test('carrito vacío muestra enlace de "Inicia sesión" en .emptybox', async ({ page }) => {
    // Sin networkidle (ver regalo.spec.ts). .emptybox solo se pinta ya montado: antes se ve
    // "Cargando tu carrito…" (pages/carrito.vue, bandera ready).
    await page.goto('/carrito', { waitUntil: 'domcontentloaded' })

    const empty = page.locator('.emptybox')
    await expect(empty).toBeVisible({ timeout: 15_000 })

    // El bloque vacío invita a iniciar sesión para un checkout más rápido.
    const loginLink = empty.getByRole('link', { name: /Inicia sesión/i })
    await expect(loginLink).toBeVisible()
  })

  test('con producto: .freeship y .paytrust visibles, .fs-msg menciona GRATIS, sin overflow @390', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: 'reduce' })

    // Completa el quiz: 4 preguntas, una opción por paso.
    await page.goto('/quiz', { waitUntil: 'domcontentloaded' })
    await esperarHidratacion(page)

    for (let step = 0; step < 4; step++) {
      const opt = page.locator('.quiz-opt').first()
      await expect(opt).toBeVisible()
      await opt.click()
      // Transición qfade entre pasos / al resultado.
      await page.waitForTimeout(400)
    }

    // Vista de resultado: añade el match #1 al carrito.
    const addBtn = page.getByRole('button', { name: /Añadir mi match al carrito/i })
    await expect(addBtn).toBeVisible()
    await addBtn.click()
    await page.waitForTimeout(500)

    // Va al carrito (el item persiste en localStorage vía Pinia persist). Sin networkidle: ahí
    // depende de terceros (ver regalo.spec.ts); se espera el resumen, que solo se pinta ya hidratado.
    await page.goto('/carrito', { waitUntil: 'domcontentloaded' })

    // El resumen del pedido se renderiza (no estado vacío).
    const freeship = page.locator('.freeship')
    await expect(freeship).toBeVisible({ timeout: 15_000 })

    const paytrust = page.locator('.paytrust')
    await expect(paytrust).toBeVisible()

    // El mensaje de envío gratis menciona "GRATIS" (faltante o ya conseguido).
    const fsMsg = page.locator('.freeship .fs-msg')
    await expect(fsMsg).toBeVisible()
    await expect(fsMsg).toContainText(/GRATIS/)

    // Sin overflow horizontal en móvil 390.
    const ov = await page.evaluate(() =>
      Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    )
    expect(ov).toBeLessThanOrEqual(1)
  })
})
