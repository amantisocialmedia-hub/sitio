import { test, expect } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
})

test.describe('PWA', () => {
  test('home enlaza el manifest y el apple-touch-icon, sin errores de página', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    await page.goto('/', { waitUntil: 'networkidle' })

    // link[rel="manifest"] con href "/manifest.webmanifest"
    const manifestLink = page.locator('link[rel="manifest"]')
    await expect(manifestLink).toHaveCount(1)
    await expect(manifestLink).toHaveAttribute('href', '/manifest.webmanifest')

    // link[rel="apple-touch-icon"] existe
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1)

    // Sin errores de página en el home
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
      const res = await request.get(`http://localhost:3010${path}`)
      expect(res.status(), `${path} debería responder 200`).toBe(200)
    }
  })

  test('el manifest parseado es válido (name AMANTI, display standalone, >=2 icons)', async ({ request }) => {
    const res = await request.get('http://localhost:3010/manifest.webmanifest')
    expect(res.status()).toBe(200)

    const manifest = await res.json()
    expect(manifest.name).toContain('AMANTI')
    expect(manifest.display).toBe('standalone')
    expect(Array.isArray(manifest.icons)).toBe(true)
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2)
  })

  test('.pwa-bar no aparece sin beforeinstallprompt', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    // El banner solo se monta cuando el navegador dispara beforeinstallprompt (canInstall).
    // En Playwright nunca se dispara, así que la barra no debe existir.
    await page.waitForTimeout(400)
    await expect(page.locator('.pwa-bar')).toHaveCount(0)
  })
})
