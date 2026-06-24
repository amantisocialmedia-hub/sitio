// POST /api/checkout
// 1) Crea un order 'pending' + order_items en Supabase (server-side, service_role).
// 2) Crea la preferencia de Mercado Pago con external_reference = order.id.
// 3) Guarda el mp_preference_id en el order y devuelve el init_point.
// Requiere NUXT_MP_ACCESS_TOKEN (token MP) y SUPABASE_SERVICE_ROLE_KEY (server).
import { defineEventHandler, readBody, createError } from 'h3'
import { createPendingOrder } from '../utils/orders'
import type { InCartItem } from '../utils/orderItems'
import { supabaseAdmin } from '../utils/supabaseAdmin'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = config.mpAccessToken
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'MP token missing', message: 'Falta configurar el token de MercadoPago (NUXT_MP_ACCESS_TOKEN).' })
  }

  const body = await readBody<{ items: InCartItem[]; gift?: { isGift?: boolean; recipient?: string; sender?: string; message?: string }; coupon?: string }>(event)
  const items = body?.items ?? []
  if (!items.length) throw createError({ statusCode: 400, message: 'El carrito está vacío.' })

  // 1) Order pending + items (con la service_role; user_id si hay sesión). El cupón se
  //    re-valida y el descuento se recalcula server-side; el total del order ya viene con descuento.
  const order = await createPendingOrder(event, items, 'mercadopago', body?.gift, body?.coupon)

  const base = config.public.publicBaseUrl
  try {
    // 2) Preferencia MP con external_reference = order.id y notification_url al webhook
    const pref = await $fetch<{ init_point: string; sandbox_init_point: string; id: string }>(
      'https://api.mercadopago.com/checkout/preferences',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: {
          // Precios AUTORITATIVOS resueltos en el servidor (no el price del cliente).
          // El total de la preferencia (suma de líneas) DEBE reflejar el descuento. MP rechaza
          // unit_price <= 0, así que en vez de una línea negativa "recalculamos": cuando hay
          // cupón, mandamos UNA línea con el total YA con descuento (suma exacta, sin rechazos).
          // El detalle por producto vive en order_items (fuente de verdad) ligado por external_reference.
          items: order.discount > 0
            ? [{ title: `Pedido AMANTI · cupón ${order.couponCode}`, quantity: 1, unit_price: order.total, currency_id: 'MXN' }]
            : order.items.map((i) => ({ title: i.name, quantity: i.quantity, unit_price: i.unitPrice, currency_id: 'MXN' })),
          external_reference: order.id,
          notification_url: `${base}/api/mp-webhook`,
          back_urls: {
            success: `${base}/carrito?status=success&order=${order.id}`,
            failure: `${base}/carrito?status=failure`,
            pending: `${base}/carrito?status=pending`,
          },
          auto_return: 'approved',
          statement_descriptor: 'AMANTI',
        },
      },
    )

    // 3) Guarda el preference id en el order
    await supabaseAdmin().from('orders').update({ mp_preference_id: pref.id }).eq('id', order.id)

    return { init_point: pref.init_point || pref.sandbox_init_point, preferenceId: pref.id, orderId: order.id }
  } catch (e: any) {
    // El order queda 'pending' (el webhook de MP es la autoridad sobre el estado final).
    throw createError({ statusCode: 502, message: e?.data?.message || 'No se pudo crear el pago en MercadoPago.' })
  }
})
