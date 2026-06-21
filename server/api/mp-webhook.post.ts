// POST /api/mp-webhook — Webhook de Mercado Pago (notificaciones de pago).
//
// SEGURIDAD: NO confiamos en el payload. (1) Validamos la firma HMAC (x-signature) si hay
// secreto configurado. (2) Tomamos solo el payment id y consultamos el pago real en la API de
// MP con NUXT_MP_ACCESS_TOKEN para leer su status y external_reference (= order.id).
// (3) Idempotente y con transiciones de estado SOLO hacia adelante (paid no se sobreescribe por
// un evento posterior 'rejected'). El UPDATE es atómico (.in('status', allowedPrev)) para cerrar
// la carrera entre dos entregas concurrentes de MP.
//
// REGISTRO (hazlo tú en el panel de MP): MercadoPago → Tus integraciones → tu app →
// Webhooks/Notificaciones → URL de producción: https://<tu-dominio>/api/mp-webhook
// y suscribe el evento "Pagos" (payment). Copia el "secreto" al env NUXT_MP_WEBHOOK_SECRET.
import { defineEventHandler, readBody, getQuery, getHeader, createError } from 'h3'
import { createHmac, timingSafeEqual } from 'node:crypto'
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

// Estados previos permitidos por estado destino (transiciones solo hacia adelante).
//  - paid admite 'cancelled' porque un reintento aprobado en la MISMA preferencia puede llegar
//    tras un primer intento rechazado (que ya marcó el order 'cancelled').
//  - cancelled NO admite 'paid': un 'rejected' tardío nunca debe revertir un pago confirmado.
//  - refunded solo desde 'paid'.
const ALLOWED_PREV: Record<string, string[]> = {
  paid: ['pending', 'cancelled'],
  cancelled: ['pending'],
  refunded: ['paid'],
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

  // Modo test: SOLO fuera de producción, con MP_WEBHOOK_TEST_MODE presente y un secreto
  // compartido que el caller debe conocer. Imposible de activar en un deploy de producción.
  const isTest =
    process.env.NODE_ENV !== 'production' &&
    !!process.env.MP_WEBHOOK_TEST_MODE &&
    !!body?.__test_secret &&
    body.__test_secret === process.env.MP_WEBHOOK_TEST_MODE &&
    !!body?.__test_payment

  // 1) Validación de firma HMAC de MercadoPago (si hay secreto). Defensa en profundidad
  // adicional a la re-consulta del pago. Se omite en el modo test explícito.
  const secret = config.mpWebhookSecret
  if (secret && !isTest) {
    const sig = getHeader(event, 'x-signature') || ''
    const reqId = getHeader(event, 'x-request-id') || ''
    const parts = Object.fromEntries(sig.split(',').map((p) => p.split('=').map((s) => s.trim())))
    const ts = parts.ts, v1 = parts.v1
    if (!ts || !v1) throw createError({ statusCode: 401, message: 'Firma inválida.' })
    // MP firma sobre el data.id del QUERY (no el del body). Desacoplado del id de consulta a la API.
    const sigId = String((query as any)['data.id'] || query.id || body?.data?.id || '')
    const manifest = `id:${sigId.toLowerCase()};${reqId ? `request-id:${reqId};` : ''}ts:${ts};`
    const expected = createHmac('sha256', secret).update(manifest).digest('hex')
    const a = Buffer.from(expected), b = Buffer.from(v1)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw createError({ statusCode: 401, message: 'Firma inválida.' })
    }
  }

  // 2) Verificar el pago consultando MP (fuente de verdad). En producción SIEMPRE se consulta MP.
  let payment: any
  if (isTest) {
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

  // 3) Localizar el order y actualizar (idempotente + forward-only + atómico).
  const admin = supabaseAdmin()
  const { data: order } = await admin.from('orders').select('id, status, mp_payment_id').eq('id', orderId).maybeSingle()
  if (!order) return { ignored: true, reason: 'order-not-found' }

  const mpPaymentId = String(payment.id)
  if (order.status === newStatus) return { ok: true, idempotent: true } // reintento de MP

  const allowedPrev = ALLOWED_PREV[newStatus] || []
  if (!allowedPrev.includes(order.status)) {
    // p.ej. un 'rejected' tardío sobre un order ya 'paid' -> no se aplica.
    return { ok: true, noChange: true, reason: 'transition-not-allowed', from: order.status, to: newStatus }
  }

  // Salvaguarda: nunca marcar 'paid' un pedido sin artículos (rollback huérfano, etc.).
  if (newStatus === 'paid') {
    const { count } = await admin.from('order_items').select('id', { count: 'exact', head: true }).eq('order_id', orderId)
    if (!count) {
      console.error('[mp-webhook] pago aprobado para order sin items, no se marca paid:', orderId)
      return { ignored: true, reason: 'order-has-no-items' }
    }
  }

  // UPDATE atómico: la cláusula .in('status', allowedPrev) garantiza que solo una de dos
  // entregas concurrentes aplique el cambio (cierra el TOCTOU).
  const { data: updated, error } = await admin
    .from('orders')
    .update({ status: newStatus, mp_payment_id: mpPaymentId })
    .eq('id', orderId)
    .in('status', allowedPrev)
    .select('id')
  if (error) throw createError({ statusCode: 500, message: 'No se pudo actualizar el pedido.' })
  if (!updated || updated.length === 0) return { ok: true, idempotent: true } // perdió la carrera

  return { ok: true, orderId, status: newStatus }
})
