import { test, expect } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
})

test.describe('Proxy /api/chat', () => {
  test('POST con message y sessionId → 200 y response string no vacío', async ({ request }) => {
    const res = await request.post('/api/chat', {
      data: { message: 'hola', sessionId: 't1' },
    })
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(typeof json.response).toBe('string')
    expect(json.response.trim().length).toBeGreaterThan(0)
  })

  test('POST sin message → 400', async ({ request }) => {
    const res = await request.post('/api/chat', {
      data: { sessionId: 'x' },
    })
    expect(res.status()).toBe(400)
  })
})

test.describe('Widget de chat EROS en el home', () => {
  test('abre el panel, muestra saludo y responde a un mensaje', async ({ page }) => {
    const pageErrors: Error[] = []
    page.on('pageerror', (err) => pageErrors.push(err))

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/', { waitUntil: 'networkidle' })

    // Launcher visible (el widget se monta dentro de ClientOnly)
    const launcher = page.locator('.eros-launcher')
    await expect(launcher).toBeVisible()

    // Abrir el panel
    await launcher.click()
    await page.waitForTimeout(400) // transición de entrada del panel

    const panel = page.locator('.eros-panel')
    await expect(panel).toBeVisible()

    // Saludo inicial: al menos 1 mensaje bot
    await expect(panel.locator('.ep-msg.bot')).toHaveCount(1)

    // Escribir y enviar
    const input = panel.locator('.ep-input input')
    await input.fill('hola, quiero una recomendación')
    await page.waitForTimeout(200)

    const sendBtn = panel.locator('.ep-send')
    await expect(sendBtn).toBeEnabled()
    await sendBtn.click()
    await page.waitForTimeout(300)

    // Aparece exactamente 1 mensaje del usuario
    await expect(panel.locator('.ep-msg.user')).toHaveCount(1)

    // Eventualmente 2 mensajes bot reales (excluye el indicador de "escribiendo")
    // El typing temporal lleva la clase .ep-typing; lo descartamos del conteo.
    await expect(panel.locator('.ep-msg.bot:not(.ep-typing)')).toHaveCount(2, { timeout: 35000 })

    // Sin errores de página en toda la interacción
    expect(pageErrors).toEqual([])
  })
})

// Enlace directo al chat (?chat=1 / #chat). Lo pidió Emilio para la campaña de WhatsApp de
// sep-2026: el link tiene que caer con EROS ya abierto, sin buscar el botón flotante.
test.describe('Abrir EROS desde la URL', () => {
  test('?chat=1 abre el panel solo, sin tocar el launcher', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/?chat=1', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    await expect(page.locator('.eros-panel')).toBeVisible()
    // Con el panel abierto el launcher se esconde (v-show="!open").
    await expect(page.locator('.eros-launcher')).toBeHidden()
    await expect(page.locator('.eros-panel .ep-msg.bot')).toHaveCount(1)
  })

  test('funciona con las utm de la pauta en la misma URL y fuera del home', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/tienda?utm_source=whatsapp&utm_medium=cpc&chat=1', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await expect(page.locator('.eros-panel')).toBeVisible()
  })

  test('#chat también lo abre', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/#chat', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await expect(page.locator('.eros-panel')).toBeVisible()
  })

  test('sin el parámetro el chat sigue cerrado', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await expect(page.locator('.eros-panel')).toHaveCount(0)
    await expect(page.locator('.eros-launcher')).toBeVisible()
  })
})
