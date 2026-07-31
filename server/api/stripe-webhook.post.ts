// POST /api/stripe-webhook — Webhook de Stripe (eventos de pago).
//
// SEGURIDAD: verificamos la firma 'stripe-signature' (esquema t=<ts>,v1=<hmac>) con
// NUXT_STRIPE_WEBHOOK_SECRET sobre el cuerpo CRUDO (readRawBody) — igual criterio que el webhook
// de MercadoPago. Idempotente y con transiciones de estado SOLO hacia adelante (paid no se
// sobreescribe por un evento posterior). El UPDATE es atómico (.in('status', allowedPrev)) para
// cerrar la carrera entre dos entregas concurrentes de Stripe.
//
// REGISTRO (hazlo tú en el panel de Stripe): Developers → Webhooks → Add endpoint →
// URL de producción: https://<tu-dominio>/api/stripe-webhook. Suscribe los eventos:
//   checkout.session.completed, checkout.session.async_payment_succeeded,
//   checkout.session.async_payment_failed, checkout.session.expired, charge.refunded
// y copia el "Signing secret" (whsec_…) al env NUXT_STRIPE_WEBHOOK_SECRET.
// En local: `stripe listen --forward-to localhost:3000/api/stripe-webhook`.
import { defineEventHandler, readRawBody, getHeader, createError } from 'h3'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { supabaseAdmin } from '../utils/supabaseAdmin'

// Estados previos permitidos por estado destino (transiciones solo hacia adelante).
//  - paid admite 'cancelled' porque un reintento aprobado puede llegar tras un primer intento fallido.
//  - cancelled NO admite 'paid': un evento tardío nunca revierte un pago confirmado.
//  - refunded solo desde 'paid'.
const ALLOWED_PREV: Record<string, string[]> = {
  paid: ['pending', 'cancelled'],
  cancelled: ['pending'],
  refunded: ['paid'],
}

// Verifica la firma de Stripe. payload firmado = `${ts}.${rawBody}`; v1 = HMAC-SHA256 hex.
// Rechaza timestamps fuera de tolerancia (anti-replay, 5 min).
function verifyStripeSig(raw: string, header: string, secret: string, toleranceSec = 300): boolean {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=').map((s) => s.trim())))
  const ts = parts['t']
  const v1 = parts['v1']
  if (!ts || !v1) return false
  const expected = createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(v1)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  const now = Math.floor(Date.now() / 1000)
  if (!Number.isFinite(Number(ts)) || Math.abs(now - Number(ts)) > toleranceSec) return false
  return true
}

function mapEvent(type: string): string | null {
  switch (type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return 'paid'
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired':
      return 'cancelled'
    case 'charge.refunded':
      return 'refunded'
    default:
      return null // evento no manejado
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = config.stripeWebhookSecret
  const raw = String((await readRawBody(event)) || '')
  const sig = getHeader(event, 'stripe-signature') || ''

  // Firma OBLIGATORIA: sin secreto o sin firma válida no procesamos (evita webhooks falsos).
  if (!secret) throw createError({ statusCode: 400, message: 'Falta NUXT_STRIPE_WEBHOOK_SECRET.' })
  if (!verifyStripeSig(raw, sig, secret)) throw createError({ statusCode: 401, message: 'Firma inválida.' })

  let evt: any
  try { evt = JSON.parse(raw) } catch { throw createError({ statusCode: 400, message: 'JSON inválido.' }) }

  const newStatus = mapEvent(String(evt?.type || ''))
  if (!newStatus) return { ok: true, ignored: true, reason: 'event-not-handled', type: evt?.type }

  const obj = evt?.data?.object || {}

  // order_id viaja en metadata (session/payment_intent) o en client_reference_id (session).
  let orderId = String(obj?.metadata?.order_id || obj?.client_reference_id || '')
  if (!orderId && obj?.payment_intent) {
    // charge.refunded: el objeto es un charge y trae payment_intent como STRING → consultamos su
    // metadata en la API de Stripe para resolver el order_id.
    const piId = typeof obj.payment_intent === 'string' ? obj.payment_intent : (obj.payment_intent?.id || '')
    if (typeof obj.payment_intent === 'object') orderId = String(obj.payment_intent?.metadata?.order_id || '')
    if (!orderId && piId && config.stripeSecretKey) {
      try {
        const pi = await $fetch<any>(`https://api.stripe.com/v1/payment_intents/${piId}`, {
          headers: { Authorization: `Bearer ${config.stripeSecretKey}` },
        })
        orderId = String(pi?.metadata?.order_id || '')
      } catch { /* reembolso sin order resoluble: se ignora abajo */ }
    }
  }
  if (!orderId) return { ok: true, ignored: true, reason: 'no-order-id' }

  // En checkout.session.completed confirmamos que el pago esté realmente cobrado (no solo abierto).
  if (evt.type === 'checkout.session.completed' && obj?.payment_status && obj.payment_status !== 'paid') {
    return { ok: true, noChange: true, reason: 'session-unpaid' }
  }

  // Localizar el order y actualizar (idempotente + forward-only + atómico).
  const admin = supabaseAdmin()
  const { data: order } = await admin.from('orders').select('id, status').eq('id', orderId).maybeSingle()
  if (!order) return { ok: true, ignored: true, reason: 'order-not-found' }
  if (order.status === newStatus) return { ok: true, idempotent: true } // reintento de Stripe

  const allowedPrev = ALLOWED_PREV[newStatus] || []
  if (!allowedPrev.includes(order.status)) {
    return { ok: true, noChange: true, reason: 'transition-not-allowed', from: order.status, to: newStatus }
  }

  // Salvaguarda: nunca marcar 'paid' un pedido sin artículos (rollback huérfano, etc.).
  if (newStatus === 'paid') {
    const { count } = await admin.from('order_items').select('id', { count: 'exact', head: true }).eq('order_id', orderId)
    if (!count) {
      console.error('[stripe-webhook] pago aprobado para order sin items, no se marca paid:', orderId)
      return { ok: true, ignored: true, reason: 'order-has-no-items' }
    }
  }

  // UPDATE atómico: .in('status', allowedPrev) garantiza que solo una de dos entregas concurrentes
  // aplique el cambio (cierra el TOCTOU).
  const { data: updated, error } = await admin
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId)
    .in('status', allowedPrev)
    .select('id')
  if (error) throw createError({ statusCode: 500, message: 'No se pudo actualizar el pedido.' })
  if (!updated || updated.length === 0) return { ok: true, idempotent: true } // perdió la carrera

  // Guarda el payment_intent para reconciliación (best-effort: si la columna no existe, se ignora).
  const piId = typeof obj?.payment_intent === 'string' ? obj.payment_intent : (obj?.payment_intent?.id || null)
  if (piId) {
    const { error: piErr } = await admin.from('orders').update({ stripe_payment_intent_id: piId }).eq('id', orderId)
    if (piErr) console.warn('[stripe-webhook] no se pudo guardar stripe_payment_intent_id (¿falta la columna?):', piErr.message)
  }

  return { ok: true, orderId, status: newStatus }
})
