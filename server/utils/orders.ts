import type { H3Event } from 'h3'
import { serverSupabaseUser } from '#supabase/server'
import productsData from '../../data/products.json'

export interface InCartItem { slug?: string; name: string; price: number; quantity: number }

// Mapa slug -> primera imagen (para el snapshot image_url de order_items).
const imgBySlug: Record<string, string | null> = Object.fromEntries(
  ((productsData as any).products as any[]).map((p) => [p.slug, (p.images && p.images[0]) || null]),
)

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

export interface CreatedOrder { id: string; total: number; userId: string | null }

/**
 * Crea un order 'pending' + sus order_items (snapshot) con la service_role.
 * paymentMethod: 'mercadopago' | 'whatsapp'. user_id sólo si hay sesión.
 */
export async function createPendingOrder(
  event: H3Event,
  items: InCartItem[],
  paymentMethod: 'mercadopago' | 'whatsapp',
): Promise<CreatedOrder> {
  const clean = (items || []).filter((i) => i && i.name && Number(i.quantity) > 0 && Number(i.price) >= 0)
  if (!clean.length) throw createError({ statusCode: 400, message: 'El carrito está vacío.' })

  const admin = supabaseAdmin()
  const userId = await getUserId(event)
  const shipping = await defaultAddressSnapshot(userId)
  const total = clean.reduce((s, i) => s + i.price * i.quantity, 0)

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

  const rows = clean.map((i) => ({
    order_id: order.id,
    product_slug: i.slug || null,
    product_name: i.name,
    image_url: (i.slug && imgBySlug[i.slug]) || null,
    unit_price: i.price,
    quantity: i.quantity,
    line_total: i.price * i.quantity,
  }))
  const { error: iErr } = await admin.from('order_items').insert(rows)
  if (iErr) {
    await admin.from('orders').delete().eq('id', order.id) // rollback best-effort
    throw createError({ statusCode: 500, message: 'No se pudieron guardar los artículos del pedido.' })
  }

  return { id: order.id as string, total: order.total as number, userId }
}
