// POST /api/paypal-webhook — Webhook de PayPal (eventos de pago).
//
// SEGURIDAD: NO confiamos en el payload. (1) Se pide a PayPal que valide la
// firma (verify-webhook-signature) cuando hay NUXT_PAYPAL_WEBHOOK_ID. (2) Del
// cuerpo solo se toma el id del recurso y se vuelve a consultar la captura en
// la API de PayPal, que es la fuente de verdad del estado y del custom_id
// (= order.id). (3) El cambio de estado pasa por aplicarEstadoPedido:
// idempotente, solo hacia adelante y atómico.
//
// El regreso del cliente (/api/paypal-return) ya cobra y marca el pedido. Este
// webhook es el respaldo para cuando el cliente cerró la pestaña después de
// aprobar, y la única vía para reembolsos y rechazos tardíos.
//
// REGISTRO (en el panel de PayPal): developer.paypal.com → Apps & Credentials →
// la app Live → Webhooks → Add webhook → URL https://amanti.mx/api/paypal-webhook
// con los eventos: Checkout order approved, Payment capture completed, denied,
// pending, refunded y reversed. Copia el Webhook ID a NUXT_PAYPAL_WEBHOOK_ID.
import { defineEventHandler, readRawBody, getHeader, createError } from 'h3'
import { aplicarEstadoPedido } from '../utils/pagoConfirmado'
import { cobrarOrdenPaypal } from '../utils/paypalPedido'
import {
  leerConfigPaypal,
  tokenPaypal,
  verificarFirmaWebhook,
  accionDeEvento,
  capturaDeReembolso,
  obtenerCapturaPaypal,
  estadoPedidoDesdeCaptura,
} from '../utils/paypal'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const raw = String((await readRawBody(event)) || '')
  let evt: any
  try { evt = JSON.parse(raw) } catch { throw createError({ statusCode: 400, message: 'JSON inválido.' }) }

  const tipo = String(evt?.event_type || '')
  const accion = accionDeEvento(tipo)
  if (!accion) return { ok: true, ignored: true, reason: 'event-not-handled', type: tipo }

  const cfg = leerConfigPaypal(config)
  const token = await tokenPaypal(cfg)

  // 1) Firma. Sin webhook id configurado no se puede validar: se avisa en el
  //    log y se sigue, porque de todos modos no se usa nada del cuerpo más que
  //    un id que luego se re-consulta en PayPal.
  if (cfg.webhookId) {
    const cab = {
      'paypal-transmission-id': getHeader(event, 'paypal-transmission-id') || '',
      'paypal-transmission-time': getHeader(event, 'paypal-transmission-time') || '',
      'paypal-transmission-sig': getHeader(event, 'paypal-transmission-sig') || '',
      'paypal-cert-url': getHeader(event, 'paypal-cert-url') || '',
      'paypal-auth-algo': getHeader(event, 'paypal-auth-algo') || '',
    }
    const valida = await verificarFirmaWebhook(cfg, token, cab, evt)
    if (!valida) throw createError({ statusCode: 401, message: 'Firma inválida.' })
  } else {
    console.warn('[paypal-webhook] sin NUXT_PAYPAL_WEBHOOK_ID: no se valida la firma (el estado se re-consulta en PayPal de todos modos)')
  }

  const recurso = evt?.resource || {}

  // 2a) El cliente aprobó y nadie ha cobrado todavía (cerró la pestaña antes
  //     de regresar). Capturar es idempotente: si el regreso ya cobró, PayPal
  //     dice «ya estaba capturada» y el pedido queda igual.
  if (accion === 'capturar') {
    const paypalOrderId = String(recurso?.id || '')
    if (!paypalOrderId) return { ok: true, ignored: true, reason: 'no-paypal-order-id' }
    const r = await cobrarOrdenPaypal(cfg, token, paypalOrderId, null, 'paypal-webhook')
    return { ok: true, type: tipo, estado: r.resumen.estado, ...(r.resultado || {}) }
  }

  // 2b) Captura completada/rechazada/reembolsada: la verdad está en la API.
  const captureId = accion === 'reembolso' ? capturaDeReembolso(recurso) : String(recurso?.id || '')
  if (!captureId) return { ok: true, ignored: true, reason: 'no-capture-id' }

  let cap
  try {
    cap = await obtenerCapturaPaypal(cfg, token, captureId)
  } catch (e: any) {
    const code = e?.response?.status || e?.statusCode
    if (code === 404) return { ok: true, ignored: true, reason: 'capture-not-found' }
    throw createError({ statusCode: 502, message: 'No se pudo verificar el pago en PayPal.' })
  }
  if (!cap.orderId) return { ok: true, ignored: true, reason: 'no-custom-id' }

  const nuevo = estadoPedidoDesdeCaptura(cap.estado)
  if (!nuevo) return { ok: true, noChange: true, estado: cap.estado } // pending / reembolso parcial

  // 3) Aplicar (idempotente + forward-only + atómico). Avisa a GHL si quedó pagado.
  const resultado = await aplicarEstadoPedido({
    orderId: cap.orderId,
    nuevo,
    columnasOpcionales: {
      paypal_capture_id: cap.captureId,
      ...(cap.paypalOrderId ? { paypal_order_id: cap.paypalOrderId } : {}),
    },
    etiqueta: 'paypal-webhook',
  })
  return { ...resultado, type: tipo }
})
