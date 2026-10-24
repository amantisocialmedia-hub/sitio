// POST /api/paypal-checkout
// 1) Crea un order 'pending' + order_items en Supabase (server-side, service_role).
// 2) Crea la orden de PayPal (Checkout Orders v2, intent CAPTURE) con custom_id = order.id.
// 3) Guarda el paypal_order_id en el order y devuelve la URL de aprobación.
// Requiere NUXT_PAYPAL_CLIENT_ID + NUXT_PAYPAL_CLIENT_SECRET y SUPABASE_SERVICE_ROLE_KEY.
//
// Espeja /api/checkout (Mercado Pago): precios AUTORITATIVOS del servidor,
// cupón re-validado server-side, sin dirección no se cobra, sin correo no se
// cobra. El cobro real lo hace /api/paypal-return al volver el cliente (y el
// webhook como respaldo); esa captura es la autoridad sobre el estado final.
import { defineEventHandler, readBody, createError } from 'h3'
import { createPendingOrder } from '../utils/orders'
import type { InCartItem } from '../utils/orderItems'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { baseParaPasarela } from '../utils/baseUrl'
import { datosDelComprador } from '../utils/comprador'
import { leerConfigPaypal, tokenPaypal, crearOrdenPaypal, detalleErrorPaypal } from '../utils/paypal'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  // Antes de crear nada en la base: si falta la configuración, que truene aquí.
  const cfg = leerConfigPaypal(config)

  const body = await readBody<{
    items: InCartItem[]
    gift?: { isGift?: boolean; recipient?: string; sender?: string; message?: string }
    coupon?: string
    payer?: { email?: string; name?: string; surname?: string }
    envio?: any
  }>(event)
  const items = body?.items ?? []
  if (!items.length) throw createError({ statusCode: 400, message: 'El carrito está vacío.' })

  // 1) Order pending + items (service_role; user_id si hay sesión). El cupón se
  //    re-valida y el descuento se recalcula server-side; el total ya viene con
  //    descuento y envío.
  const order = await createPendingOrder(event, items, 'paypal', body?.gift, body?.coupon, body?.envio)

  // Sin direccion no se cobra. Cobrar y no poder enviar es peor que no vender
  // (pasó con los tres pagados del 27-ago-2026).
  if (!order.shippingAddress) {
    throw createError({
      statusCode: 400,
      message: 'Falta la dirección de envío. Complétala antes de continuar al pago.',
    })
  }

  // Sin correo no hay forma de avisarle al cliente que su compra salió.
  const comprador = await datosDelComprador(event, body)
  if (!comprador?.email) {
    throw createError({
      statusCode: 400,
      message: 'Falta tu correo. Lo necesitamos para enviarte el comprobante y poder cobrar.',
    })
  }

  const base = baseParaPasarela(config.public.publicBaseUrl, config.public.siteUrl)
  try {
    const token = await tokenPaypal(cfg)
    // 2) Orden de PayPal. El regreso trae ?token=<id de PayPal> y nosotros
    //    agregamos nuestro order para poder cotejar los dos.
    const pp = await crearOrdenPaypal(cfg, token, {
      order,
      comprador: { email: comprador.email, nombre: comprador.name, apellido: comprador.surname },
      returnUrl: `${base}/api/paypal-return?order=${order.id}`,
      cancelUrl: `${base}/carrito?status=failure&order=${order.id}`,
    })
    if (!pp.url) throw new Error('PayPal no devolvió el enlace de aprobación.')

    // 3) Guarda el id de PayPal en el order (best-effort: si la columna aún no
    //    existe, el pedido sigue funcionando; el cobro liga por custom_id).
    const { error: upErr } = await supabaseAdmin().from('orders').update({ paypal_order_id: pp.id }).eq('id', order.id)
    if (upErr) console.warn('[paypal-checkout] no se pudo guardar paypal_order_id (¿falta la columna?):', upErr.message)

    return { url: pp.url, paypalOrderId: pp.id, orderId: order.id }
  } catch (e: any) {
    // El order queda 'pending' (igual que con MP: la captura es la autoridad).
    const d = detalleErrorPaypal(e)
    console.error('[paypal-checkout] no se pudo crear la orden en PayPal:', d, 'order:', order.id)
    throw createError({ statusCode: 502, message: 'No se pudo iniciar el pago con PayPal. Intenta de nuevo en un momento o escríbenos por WhatsApp.' })
  }
})
