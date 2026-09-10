import { test, expect } from '@playwright/test'

// SIN beforeEach de cookies: aquí validamos los overlays en su estado inicial.

test('age gate aparece, se acepta, y el banner de cookies funciona', async ({ page }) => {
  // Suprime el WelcomeModal (timer): su overlay intercepta clicks a media prueba.
  await page.addInitScript(() => localStorage.setItem('amanti_welcome_seen', '1'))
  // Sin la librería de Google el dataLayer queda intacto y el test no depende de la red.
  await page.route('https://www.googletagmanager.com/**', r => r.abort())

  await page.goto('/tienda')

  // El contenido SSR existe (SEO) aunque el overlay tape visualmente
  await expect(page.locator('.pcard').first()).toBeVisible()

  // Age gate +18 visible
  const gate = page.locator('.ag')
  await expect(gate).toBeVisible()
  await expect(gate).toContainText('mayor de 18')

  // Aceptar +18 -> desaparece
  await page.getByRole('button', { name: /Sí, soy mayor de 18/i }).click()
  await expect(gate).toHaveCount(0)

  // Banner de cookies visible -> Rechazar lo cierra (y no carga trackers)
  const cc = page.locator('.cc')
  await expect(cc).toBeVisible()
  await page.getByRole('button', { name: 'Rechazar' }).click()
  await expect(cc).toHaveCount(0)

  // Rechazar no apaga Google: con Consent Mode v2 gtag carga SIEMPRE, con el consentimiento
  // denegado (plugins/tracking.client.ts), así que window.gtag existe y ya no sirve de prueba.
  // Lo que Rechazar garantiza es que el consentimiento se quede en 'denied' y que Clarity y
  // Meta Pixel, que no tienen un estado denegado, ni siquiera se carguen.
  const cookies = await page.context().cookies()
  expect(cookies.find((c) => c.name === 'amanti_cookie_consent')?.value).toBe('rejected')

  const leerTracking = () => page.evaluate(() => {
    const w = window as any
    const cmds = ((w.dataLayer || []) as ArrayLike<any>[]).map((e) => Array.from(e))
    const iDefault = cmds.findIndex((a) => a[0] === 'consent' && a[1] === 'default')
    const iConfig = cmds.findIndex((a) => a[0] === 'js' || a[0] === 'config')
    return {
      porDefecto: iDefault >= 0 ? cmds[iDefault][2] : null,
      // El default tiene que entrar ANTES de js/config, o gtag escribe cookies sin saberlo. Y debe
      // ser uno solo: otro default (por ejemplo, por región) cambiaría lo que Google aplica.
      defaultAntesDeConfig: iDefault >= 0 && iConfig > iDefault,
      defaults: cmds.filter((a) => a[0] === 'consent' && a[1] === 'default').length,
      actualizaciones: cmds.filter((a) => a[0] === 'consent' && a[1] === 'update').length,
      clarity: typeof w.clarity,
      fbq: typeof w.fbq,
    }
  })
  const NADA_CARGADO = { defaultAntesDeConfig: true, defaults: 1, actualizaciones: 0, clarity: 'undefined', fbq: 'undefined' }

  const trasRechazar = await leerTracking()
  expect(trasRechazar.porDefecto).toMatchObject({
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  })
  expect(trasRechazar).toMatchObject(NADA_CARGADO)

  // Quien ya rechazó y vuelve: el plugin decide una sola vez al arrancar, leyendo la cookie. Sin
  // recargar, esa rama nunca corre en el test. Se espera a que el plugin haya corrido; si no, el
  // dataLayer estaría vacío y todo "pasaría" en falso.
  await page.reload()
  await page.waitForFunction(() => (window as any).__amantiGoogleLoaded === true)
  expect(await leerTracking()).toMatchObject(NADA_CARGADO)
})

test('age gate: "No" muestra mensaje de salida', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^No$/ }).click()
  await expect(page.locator('.ag')).toContainText(/debes ser mayor de 18/i)
})
