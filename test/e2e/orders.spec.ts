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

  test('FASE B · webhook MP: aprobado -> paid (idempotente, forward-only) y pending -> cancelled', async ({ request }) => {
    // dos orders pending de prueba (con user_id para no depender del ALTER)
    const { data: o1 } = await admin.from('orders')
      .insert({ user_id: uid, status: 'pending', total: 500, currency: 'MXN', payment_method: 'mercadopago' })
      .select('id').single()
    const { data: o2 } = await admin.from('orders')
      .insert({ user_id: uid, status: 'pending', total: 700, currency: 'MXN', payment_method: 'mercadopago' })
      .select('id').single()
    // Items: el webhook NO marca 'paid' un order sin artículos (salvaguarda anti-huérfano).
    await admin.from('order_items').insert([
      { order_id: o1.id, product_name: 'X', unit_price: 500, quantity: 1, line_total: 500 },
      { order_id: o2.id, product_name: 'Y', unit_price: 700, quantity: 1, line_total: 700 },
    ])
    // __test_secret debe coincidir con MP_WEBHOOK_TEST_MODE del webServer ('1'); el gate exige NODE_ENV!=production.
    const hook = (ref: string, pay: any) => request.post('/api/mp-webhook', {
      data: { type: 'payment', data: { id: pay.id }, __test_payment: { ...pay, external_reference: ref }, __test_secret: '1' },
    })
    const statusOf = async (ref: string) => (await admin.from('orders').select('status, mp_payment_id').eq('id', ref).single()).data
    try {
      // aprobado -> paid + mp_payment_id
      const r1 = await hook(o1.id, { id: 'PAY-APPROVED-1', status: 'approved' })
      expect(r1.ok()).toBeTruthy()
      let o = await statusOf(o1.id)
      expect(o.status).toBe('paid')
      expect(o.mp_payment_id).toBe('PAY-APPROVED-1')

      // idempotente: reintento del MISMO estado no rompe ni cambia
      const r2 = await hook(o1.id, { id: 'PAY-APPROVED-1', status: 'approved' })
      expect((await r2.json()).idempotent).toBe(true)
      expect((await statusOf(o1.id)).status).toBe('paid')

      // pending/in_process: no cambia el estado
      const r3 = await hook(o1.id, { id: 'PAY-X', status: 'in_process' })
      expect((await r3.json()).noChange).toBe(true)
      expect((await statusOf(o1.id)).status).toBe('paid')

      // forward-only: un 'rejected' tardío NO revierte un pago confirmado (sigue 'paid')
      const r4 = await hook(o1.id, { id: 'PAY-REJECTED-LATE', status: 'rejected' })
      const j4 = await r4.json()
      expect(j4.reason).toBe('transition-not-allowed')
      expect((await statusOf(o1.id)).status).toBe('paid')

      // un order pending SÍ puede pasar a cancelled (rechazo en su único intento)
      const r5 = await hook(o2.id, { id: 'PAY-REJECTED-2', status: 'rejected' })
      expect(r5.ok()).toBeTruthy()
      expect((await statusOf(o2.id)).status).toBe('cancelled')
    } finally {
      await admin.from('orders').delete().eq('id', o1.id)
      await admin.from('orders').delete().eq('id', o2.id)
    }
  })

  test('FASE C · pedido WhatsApp de invitado inserta order pending + items', async ({ request }) => {
    test.skip(!guestOk, 'orders.user_id es NOT NULL — corre el ALTER')
    const res = await request.post('/api/order-whatsapp', { data: { items: [{ slug: 'denzel', name: 'Denzel', price: 400, quantity: 1 }] } })
    expect(res.ok()).toBeTruthy()
    const { orderId } = await res.json()
    try {
      const { data: o } = await admin.from('orders').select('status, payment_method, user_id').eq('id', orderId).single()
      expect(o.status).toBe('pending')
      expect(o.payment_method).toBe('whatsapp')
      expect(o.user_id).toBeNull()
      const { data: items } = await admin.from('order_items').select('*').eq('order_id', orderId)
      expect(items.length).toBe(1)
      expect(items[0].product_name).toBe('Denzel')
    } finally {
      await admin.from('orders').delete().eq('id', orderId)
    }
  })

  test('FASE C/D · pedido WhatsApp con sesión se registra y aparece en Mis pedidos', async ({ page }) => {
    await login(page)
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/order-whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ items: [{ slug: 'denzel', name: 'Denzel', price: 400, quantity: 3 }] }),
      })
      return { status: r.status, body: await r.json() }
    })
    expect(res.status).toBe(200)
    const orderId = res.body.orderId
    try {
      // en DB: pending, whatsapp, user_id del usuario
      const { data: o } = await admin.from('orders').select('status, payment_method, user_id').eq('id', orderId).single()
      expect(o).toMatchObject({ status: 'pending', payment_method: 'whatsapp', user_id: uid })
      // aparece en "Mis pedidos"
      await page.getByRole('button', { name: 'Pedidos' }).click()
      const folio = '#' + String(orderId).slice(0, 8).toUpperCase()
      await expect(page.getByText(folio)).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('$ 1,200')).toBeVisible() // 400 x 3
    } finally {
      await admin.from('orders').delete().eq('id', orderId)
    }
  })
})
