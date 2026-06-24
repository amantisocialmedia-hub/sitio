import type { H3Event } from 'h3'
import { serverSupabaseUser } from '#supabase/server'
import {
  resolveItems,
  computeTotal,
  buildOrderRows,
  round2,
  type InCartItem,
  type ResolvedItem,
} from './orderItems'
import { normalizeCode, validateCoupon, type CouponRow } from './coupons'

// user_id sólo si la petición viene autenticada (lee la sesión server-side). Nunca lanza.
async function getUserId(event: H3Event): Promise<string | null> {
  // serverSupabaseUser puede devolver el User (id) o los claims del JWT (sub). Aceptamos ambos.
  try { const u = await serverSupabaseUser(event) as any; return u?.id ?? u?.sub ?? null } catch { return null }
}

// Snapshot jsonb de la dirección predeterminada del usuario (si hay sesión y dirección).
async function defaultAddressSnapshot(userId: string | null): Promise<any | null> {
  if (!userId) return null
  const admin = supabaseAdmin()
  const { data } = await admin.from('addresses')
    .select('label, recipient, phone, line1, line2, city, state, postal_code, country')
    .eq('user_id', userId).eq('is_default', true).limit(1).maybeSingle()
  return data || null
}

export interface CreatedOrder {
  id: string
  total: number
  userId: string | null
  items: ResolvedItem[]
  discount: number
  couponCode: string | null
}

/**
 * Incrementa used_count del cupón en 1 (best-effort, una vez por pedido). Usa compare-and-set
 * sobre used_count para no perder incrementos bajo carrera; reintenta unas veces. Nunca lanza:
 * el pedido ya está creado y no debe fallar por el contador de usos.
 */
async function incrementCouponUsage(admin: ReturnType<typeof supabaseAdmin>, code: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await admin.from('coupons').select('used_count').eq('code', code).maybeSingle()
    if (error || !data) {
      console.warn('[orders] no se pudo leer used_count del cupón', code, error?.message)
      return
    }
    const current = (data.used_count ?? 0) as number
    let q = admin.from('coupons').update({ used_count: current + 1 }).eq('code', code)
    // CAS: solo actualiza si nadie cambió used_count entre la lectura y la escritura.
    q = data.used_count == null ? q.is('used_count', null) : q.eq('used_count', current)
    const { data: upd, error: uErr } = await q.select('code')
    if (uErr) {
      console.warn('[orders] no se pudo incrementar used_count del cupón', code, uErr.message)
      return
    }
    if (upd && upd.length) return // éxito
    // 0 filas: hubo carrera, reintenta con una lectura fresca.
  }
  console.warn('[orders] used_count no incrementado tras reintentos (carrera) para', code)
}

/**
 * Crea un order 'pending' + sus order_items (snapshot) con la service_role.
 * Los precios se RESUELVEN server-side por slug (data/products.json); el price del cliente se ignora.
 * paymentMethod: 'mercadopago' | 'whatsapp'. user_id sólo si hay sesión.
 */
export interface GiftInfo { isGift?: boolean; recipient?: string; sender?: string; message?: string }

export async function createPendingOrder(
  event: H3Event,
  items: InCartItem[],
  paymentMethod: 'mercadopago' | 'whatsapp',
  gift?: GiftInfo | null,
  couponCodeRaw?: string | null,
): Promise<CreatedOrder> {
  // Valida + resuelve precios autoritativos (lanza 400 si hay items inválidos o el carrito está vacío).
  const resolved = resolveItems(items)
  const subtotal = computeTotal(resolved)

  const admin = supabaseAdmin()

  // Cupón: se RE-VALIDA y RE-CALCULA server-side contra el subtotal REAL. Nunca confiamos en el
  // descuento que mande el cliente. Si el código viene pero es inválido, rechazamos con mensaje.
  let couponCode: string | null = null
  let discount = 0
  const codeNorm = normalizeCode(couponCodeRaw)
  if (codeNorm) {
    const { data: coupon, error: cErr } = await admin
      .from('coupons')
      .select('code, type, value, min_subtotal, active, expires_at, max_uses, used_count')
      .eq('code', codeNorm)
      .maybeSingle()
    if (cErr) console.error('[orders] consulta de cupón falló:', cErr.message)
    const res = validateCoupon((coupon as CouponRow | null) ?? null, subtotal)
    if (!res.valid) {
      throw createError({ statusCode: 400, message: res.message || 'El cupón no es válido.' })
    }
    couponCode = (coupon as CouponRow).code // usa el code canónico de la BD
    discount = res.discount
  }

  const total = round2(subtotal - discount)
  if (total <= 0) {
    throw createError({ statusCode: 400, message: 'El descuento deja el total en $0 o menos. Ajusta tu carrito o usa otro cupón.' })
  }

  const userId = await getUserId(event)
  const shipping = await defaultAddressSnapshot(userId)

  const { data: order, error: oErr } = await admin
    .from('orders')
    .insert({
      user_id: userId,
      status: 'pending',
      total,
      currency: 'MXN',
      payment_method: paymentMethod,
      shipping_address: shipping,
      coupon_code: couponCode,
      discount_amount: discount,
    })
    .select('id, total')
    .single()
  if (oErr || !order) {
    console.error('[orders] insert order falló:', oErr?.message)
    throw createError({ statusCode: 500, message: 'No se pudo crear el pedido.' })
  }

  const rows = buildOrderRows(order.id as string, resolved)
  const { error: iErr } = await admin.from('order_items').insert(rows)
  if (iErr) {
    console.error('[orders] insert order_items falló:', iErr.message, 'order:', order.id)
    const { error: delErr } = await admin.from('orders').delete().eq('id', order.id) // rollback best-effort
    if (delErr) console.error('[orders] ROLLBACK FALLÓ, order huérfano sin items:', order.id, delErr.message)
    throw createError({ statusCode: 500, message: 'No se pudieron guardar los artículos del pedido.' })
  }

  // Cupón usado: incrementa used_count UNA vez por pedido (best-effort, ya con items guardados).
  if (couponCode) await incrementCouponUsage(admin, couponCode)

  // Modo regalo (best-effort): si la columna `gift` aún no existe, el update falla y se
  // ignora — el pedido sigue creado correctamente. Saneamos longitudes para no abusar.
  if (gift?.isGift) {
    const clip = (s?: string, n = 280) => (s || '').toString().slice(0, n)
    const payload = {
      isGift: true,
      recipient: clip(gift.recipient, 80),
      sender: clip(gift.sender, 80),
      message: clip(gift.message, 280),
    }
    const { error: gErr } = await admin.from('orders').update({ gift: payload }).eq('id', order.id)
    if (gErr) console.warn('[orders] no se pudo guardar gift (¿falta la columna?):', gErr.message)
  }

  return { id: order.id as string, total: order.total as number, userId, items: resolved, discount, couponCode }
}
