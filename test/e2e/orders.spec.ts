import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// E2E de pedidos (Etapa 3). Requiere SB_URL/SB_ANON/SB_SVC por env (service_role, NO en el repo).
// El webServer recibe la service_role y un token MP dummy (MP falla 401 -> el order queda 'pending').
const { SB_URL, SB_ANON, SB_SVC } = process.env as Record<string, string>
const email = `amanti.qa.ord.${Date.now()}@gmail.com`
const pass = 'AmantiQA1234!'
let admin: any = null
let uid: string | null = null
let guestOk = false // ¿orders.user_id es nullable? (pedidos de invitado)

test.describe('pedidos · Etapa 3', () => {
  test.skip(!SB_URL || !SB_ANON || !SB_SVC, 'requiere SB_URL/SB_ANON/SB_SVC')

  test.beforeAll(async () => {
    admin = createClient(SB_URL, SB_SVC, { auth: { persistSession: false } })
    const { data } = await admin.auth.admin.createUser({ email, password: pass, email_confirm: true, user_metadata: { full_name: 'QA Ord' } })
    uid = data.user.id
    // Sonda: intenta crear un order de invitado (user_id null). Si pasa, guest habilitado.
    const probe = await admin.from('orders').insert({ status: 'pending', total: 0, currency: 'MXN', payment_method: '__probe__' }).select('id').single()
    if (!probe.error && probe.data) { guestOk = true; await admin.from('orders').delete().eq('id', probe.data.id) }
  })
  test.afterAll(async () => { if (admin && uid) await admin.auth.admin.deleteUser(uid) })
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
      { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
    ])
  })

  async function login(page: any) {
    await page.goto('/cuenta')
    await page.getByPlaceholder('Correo').fill(email)
    await page.getByPlaceholder('Contraseña').fill(pass)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible({ timeout: 15000 })
  }

  test('FASE A · checkout autenticado crea order pending + items con user_id', async ({ page }) => {
    await login(page)
    // fetch desde el navegador (incluye la cookie de sesión, como carrito.vue) -> user_id asociado
    const out = await page.evaluate(async () => {
      const r = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ items: [
          { slug: 'vibrating-g', name: 'Vibrating G', price: 1013, quantity: 2 },
          { slug: 'denzel', name: 'Denzel', price: 400, quantity: 1 },
        ] }),
      })
      return r.status
    })
    expect(out).toBe(502) // MP dummy falla, pero el order ya se creó

    const { data: orders } = await admin.from('orders')
      .select('*').eq('user_id', uid).eq('payment_method', 'mercadopago')
      .order('created_at', { ascending: false }).limit(1)
    expect(orders.length).toBe(1)
    const o = orders[0]
    expect(o.status).toBe('pending')
    expect(o.total).toBe(2426)
    expect(o.currency).toBe('MXN')

    const { data: items } = await admin.from('order_items')
      .select('*').eq('order_id', o.id).order('line_total', { ascending: false })
    expect(items.length).toBe(2)
    expect(items[0]).toMatchObject({ product_name: 'Vibrating G', quantity: 2, unit_price: 1013, line_total: 2026, product_slug: 'vibrating-g' })
    expect(items[0].image_url).toContain('/products/vibrating-g')

    await admin.from('orders').delete().eq('id', o.id)
  })

  test('FASE A · checkout de invitado crea order con user_id NULL', async ({ request }) => {
    test.skip(!guestOk, 'orders.user_id es NOT NULL — corre: ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;')
    const res = await request.post('/api/checkout', { data: { items: [{ slug: 'denzel', name: 'Denzel', price: 400, quantity: 1 }] } })
    expect(res.status()).toBe(502)
    const { data: orders } = await admin.from('orders')
      .select('*').is('user_id', null).eq('payment_method', 'mercadopago').eq('total', 400)
      .order('created_at', { ascending: false }).limit(1)
    expect(orders.length).toBe(1)
    await admin.from('orders').delete().eq('id', orders[0].id)
  })

  test('FASE B · webhook MP: aprobado -> paid (idempotente) y rechazado -> cancelled', async ({ request }) => {
    // order pending de prueba (con user_id para no depender del ALTER)
    const { data: order } = await admin.from('orders')
      .insert({ user_id: uid, status: 'pending', total: 500, currency: 'MXN', payment_method: 'mercadopago' })
      .select('id').single()
    const ref = order.id
    const hook = (pay: any) => request.post('/api/mp-webhook', {
      data: { type: 'payment', data: { id: pay.id }, __test_payment: pay },
    })
    const statusOf = async () => (await admin.from('orders').select('status, mp_payment_id').eq('id', ref).single()).data
    try {
      // aprobado -> paid + mp_payment_id
      const r1 = await hook({ id: 'PAY-APPROVED-1', status: 'approved', external_reference: ref })
      expect(r1.ok()).toBeTruthy()
      let o = await statusOf()
      expect(o.status).toBe('paid')
      expect(o.mp_payment_id).toBe('PAY-APPROVED-1')

      // idempotente: reintento del MISMO evento no rompe ni cambia
      const r2 = await hook({ id: 'PAY-APPROVED-1', status: 'approved', external_reference: ref })
      expect((await r2.json()).idempotent).toBe(true)
      expect((await statusOf()).status).toBe('paid')

      // pending/in_process: no cambia el estado
      const r3 = await hook({ id: 'PAY-X', status: 'in_process', external_reference: ref })
      expect((await r3.json()).noChange).toBe(true)
      expect((await statusOf()).status).toBe('paid')

      // rechazado -> cancelled
      const r4 = await hook({ id: 'PAY-REJECTED-1', status: 'rejected', external_reference: ref })
      expect(r4.ok()).toBeTruthy()
      expect((await statusOf()).status).toBe('cancelled')
    } finally {
      await admin.from('orders').delete().eq('id', ref)
    }
  })
})
