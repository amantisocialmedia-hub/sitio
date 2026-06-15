import { test, expect } from '@playwright/test'

// El age-gate (overlay full-screen) y el banner de cookies tapan la UI; los suprimimos
// pre-seteando sus cookies para poder validar la app.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
})

test('form de contacto: valida y arma WhatsApp con los datos', async ({ page, context }) => {
  await page.goto('/contacto')

  // el botón está deshabilitado hasta aceptar Términos/Privacidad
  await expect(page.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled()
  await page.locator('.consent input[type="checkbox"]').check()
  await expect(page.getByRole('button', { name: 'Enviar mensaje' })).toBeEnabled()

  // validación: vacío -> error
  await page.getByRole('button', { name: 'Enviar mensaje' }).click()
  await expect(page.getByText('Escribe tu nombre.')).toBeVisible()

  // correo inválido
  await page.getByPlaceholder('Tu nombre').fill('Memo Prueba')
  await page.getByPlaceholder('Tu correo').fill('correo-malo')
  await page.getByRole('button', { name: 'Enviar mensaje' }).click()
  await expect(page.getByText('Escribe un correo válido.')).toBeVisible()

  // válido -> arma WhatsApp con nombre + correo + mensaje (interceptamos window.open)
  await page.getByPlaceholder('Tu correo').fill('memo@example.com')
  await page.getByPlaceholder('¿En qué te ayudamos?').fill('Quiero info de envíos')
  await page.evaluate(() => { (window as any).__waUrl = ''; window.open = (u?: any) => { (window as any).__waUrl = String(u); return null } })
  await page.getByRole('button', { name: 'Enviar mensaje' }).click()
  const url = decodeURIComponent(await page.evaluate(() => (window as any).__waUrl))
  expect(url).toContain('wa.me/')
  expect(url).toContain('Memo Prueba')
  expect(url).toContain('memo@example.com')
  expect(url).toContain('Quiero info de envíos')

  // confirmación visible
  await expect(page.getByText(/Te contactaremos pronto/i)).toBeVisible()
})
