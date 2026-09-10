import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// E2E autenticado. Requiere credenciales por env (NO van al repo):
//   SB_URL, SB_ANON, SB_SVC  → siembra un usuario confirmado y prueba el flujo real.
// Sin esas env vars, el bloque se omite (mantiene verde el CI sin secretos).
const { SB_URL, SB_ANON, SB_SVC } = process.env as Record<string, string>
const email = `amanti.qa.e2e.${Date.now()}@gmail.com`
const pass = 'AmantiQA1234!'
let admin: any = null
let uid: string | null = null

test.describe('cuenta autenticada', () => {
  test.skip(!SB_URL || !SB_ANON || !SB_SVC, 'requiere SB_URL/SB_ANON/SB_SVC')

  test.beforeAll(async () => {
    admin = createClient(SB_URL, SB_SVC, { auth: { persistSession: false } })
    const { data, error } = await admin.auth.admin.createUser({
      email, password: pass, email_confirm: true,
      user_metadata: { full_name: 'QA Inicial', phone: '' },
    })
    if (error) throw error
    uid = data.user.id
  })
  test.afterAll(async () => { if (admin && uid) await admin.auth.admin.deleteUser(uid) })

  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([
      { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
      { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
    ])
    // Suprime el WelcomeModal (timer): su overlay intercepta clicks a media prueba.
    await page.addInitScript(() => localStorage.setItem('amanti_welcome_seen', '1'))
  })

  async function login(page: any) {
    await page.goto('/cuenta')
    await page.getByPlaceholder('Correo').fill(email)
    await page.getByPlaceholder('Contraseña').fill(pass)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible({ timeout: 15000 })
  }

  test('FASE B · editar perfil persiste full_name y phone', async ({ page }) => {
    await login(page)
    const name = page.getByPlaceholder('Tu nombre')
    await expect(name).toHaveValue('QA Inicial', { timeout: 10000 })
    await name.fill('QA Editado')
    await page.getByPlaceholder('Tu teléfono (opcional)').fill('4431234567')
    await page.getByRole('button', { name: /Guardar cambios/ }).click()
    await expect(page.getByText('Perfil actualizado ✓')).toBeVisible()
    // persiste tras recargar
    await page.reload()
    await expect(page.getByPlaceholder('Tu nombre')).toHaveValue('QA Editado', { timeout: 10000 })
  })

  test('FASE C · CRUD de direcciones (crear, editar, predeterminada, borrar)', async ({ page }) => {
    page.on('dialog', d => d.accept()) // acepta el confirm de borrar
    await login(page)
    await page.getByRole('button', { name: 'Direcciones' }).click()

    // estado vacío
    await expect(page.getByText('Aún no tienes direcciones guardadas')).toBeVisible({ timeout: 10000 })

    // crear (sin predeterminada)
    await page.getByRole('button', { name: 'Agregar mi primera dirección' }).click()
    await page.getByPlaceholder('Casa, Oficina…').fill('Casa')
    await page.getByPlaceholder('Av. Siempre Viva 742').fill('Calle Falsa 123')
    await page.getByPlaceholder('Ciudad').fill('Morelia')
    await page.getByPlaceholder('Estado').fill('Michoacán')
    await page.getByPlaceholder('00000').fill('58000')
    await page.getByRole('button', { name: 'Guardar dirección' }).click()
    await expect(page.getByText('Dirección agregada ✓')).toBeVisible()
    await expect(page.getByText('Calle Falsa 123')).toBeVisible()

    // editar (cambia ciudad)
    await page.getByRole('button', { name: 'Editar' }).click()
    await page.getByPlaceholder('Ciudad').fill('Uruapan')
    await page.getByRole('button', { name: 'Guardar dirección' }).click()
    await expect(page.getByText('Dirección actualizada ✓')).toBeVisible()
    await expect(page.getByText(/Uruapan/)).toBeVisible()

    // marcar predeterminada
    await page.getByRole('button', { name: 'Hacer predeterminada' }).click()
    await expect(page.locator('.adef')).toBeVisible()

    // borrar -> vuelve a estado vacío
    await page.getByRole('button', { name: 'Borrar' }).click()
    await expect(page.getByText('Aún no tienes direcciones guardadas')).toBeVisible({ timeout: 10000 })
  })

  test('FASE D · estado vacío sin pedidos', async ({ page }) => {
    await login(page)
    await page.getByRole('button', { name: 'Pedidos' }).click()
    await expect(page.getByText('Aún no tienes pedidos')).toBeVisible({ timeout: 10000 })
  })

  test('FASE D · lista un pedido sembrado y muestra su detalle', async ({ page }) => {
    // sembrar order + items con la service_role (bypassa RLS). Solo lectura en la UI.
    const { data: order } = await admin.from('orders')
      .insert({ user_id: uid, status: 'paid', total: 2026, currency: 'MXN', payment_method: 'mercadopago' })
      .select().single()
    await admin.from('order_items').insert([
      { order_id: order.id, product_slug: 'vibrating-g', product_name: 'Vibrating G', quantity: 2, unit_price: 1013, line_total: 2026, image_url: '/products/vibrating-g_1.jpg' },
    ])
    try {
      await login(page)
      await page.getByRole('button', { name: 'Pedidos' }).click()
      const folio = '#' + String(order.id).slice(0, 8).toUpperCase()
      await expect(page.getByText(folio)).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('Pagado')).toBeVisible()
      await expect(page.getByText('$ 2,026')).toBeVisible()
      // expandir detalle
      await page.getByText(folio).click()
      await expect(page.getByText('Vibrating G')).toBeVisible()
      await expect(page.getByText('x2')).toBeVisible()
    } finally {
      await admin.from('orders').delete().eq('id', order.id)
    }
  })
})
