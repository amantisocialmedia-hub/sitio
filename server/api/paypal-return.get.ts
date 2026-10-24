// GET /api/paypal-return?order=<id del pedido>&token=<id de la orden de PayPal>&PayerID=...
//
// A donde PayPal regresa al cliente cuando dio «Pagar ahora». Aquí se hace el
// cobro de verdad (la captura) y se marca el pedido; después se manda al
// cliente a /carrito con el resultado.
//
// Es un GET que cambia estado a propósito: es el único momento en que tenemos
// al cliente enfrente, y si esperáramos al webhook vería «pendiente» justo
// después de pagar. Es seguro porque la captura es idempotente (segunda vez:
// «ya estaba capturada») y solo cobra lo que ese cliente ya aprobó en PayPal.
// Abrir este enlace sin haber aprobado no cobra nada: PayPal contesta
// ORDER_NOT_APPROVED.
import { defineEventHandler, getQuery, sendRedirect } from 'h3'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { baseParaPasarela } from '../utils/baseUrl'
import { leerConfigPaypal, tokenPaypal, detalleErrorPaypal } from '../utils/paypal'
import { cobrarOrdenPaypal, type DestinoCliente } from '../utils/paypalPedido'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const q = getQuery(event)
  const orderId = String(q.order || '').trim()
  const paypalOrderId = String(q.token || '').trim()
  const base = baseParaPasarela(config.public.publicBaseUrl, config.public.siteUrl)

  const ir = (status: DestinoCliente) =>
    sendRedirect(event, `${base}/carrito?status=${status}${orderId ? `&order=${encodeURIComponent(orderId)}` : ''}`, 302)

  if (!orderId || !paypalOrderId) return ir('failure')

  try {
    const cfg = leerConfigPaypal(config)
    const { data: order } = await supabaseAdmin().from('orders').select('id, status').eq('id', orderId).maybeSingle()
    if (!order) return ir('failure')
    // Ya cobrado (el webhook llegó antes, o el cliente recargó la página).
    if (order.status === 'paid') return ir('success')

    const token = await tokenPaypal(cfg)
    const r = await cobrarOrdenPaypal(cfg, token, paypalOrderId, orderId, 'paypal-return')
    if (r.destino !== 'success') {
      console.warn('[paypal-return] captura no completada:', r.resumen.estado, 'pedido:', orderId, 'paypal:', paypalOrderId)
    }
    return ir(r.destino)
  } catch (e: any) {
    // No sabemos si el cobro quedó (red, PayPal caído a medio camino). El
    // webhook lo resuelve; al cliente se le dice que está pendiente, no que
    // falló, para que no vuelva a pagar.
    console.error('[paypal-return] error al capturar', { orderId, paypalOrderId, ...detalleErrorPaypal(e) })
    return ir('pending')
  }
})
