import { test, expect } from '@playwright/test'
import { esperarHidratacion } from './hidratacion'

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
  // Suprime el WelcomeModal (timer): su iframe de GoHighLevel retrasaría el load que se espera abajo.
  await page.addInitScript(() => localStorage.setItem('amanti_welcome_seen', '1'))
})

test.describe('PWA', () => {
  test('home enlaza el manifest y el apple-touch-icon, sin errores de página', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await esperarHidratacion(page)

    // link[rel="manifest"] con href "/manifest.webmanifest"
    const manifestLink = page.locator('link[rel="manifest"]')
    await expect(manifestLink).toHaveCount(1)
    await expect(manifestLink).toHaveAttribute('href', '/manifest.webmanifest')

    // link[rel="apple-touch-icon"] existe
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1)

    // Sin errores de página en el home. Se espera también al evento load: lo que falla tarde
    // (scripts que se agregan al montar) quedaría fuera si se revisara justo al hidratar.
    await page.waitForLoadState('load')
    expect(pageErrors, `pageerror(s): ${pageErrors.join(' | ')}`).toEqual([])
  })

  test('los assets de la PWA responden 200', async ({ request }) => {
    const assets = [
      '/manifest.webmanifest',
      '/sw.js',
      '/icon-192.png',
      '/icon-512.png',
      '/apple-touch-icon.png',
    ]
    for (const path of assets) {
      const res = await request.get(`${path}`)
      expect(res.status(), `${path} debería responder 200`).toBe(200)
    }
  })

  test('el manifest parseado es válido (name AMANTI, display standalone, >=2 icons)', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest')
    expect(res.status()).toBe(200)

    const manifest = await res.json()
    expect(manifest.name).toContain('AMANTI')
    expect(manifest.display).toBe('standalone')
    expect(Array.isArray(manifest.icons)).toBe(true)
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2)
  })

  test('.pwa-bar no aparece sin beforeinstallprompt', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await esperarHidratacion(page)
    // El banner solo se monta cuando el navegador dispara beforeinstallprompt (canInstall).
    // En Playwright nunca se dispara, así que la barra no debe existir.
    await page.waitForTimeout(400)
    await expect(page.locator('.pwa-bar')).toHaveCount(0)
  })
})
