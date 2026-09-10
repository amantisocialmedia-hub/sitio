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

test.describe('Carrito · modo regalo', () => {
  test('completa quiz, activa modo regalo, llena campos y persiste tras recarga', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    // 1) Completa el quiz: 4 preguntas, un clic por paso en .quiz-opt.
    await page.goto('/quiz', { waitUntil: 'domcontentloaded' })
    await esperarHidratacion(page)
    for (let step = 0; step < 4; step++) {
      const opt = page.locator('.quiz-opt').first()
      await expect(opt).toBeVisible()
      await opt.click()
      // Las transiciones qfade cambian de paso; espera a que asiente.
      await page.waitForTimeout(400)
    }

    // 2) Resultado: añade el match #1 al carrito.
    const addBtn = page.getByRole('button', { name: /Añadir mi match al carrito/ })
    await expect(addBtn).toBeVisible()
    await addBtn.click()
    await page.waitForTimeout(400)

    // 3) Carrito: debe haber al menos un producto (no estado vacío).
    // Sin networkidle: en /carrito depende de terceros. El 10-sep, en una corrida quedaron abiertas
    // más de 45s peticiones a challenges.cloudflare.com (en lo medido llegan junto con el formulario
    // de GoHighLevel del pie); minutos después llegó a idle en 1 a 13s. La espera de verdad es el
    // .giftbox, que solo se pinta ya hidratado y con el carrito restaurado.
    await page.goto('/carrito', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.giftbox')).toBeVisible({ timeout: 15_000 })

    // El toggle de regalo está presente; los campos NO existen aún.
    const toggle = page.locator('.gift-toggle input')
    await expect(toggle).toBeVisible()
    await expect(toggle).not.toBeChecked()
    await expect(page.locator('.gift-fields')).toHaveCount(0)

    // 4) Marca el checkbox → aparecen los campos de regalo.
    await toggle.check()
    await page.waitForTimeout(300)
    const fields = page.locator('.gift-fields')
    await expect(fields).toBeVisible()

    // 5) Llena el primer input (Para / recipient) y el textarea (mensaje).
    const recipient = fields.locator('input').first()
    const message = fields.locator('textarea')
    await expect(recipient).toBeVisible()
    await expect(message).toBeVisible()

    const RECIPIENT_VAL = 'Alex'
    const MESSAGE_VAL = 'Con todo mi cariño 💜'
    await recipient.fill(RECIPIENT_VAL)
    await message.fill(MESSAGE_VAL)
    await expect(recipient).toHaveValue(RECIPIENT_VAL)
    await expect(message).toHaveValue(MESSAGE_VAL)

    // Da margen a que pinia persista el estado en localStorage.
    await page.waitForTimeout(400)

    // 6) Recarga: el checkbox sigue marcado y el input conserva su valor.
    await page.reload({ waitUntil: 'domcontentloaded' })

    const toggleAfter = page.locator('.gift-toggle input')
    await expect(toggleAfter).toBeChecked({ timeout: 15_000 })

    const fieldsAfter = page.locator('.gift-fields')
    await expect(fieldsAfter).toBeVisible()
    await expect(fieldsAfter.locator('input').first()).toHaveValue(RECIPIENT_VAL)
    await expect(fieldsAfter.locator('textarea')).toHaveValue(MESSAGE_VAL)

    // 7) Sin overflow horizontal en viewport móvil (390px).
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(300)
    const ov = await page.evaluate(() =>
      Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    )
    expect(ov).toBeLessThanOrEqual(1)
  })
})