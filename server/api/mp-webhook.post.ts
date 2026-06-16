// POST /api/mp-webhook — Webhook de Mercado Pago (notificaciones de pago).
//
// SEGURIDAD: NO confiamos en el payload. Tomamos solo el payment id y consultamos
// el pago real en la API de MP con NUXT_MP_ACCESS_TOKEN para leer su status y
// external_reference (= order.id). Idempotente ante reintentos de MP.
//
// REGISTRO (hazlo tú en el panel de MP): MercadoPago → Tus integraciones → tu app →
// Webhooks/Notificaciones → URL de producción: https://<tu-dominio>/api/mp-webhook
// y suscribe el evento "Pagos" (payment). (En la preferencia ya mandamos notification_url.)
import { defineEventHandler, readBody, getQuery, createError } from 'h3'
import { supabaseAdmin } from '../utils/supabaseAdmin'

function mapStatus(mp: string): string | null {
  switch (mp) {
    case 'approved': return 'paid'
    case 'rejected':
    case 'cancelled': return 'cancelled'
    case 'refunded':
    case 'charged_back': return 'refunded'
    default: return null // pending / in_process / authorized -> sin cambio
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = config.mpAccessToken
  const query = getQuery(event)
  const body: any = await readBody(event).catch(() => ({}))

  // Solo procesamos notificaciones de tipo pago.
  const type = String(body?.type || query.type || query.topic || '')
  const paymentId = String(body?.data?.id || (query as any)['data.id'] || query.id || '')
  if (type && type !== 'payment') return { ignored: true, reason: 'no-payment' }
  if (!paymentId) return { ignored: true, reason: 'no-payment-id' }

  // 1) Verificar el pago consultando MP (fuente de verdad).
  // Modo test (SOLO con MP_WEBHOOK_TEST_MODE, ausente en prod): permite simular el pago
  // sin llamar a MP. En producción SIEMPRE se consulta la API de MP.
  let payment: any
  if (process.env.MP_WEBHOOK_TEST_MODE && body?.__test_payment) {
    payment = body.__test_payment
  } else {
    if (!token) throw createError({ statusCode: 400, message: 'Falta NUXT_MP_ACCESS_TOKEN.' })
    try {
      payment = await $fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (e: any) {
      const code = e?.response?.status || e?.statusCode
      if (code === 404) return { ignored: true, reason: 'payment-not-found' }
      throw createError({ statusCode: 502, message: 'No se pudo verificar el pago en MercadoPago.' })
    }
  }

  const orderId = String(payment?.external_reference || '')
  const newStatus = mapStatus(String(payment?.status || ''))
  if (!orderId) return { ignored: true, reason: 'no-external-reference' }
  if (!newStatus) return { ok: true, noChange: true } // pending/in_process: aún no actualizamos

  // 2) Localizar el order y actualizar (idempotente).
  const admin = supabaseAdmin()
  const { data: order } = await admin.from('orders').select('id, status, mp_payment_id').eq('id', orderId).maybeSingle()
  if (!order) return { ignored: true, reason: 'order-not-found' }

  const mpPaymentId = String(payment.id)
  if (order.status === newStatus && order.mp_payment_id === mpPaymentId) {
    return { ok: true, idempotent: true } // reintento de MP: nada que hacer
  }

  const { error } = await admin.from('orders').update({ status: newStatus, mp_payment_id: mpPaymentId }).eq('id', orderId)
  if (error) throw createError({ statusCode: 500, message: 'No se pudo actualizar el pedido.' })
  return { ok: true, orderId, status: newStatus }
})
