// POST /api/pedido-enviado — marca un pedido como ya enviado.
//
// Mismo PIN que GET /api/pedidos. Solo escribe la fecha de envío y la guía; no
// toca el estado del pago, que es autoridad del webhook de Mercado Pago.
import { defineEventHandler, readBody, createError } from 'h3'
import { supabaseAdmin } from '../utils/supabaseAdmin'

export default defineEventHandler(async (event) => {
  const pin = (process.env.NUXT_PEDIDOS_PIN || '').trim()
  if (!pin) throw createError({ statusCode: 404, message: 'No disponible.' })

  const body = await readBody<{ pin?: string; orderId?: string; guia?: string; deshacer?: boolean }>(event)
  if (String(body?.pin || '') !== pin) throw createError({ statusCode: 401, message: 'PIN incorrecto.' })
  if (!body?.orderId) throw createError({ statusCode: 400, message: 'Falta el pedido.' })

  const admin = supabaseAdmin()
  // Deshacer existe porque marcar de más pasa, y sin esto habría que entrar a
  // la base a corregirlo.
  const { error } = await admin.from('orders').update(
    body.deshacer
      ? { shipped_at: null, tracking: null }
      : { shipped_at: new Date().toISOString(), tracking: (body.guia || '').trim().slice(0, 120) || null },
  ).eq('id', body.orderId)

  if (error) throw createError({ statusCode: 500, message: 'No se pudo actualizar el pedido.' })
  return { ok: true }
})
