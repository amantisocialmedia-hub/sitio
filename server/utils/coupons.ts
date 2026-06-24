// Lógica PURA de cupones (sin Supabase ni auto-imports de Nuxt) -> testeable bajo vitest.
// La validación REAL siempre ocurre en el servidor: el cliente nunca decide el descuento.
import { round2 } from './orderItems'

export type CouponType = 'percent' | 'fixed'

// Fila tal como vive en public.coupons (Supabase).
export interface CouponRow {
  code: string
  type: CouponType
  value: number
  min_subtotal: number | null
  active: boolean
  expires_at: string | null
  max_uses: number | null
  used_count: number | null
}

export interface CouponResult {
  valid: boolean
  type?: CouponType
  value?: number
  discount: number
  message: string
}

/** Normaliza el código: string, sin espacios alrededor y en MAYÚSCULAS. */
export function normalizeCode(code: unknown): string {
  return (code == null ? '' : String(code)).trim().toUpperCase()
}

const money = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`

/**
 * Descuento bruto del cupón para un subtotal dado.
 *  - percent → subtotal * value / 100
 *  - fixed   → min(value, subtotal)
 * Acotado a [0, subtotal] y redondeado a 2 decimales.
 */
export function computeDiscount(type: CouponType, value: number, subtotal: number): number {
  const v = Number(value) || 0
  const s = Math.max(0, Number(subtotal) || 0)
  const raw = type === 'percent' ? (s * v) / 100 : Math.min(v, s)
  return round2(Math.max(0, Math.min(raw, s)))
}

/**
 * Valida un cupón YA LEÍDO de la BD contra un subtotal. `now` es inyectable (tests).
 * Devuelve { valid, type, value, discount, message }. NO toca used_count.
 */
export function validateCoupon(
  coupon: CouponRow | null | undefined,
  subtotal: number,
  now: Date = new Date(),
): CouponResult {
  const s = Math.max(0, Number(subtotal) || 0)
  if (!coupon) return { valid: false, discount: 0, message: 'Cupón inválido.' }
  if (!coupon.active) return { valid: false, discount: 0, message: 'Este cupón ya no está disponible.' }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now.getTime()) {
    return { valid: false, discount: 0, message: 'Este cupón ya expiró.' }
  }
  if (coupon.max_uses != null && (coupon.used_count ?? 0) >= coupon.max_uses) {
    return { valid: false, discount: 0, message: 'Este cupón llegó a su límite de usos.' }
  }
  const min = coupon.min_subtotal ?? 0
  if (s < min) {
    return { valid: false, discount: 0, message: `Tu compra no alcanza el mínimo de ${money(min)} para este cupón.` }
  }
  const discount = computeDiscount(coupon.type, coupon.value, s)
  if (discount <= 0) return { valid: false, discount: 0, message: 'Este cupón no aplica a tu compra.' }
  return { valid: true, type: coupon.type, value: coupon.value, discount, message: '¡Cupón aplicado! 🎉' }
}
