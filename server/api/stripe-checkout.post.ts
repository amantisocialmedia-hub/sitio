// POST /api/stripe-checkout
// 1) Crea un order 'pending' + order_items en Supabase (server-side, service_role).
// 2) Crea una Checkout Session de Stripe (página hospedada) con metadata.order_id = order.id.
// 3) Devuelve la URL de Stripe Checkout para redirigir al cliente.
// Requiere NUXT_STRIPE_SECRET_KEY y SUPABASE_SERVICE_ROLE_KEY (server).
// Espeja el patrón de /api/checkout (MercadoPago): precios AUTORITATIVOS del servidor, cupón
// re-validado server-side, y el webhook de Stripe es la autoridad sobre el estado final del pago.
import { defineEventHandler, readBody, createError } from 'h3'
import { createPendingOrder } from '../utils/orders'
import type { InCartItem } from '../utils/orderItems'
import { supabaseAdmin } from '../utils/supabaseAdmin'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = config.stripeSecretKey
  if (!secret) {
    throw createError({ statusCode: 400, statusMessage: 'Stripe key missing', message: 'Falta configurar la llave de Stripe (NUXT_STRIPE_SECRET_KEY).' })
  }

  const body = await readBody<{ items: InCartItem[]; gift?: { isGift?: boolean; recipient?: string; sender?: string; message?: string }; coupon?: string }>(event)
  const items = body?.items ?? []
  if (!items.length) throw createError({ statusCode: 400, message: 'El carrito está vacío.' })

  // 1) Order pending + items (service_role; user_id si hay sesión). El cupón se re-valida y el
  //    descuento se recalcula server-side; el total del order ya viene con descuento.
  const order = await createPendingOrder(event, items, 'stripe', body?.gift, body?.coupon)

  const base = config.public.publicBaseUrl

  // 2) Line items de Stripe (form-encoded). Igual que en MercadoPago: si hay cupón mandamos UNA
  //    línea con el total YA con descuento (Stripe no admite líneas negativas). El desglose real
  //    por producto vive en order_items (fuente de verdad) ligado por metadata.order_id.
  //    unit_amount va en la MENOR unidad de la moneda (centavos MXN) => *100 redondeado.
  const cents = (n: number) => Math.round(n * 100)
  const form = new URLSearchParams()
  form.set('mode', 'payment')
  form.set('locale', 'es')
  form.set('success_url', `${base}/carrito?status=success&order=${order.id}`)
  form.set('cancel_url', `${base}/carrito?status=failure`)
  form.set('client_reference_id', order.id)
  form.set('metadata[order_id]', order.id)
  // Propaga el order_id al PaymentIntent (necesario para resolver reembolsos en el webhook).
  form.set('payment_intent_data[metadata][order_id]', order.id)
  form.set('payment_intent_data[statement_descriptor_suffix]', 'AMANTI')

  if (order.discount > 0) {
    form.set('line_items[0][quantity]', '1')
    form.set('line_items[0][price_data][currency]', 'mxn')
    form.set('line_items[0][price_data][unit_amount]', String(cents(order.total)))
    form.set('line_items[0][price_data][product_data][name]', `Pedido AMANTI · cupón ${order.couponCode}`)
  } else {
    order.items.forEach((i, idx) => {
      form.set(`line_items[${idx}][quantity]`, String(i.quantity))
      form.set(`line_items[${idx}][price_data][currency]`, 'mxn')
      form.set(`line_items[${idx}][price_data][unit_amount]`, String(cents(i.unitPrice)))
      form.set(`line_items[${idx}][price_data][product_data][name]`, i.name)
    })
  }

  try {
    const session = await $fetch<{ id: string; url: string }>('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })

    // 3) Guarda el session id en el order (best-effort: si la columna aún no existe, se ignora
    //    y el pedido sigue funcionando — el webhook liga por metadata.order_id, no por esta columna).
    const { error: upErr } = await supabaseAdmin().from('orders').update({ stripe_session_id: session.id }).eq('id', order.id)
    if (upErr) console.warn('[stripe-checkout] no se pudo guardar stripe_session_id (¿falta la columna?):', upErr.message)

    return { url: session.url, sessionId: session.id, orderId: order.id }
  } catch (e: any) {
    // El order queda 'pending' (el webhook de Stripe es la autoridad sobre el estado final).
    throw createError({ statusCode: 502, message: e?.data?.error?.message || 'No se pudo crear el pago en Stripe.' })
  }
})
