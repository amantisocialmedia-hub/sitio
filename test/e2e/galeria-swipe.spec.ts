import { test, expect, type Page } from '@playwright/test'

// Swipe táctil de la galería (QA móvil): deslizar entre fotos con el dedo, sin abrir
// el lightbox por accidente y con el indicador (dots/miniaturas) sincronizado.
// conejo-travieso tiene 5 fotos → ejercita también dots más allá de las 4 miniaturas.
const SLUG = '/tienda/conejo-travieso'

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
})

/** Gesto táctil horizontal real (CDP) sobre la imagen principal de la galería.
 *  La galería queda bajo el fold @390 → hay que traerla al viewport ANTES de tocar
 *  (las coordenadas CDP son relativas al viewport; fuera de él el gesto cae en HTML). */
async function swipeMain(page: Page, dx: number) {
  const main = page.locator('.gallery .main')
  await main.scrollIntoViewIfNeeded()
  const box = await main.boundingBox()
  if (!box) throw new Error('galería no visible')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] })
  for (const f of [0.35, 0.7, 1]) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + dx * f, y: cy }] })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

test.describe('Galería móvil: swipe entre fotos', () => {
  test('swipe navega, sincroniza indicadores, no abre lightbox y no da la vuelta', async ({ page }) => {
    await page.goto(SLUG, { waitUntil: 'networkidle' })

    const dots = page.locator('.gdots .gd')
    const nDots = await dots.count()
    expect(nDots).toBeGreaterThan(1) // el indicador existe (una por foto)

    // Estado inicial: primera foto activa (dot y miniatura).
    await expect(dots.first()).toHaveClass(/on/)
    await expect(page.locator('.thumbs .t').first()).toHaveClass(/active/)

    // ← Swipe a la izquierda: avanza a la foto 2; dots y miniaturas se sincronizan.
    await swipeMain(page, -120)
    await page.waitForTimeout(500) // transición gslide
    await expect(dots.nth(1)).toHaveClass(/on/)
    await expect(page.locator('.thumbs .t').nth(1)).toHaveClass(/active/)
    await expect(page.locator('.lightbox')).toHaveCount(0) // el swipe NO abre el lightbox

    // → Swipe a la derecha: regresa a la foto 1.
    await swipeMain(page, 120)
    await page.waitForTimeout(500)
    await expect(dots.first()).toHaveClass(/on/)

    // → Swipe a la derecha en la primera foto: se queda (sin loop).
    await swipeMain(page, 120)
    await page.waitForTimeout(500)
    await expect(dots.first()).toHaveClass(/on/)

    // Un swipe corto (< 40px) no navega.
    await swipeMain(page, -24)
    await page.waitForTimeout(400)
    await expect(dots.first()).toHaveClass(/on/)

    // El tap sigue abriendo el lightbox (pasada la ventana anti-click-fantasma).
    await page.waitForTimeout(400)
    await page.locator('.gallery .main').tap()
    await page.waitForTimeout(400)
    await expect(page.locator('.lightbox')).toBeVisible()
  })

  test('el swipe vertical se queda como scroll (no navega fotos)', async ({ page }) => {
    await page.goto(SLUG, { waitUntil: 'networkidle' })
    const dots = page.locator('.gdots .gd')
    await expect(dots.first()).toHaveClass(/on/)

    // Gesto diagonal dominado por Y: debe scrollear, no cambiar de foto.
    const main = page.locator('.gallery .main')
    await main.scrollIntoViewIfNeeded()
    const box = await main.boundingBox()
    if (!box) throw new Error('galería no visible')
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] })
    for (const f of [0.35, 0.7, 1]) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - 50 * f, y: cy - 160 * f }] })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()

    await page.waitForTimeout(400)
    await expect(dots.first()).toHaveClass(/on/) // sigue en la foto 1
  })
})
