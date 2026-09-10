import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
})

test.describe('Blog hub (/blog)', () => {
  test('muestra el destacado y el resto de articulos como cards en "Todo"', async ({ page }) => {
    await page.goto('/blog', { waitUntil: 'networkidle' })

    // Artículo destacado visible (solo se renderiza en la categoría "Todo")
    await expect(page.locator('.blogfeat')).toBeVisible()

    // En "Todo" la grilla lista articles.slice(1): todos menos el destacado. El conteo se
    // saca de data/articles.json en vez de clavarlo, porque la Eroteca crece con el plan
    // editorial (7 articulos programados desde sep-2026) y el numero fijo rompia el test
    // cada vez que se publica uno, sin comprobar nada mas.
    const ruta = fileURLToPath(new URL('../../data/articles.json', import.meta.url))
    const total = JSON.parse(readFileSync(ruta, 'utf8')).articles.length
    const cards = page.locator('.bloggrid .blogcard')
    await expect(cards).toHaveCount(total - 1)
  })

  test('filtrar por "Salud Sexual" oculta el destacado y deja al menos 1 card', async ({ page }) => {
    await page.goto('/blog', { waitUntil: 'networkidle' })

    // El chip es un <button class="chip"> con el texto exacto de la categoría
    const chip = page.locator('button.chip', { hasText: 'Salud Sexual' })
    await expect(chip).toBeVisible()
    await chip.click()
    // El cambio de categoría re-renderiza la lista y quita el destacado
    await page.waitForTimeout(400)

    // El destacado solo existe en "Todo": al cambiar de categoría desaparece del DOM
    await expect(page.locator('.blogfeat')).toHaveCount(0)

    // Sigue habiendo al menos una card de la categoría seleccionada
    const cards = page.locator('.bloggrid .blogcard')
    expect(await cards.count()).toBeGreaterThanOrEqual(1)
  })
})

test.describe('Artículo (/blog/iniciacion-anal)', () => {
  test('hero, contenido editorial, sin errores y sin overflow @390', async ({ page }) => {
    // Ancho de móvil pequeño para verificar que no haya scroll horizontal
    await page.setViewportSize({ width: 390, height: 844 })

    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    await page.goto('/blog/iniciacion-anal', { waitUntil: 'networkidle' })

    // Hero editorial con el título del artículo
    await expect(page.locator('.bloghero h1')).toBeVisible()

    // El cuerpo del artículo (article.prose.blogprose) tiene >= 5 h2 y >= 1 ul
    const h2 = page.locator('.blogprose h2')
    expect(await h2.count()).toBeGreaterThanOrEqual(5)

    const ul = page.locator('.blogprose ul')
    expect(await ul.count()).toBeGreaterThanOrEqual(1)
    await expect(ul.first()).toBeVisible()

    // Carrusel de productos relacionados al final del artículo: título de marca + 3–8 cards.
    const related = page.locator('.related-products')
    await expect(related).toBeVisible()
    await expect(related.locator('.rp-title')).toHaveText('Productos para ti')
    const relCards = related.locator('.pcard')
    const n = await relCards.count()
    expect(n).toBeGreaterThanOrEqual(3)
    expect(n).toBeLessThanOrEqual(8)
    // Va después del contenido del artículo (en el orden del DOM).
    const order = await page.evaluate(() => {
      const art = document.querySelector('article.blogprose')
      const rel = document.querySelector('.related-products')
      return art && rel ? (art.compareDocumentPosition(rel) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 : false
    })
    expect(order).toBe(true)

    // Sin errores de página (excepciones JS no controladas)
    expect(pageErrors).toEqual([])

    // Sin overflow horizontal a 390px
    const ov = await page.evaluate(() =>
      Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    )
    expect(ov).toBeLessThanOrEqual(1)
  })
})
