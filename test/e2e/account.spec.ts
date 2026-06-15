import { test, expect } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
})

test('/cuenta sin sesión muestra login y registro; el registro exige Términos', async ({ page }) => {
  await page.goto('/cuenta')

  // pestaña login por defecto
  await expect(page.getByPlaceholder('Correo')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible()

  // cambiar a registro
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByPlaceholder('Nombre completo')).toBeVisible()

  // Registrarme deshabilitado hasta aceptar Términos
  const reg = page.getByRole('button', { name: 'Registrarme' })
  await expect(reg).toBeDisabled()
  await page.locator('.consent input[type="checkbox"]').check()
  await expect(reg).toBeEnabled()
})

test('login con credenciales inválidas muestra error en español', async ({ page }) => {
  await page.goto('/cuenta')
  await page.getByPlaceholder('Correo').fill('noexiste.qa@gmail.com')
  await page.getByPlaceholder('Contraseña').fill('claveincorrecta123')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  // mensaje mapeado a español (credenciales o no confirmado)
  await expect(page.locator('.auth-msg.bad')).toBeVisible({ timeout: 15000 })
})
