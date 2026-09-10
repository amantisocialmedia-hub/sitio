import { test, expect } from '@playwright/test'
import { esperarHidratacion } from './hidratacion'

// La búsqueda del sitio tiene que llegar a GA4 (composables/useAnalytics.ts -> evento `search`).
// Raúl pidió saber "qué es lo que más andan buscando" y hasta sep-2026 eso no se guardaba en
// ningún lado: la única forma de verlo era revisar a mano.
//
// Se lee el dataLayer y NO un window.gtag espía, por dos razones: el plugin de tracking pisa
// window.gtag con gtagPush en cuanto arranca (plugins/tracking.client.ts), y sobre todo porque
// el dataLayer es donde se escondió el error caro de ago-2026 — gtag.js sólo obedece entradas
// que son un objeto `arguments`, y con Arrays normales todo se ve bien y no llega nada. Leer
// aquí prueba el camino completo, no sólo que se llamó a una función.

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
  // Sin la librería de Google el dataLayer queda intacto y el test no depende de la red.
  await page.route('https://www.googletagmanager.com/**', r => r.abort())
  // Suprime el WelcomeModal (timer): su overlay intercepta clicks a media prueba.
  await page.addInitScript(() => localStorage.setItem('amanti_welcome_seen', '1'))
})

const searches = (page: import('@playwright/test').Page) =>
  page.evaluate(() =>
    ((window as any).dataLayer || [])
      .map((e: any) => Array.from(e as ArrayLike<any>))
      .filter((a: any[]) => a[0] === 'event' && a[1] === 'search')
      .map((a: any[]) => a[2]),
  )

test('buscar desde el header manda search al dataLayer con el término y el número de resultados', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await esperarHidratacion(page)

  const input = page.getByPlaceholder('Búsqueda Rápida')
  await input.click()
  await input.fill('lubricante')
  await input.press('Enter')

  await page.waitForURL(/\/tienda\?q=lubricante/)
  await page.waitForTimeout(500)

  const hits = await searches(page)
  expect(hits).toHaveLength(1)
  expect(hits[0].search_term).toBe('lubricante')
  // El catálogo tiene lubricantes: la búsqueda no puede reportar cero.
  expect(hits[0].search_results).toBeGreaterThan(0)
})

test('elegir un resultado del pop también registra la búsqueda (no pasa por /tienda?q=)', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await esperarHidratacion(page)

  const input = page.getByPlaceholder('Búsqueda Rápida')
  await input.click()
  await input.fill('vibra')
  await page.waitForTimeout(300)

  const first = page.locator('.searchpop .sr-item').first()
  await expect(first).toBeVisible()
  await first.click()
  await page.waitForTimeout(500)

  const hits = await searches(page)
  expect(hits.length).toBeGreaterThanOrEqual(1)
  expect(hits[0].search_term).toBe('vibra')
  expect(hits[0].search_results).toBeGreaterThan(0)
})

test('una búsqueda sin resultados se registra con search_results en 0', async ({ page }) => {
  await page.goto('/tienda?q=zxqwk', { waitUntil: 'domcontentloaded' })
  await esperarHidratacion(page)
  await page.waitForTimeout(500)

  const hits = await searches(page)
  expect(hits).toHaveLength(1)
  expect(hits[0]).toEqual({ search_term: 'zxqwk', search_results: 0 })
})

test('cambiar un filtro con la búsqueda puesta no vuelve a mandar el mismo evento', async ({ page }) => {
  await page.goto('/tienda?q=lubricante', { waitUntil: 'domcontentloaded' })
  await esperarHidratacion(page)
  await page.waitForTimeout(500)
  expect(await searches(page)).toHaveLength(1)

  // Misma búsqueda, otro filtro: se navega dentro de la SPA para que NO se recargue la página
  // (una recarga reinicia el dataLayer y el test no probaría nada).
  await page.locator('.searchpop').waitFor({ state: 'hidden' }).catch(() => {})
  await page.evaluate(() => window.history.pushState({}, '', '/tienda?q=lubricante&sort=precio-asc'))
  await page.waitForTimeout(500)

  expect(await searches(page)).toHaveLength(1)
})
