// POST /api/coupon-validate  ·  { code, subtotal } -> { valid, type, value, discount, message }
// Validación SERVER-SIDE con service_role: el cliente NO puede leer public.coupons (RLS sin
// políticas públicas). Esto es solo para la previsualización del carrito; el descuento REAL se
// vuelve a validar y recalcular al crear el pedido (server/utils/orders.ts). NO toca used_count.
import { defineEventHandler, readBody } from 'h3'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { normalizeCode, validateCoupon, type CouponRow } from '../utils/coupons'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ code?: string; subtotal?: number }>(event)
  const code = normalizeCode(body?.code)
  const subtotal = Math.max(0, Number(body?.subtotal) || 0)

  if (!code) return { valid: false, discount: 0, message: 'Ingresa un código de descuento.' }

  try {
    const admin = supabaseAdmin()
    const { data, error } = await admin
      .from('coupons')
      .select('code, type, value, min_subtotal, active, expires_at, max_uses, used_count')
      .eq('code', code)
      .maybeSingle()

    if (error) {
      console.error('[coupon-validate] consulta falló:', error.message)
      return { valid: false, discount: 0, message: 'No se pudo validar el cupón. Intenta más tarde.' }
    }
    return validateCoupon(data as CouponRow | null, subtotal)
  } catch (e: any) {
    console.error('[coupon-validate] error:', e?.message)
    return { valid: false, discount: 0, message: 'No se pudo validar el cupón. Intenta más tarde.' }
  }
})
