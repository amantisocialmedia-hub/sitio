import type { H3Event } from 'h3'
import { serverSupabaseUser } from '#supabase/server'
import {
  resolveItems,
  computeTotal,
  buildOrderRows,
  type InCartItem,
  type ResolvedItem,
} from './orderItems'

export type { InCartItem, ResolvedItem }

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

export interface CreatedOrder { id: string; total: number; userId: string | null; items: ResolvedItem[] }

/**
 * Crea un order 'pending' + sus order_items (snapshot) con la service_role.
 * Los precios se RESUELVEN server-side por slug (data/products.json); el price del cliente se ignora.
 * paymentMethod: 'mercadopago' | 'whatsapp'. user_id sólo si hay sesión.
 */
export async function createPendingOrder(
  event: H3Event,
  items: InCartItem[],
  paymentMethod: 'mercadopago' | 'whatsapp',
): Promise<CreatedOrder> {
  // Valida + resuelve precios autoritativos (lanza 400 si hay items inválidos o el carrito está vacío).
  const resolved = resolveItems(items)
  const total = computeTotal(resolved)

  const admin = supabaseAdmin()
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

  return { id: order.id as string, total: order.total as number, userId, items: resolved }
}
