import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// E2E de cupones. Requiere SB_URL/SB_ANON/SB_SVC por env (service_role, NO en el repo).
// Siembra cupones de prueba (prefijo QA*) con la service_role, ejercita el endpoint de
// validación y la creación de pedido con descuento, y limpia todo al final.
const { SB_URL, SB_ANON, SB_SVC } = process.env as Record<string, string>
const email = `amanti.qa.coupon.${Date.now()}@gmail.com`
const pass = 'AmantiQA1234!'
let admin: any = null
let uid: string | null = null

const future = new Date(Date.now() + 7 * 864e5).toISOString()
const past = new Date(Date.now() - 864e5).toISOString()

test.describe('cupones', () => {
  test.skip(!SB_URL || !SB_ANON || !SB_SVC, 'requiere SB_URL/SB_ANON/SB_SVC')

  test.beforeAll(async () => {
    admin = createClient(SB_URL, SB_SVC, { auth: { persistSession: false } })
    const { data } = await admin.auth.admin.createUser({
      email, password: pass, email_confirm: true, user_metadata: { full_name: 'QA Coupon' },
    })
    uid = data.user.id
    await admin.from('coupons').delete().like('code', 'QA%')
    await admin.from('coupons').insert([
      { code: 'QAPCT15', type: 'percent', value: 15, min_subtotal: 0, active: true, expires_at: future, max_uses: null, used_count: 0 },
      { code: 'QAFIX100', type: 'fixed', value: 100, min_subtotal: 0, active: true, expires_at: null, max_uses: null, used_count: 0 },
      { code: 'QAEXPIRED', type: 'percent', value: 20, min_subtotal: 0, active: true, expires_at: past, max_uses: null, used_count: 0 },
      { code: 'QAINACTIVE', type: 'percent', value: 20, min_subtotal: 0, active: false, expires_at: future, max_uses: null, used_count: 0 },
      { code: 'QAUSEDUP', type: 'percent', value: 20, min_subtotal: 0, active: true, expires_at: future, max_uses: 5, used_count: 5 },
      { code: 'QAMIN5000', type: 'percent', value: 10, min_subtotal: 5000, active: true, expires_at: future, max_uses: null, used_count: 0 },
      { code: 'QAINCR', type: 'fixed', value: 50, min_subtotal: 0, active: true, expires_at: future, max_uses: 10, used_count: 0 },
    ])
  })

  test.afterAll(async () => {
    if (admin) await admin.from('coupons').delete().like('code', 'QA%')
    if (admin && uid) await admin.auth.admin.deleteUser(uid)
  })

  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([
      { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
      { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
    ])
    // Evita que el modal de bienvenida (aparece a los 6s) intercepte clics.
    await page.addInitScript(() => { try { localStorage.setItem('amanti_welcome_seen', '1') } catch {} })
  })

  // ---- Endpoint de validación (no requiere sesión) ----
  test('válido percent: normaliza a MAYÚSCULAS y calcula el descuento', async ({ request }) => {
    const res = await request.post('/api/coupon-validate', { data: { code: 'qapct15', subtotal: 1000 } })
    const j = await res.json()
    expect(j.valid).toBe(true)
    expect(j.type).toBe('percent')
    expect(j.value).toBe(15)
    expect(j.discount).toBe(150) // 15% de 1000
  })

  test('válido fixed: descuento = min(value, subtotal)', async ({ request }) => {
    const j = await (await request.post('/api/coupon-validate', { data: { code: 'QAFIX100', subtotal: 1000 } })).json()
    expect(j.valid).toBe(true)
    expect(j.discount).toBe(100)
  })

  test('expirado, inactivo y agotado se rechazan', async ({ request }) => {
    for (const code of ['QAEXPIRED', 'QAINACTIVE', 'QAUSEDUP']) {
      const j = await (await request.post('/api/coupon-validate', { data: { code, subtotal: 1000 } })).json()
      expect(j.valid, code).toBe(false)
      expect(j.discount, code).toBe(0)
    }
  })

  test('bajo el mínimo se rechaza; alcanzando el mínimo se acepta', async ({ request }) => {
    const bajo = await (await request.post('/api/coupon-validate', { data: { code: 'QAMIN5000', subtotal: 1000 } })).json()
    expect(bajo.valid).toBe(false)
    const ok = await (await request.post('/api/coupon-validate', { data: { code: 'QAMIN5000', subtotal: 5000 } })).json()
    expect(ok.valid).toBe(true)
    expect(ok.discount).toBe(500) // 10% de 5000
  })

  test('código inexistente se rechaza', async ({ request }) => {
    const j = await (await request.post('/api/coupon-validate', { data: { code: 'NO-EXISTE-XYZ', subtotal: 1000 } })).json()
    expect(j.valid).toBe(false)
  })

  // ---- Pedido con cupón: total con descuento + used_count incrementa ----
  test('order con cupón: total con descuento, coupon_code/discount_amount guardados, used_count +1', async ({ page }) => {
    // login (asocia user_id; funciona aunque orders.user_id sea NOT NULL)
    await page.goto('/cuenta')
    await page.getByPlaceholder('Correo').fill(email)
    await page.getByPlaceholder('Contraseña').fill(pass)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible({ timeout: 15000 })

    const before = (await admin.from('coupons').select('used_count').eq('code', 'QAINCR').single()).data.used_count

    const res = await page.evaluate(async () => {
      const r = await fetch('/api/order-whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ items: [{ slug: 'denzel', name: 'Denzel', price: 400, quantity: 2 }], coupon: 'qaincr' }),
      })
      return { status: r.status, body: await r.json() }
    })
    expect(res.status).toBe(200)
    const orderId = res.body.orderId

    try {
      const { data: o } = await admin.from('orders').select('total, coupon_code, discount_amount').eq('id', orderId).single()
      // denzel $400 x2 = $800 subtotal; cupón fijo $50 → total $750
      expect(o.discount_amount).toBe(50)
      expect(o.coupon_code).toBe('QAINCR') // canónico de la BD, aunque se envió en minúsculas
      expect(o.total).toBe(750)

      const after = (await admin.from('coupons').select('used_count').eq('code', 'QAINCR').single()).data.used_count
      expect(after).toBe(before + 1) // un solo incremento por pedido
    } finally {
      await admin.from('orders').delete().eq('id', orderId)
    }
  })

  test('cupón inválido al crear pedido: se rechaza (no cobra de más)', async ({ request }) => {
    const res = await request.post('/api/order-whatsapp', {
      data: { items: [{ slug: 'denzel', name: 'Denzel', price: 400, quantity: 1 }], coupon: 'QAEXPIRED' },
    })
    expect(res.status()).toBe(400)
  })
})
