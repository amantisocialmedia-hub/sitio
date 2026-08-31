// POST /api/pedido-enviado — marca un pedido como ya enviado.
//
// Mismo PIN que GET /api/pedidos. Escribe la fecha de envío y la guía, y avisa
// a GHL para que le llegue al cliente el «ya va en camino». No toca el estado
// del pago, que es autoridad del webhook de Mercado Pago.
import { defineEventHandler, readBody, createError } from 'h3'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { emitirEventoGhlSinEsperar, payloadEnvio } from '../utils/ghl'

export default defineEventHandler(async (event) => {
  const pin = (process.env.NUXT_PEDIDOS_PIN || '').trim()
  if (!pin) throw createError({ statusCode: 404, message: 'No disponible.' })

  const body = await readBody<{ pin?: string; orderId?: string; guia?: string; deshacer?: boolean }>(event)
  if (String(body?.pin || '') !== pin) throw createError({ statusCode: 401, message: 'PIN incorrecto.' })
  if (!body?.orderId) throw createError({ statusCode: 400, message: 'Falta el pedido.' })

  const admin = supabaseAdmin()
  const guia = (body.guia || '').trim().slice(0, 120) || null
  // Deshacer existe porque marcar de más pasa, y sin esto habría que entrar a
  // la base a corregirlo.
  const { data: fila, error } = await admin.from('orders').update(
    body.deshacer
      ? { shipped_at: null, tracking: null }
      : { shipped_at: new Date().toISOString(), tracking: guia },
  ).eq('id', body.orderId).select('id, total, shipping_address').maybeSingle()

  if (error) throw createError({ statusCode: 500, message: 'No se pudo actualizar el pedido.' })

  // Avisarle al CLIENTE que su pedido salió. Solo al marcar, nunca al deshacer:
  // un «ya va en camino» seguido de nada es peor que no avisar.
  //
  // Va envuelto y sin esperar respuesta, igual que los demás avisos a GHL: si
  // GHL está caído o la URL no está puesta, Nancy tiene que poder seguir
  // marcando pedidos. Un aviso que no sale se reenvía; un pedido que no se
  // puede marcar como enviado detiene el trabajo de quien surte.
  if (!body.deshacer && fila) {
    try {
      const dir = ((fila as any).shipping_address || {}) as Record<string, string>
      const { data: lineas } = await admin
        .from('order_items')
        .select('product_name, quantity')
        .eq('order_id', body.orderId)
      emitirEventoGhlSinEsperar('pedido_enviado', payloadEnvio({
        orderId: String(body.orderId),
        email: dir.email || null,
        nombre: dir.recipient || null,
        telefono: dir.phone || null,
        guia,
        total: Number((fila as any).total) || 0,
        items: (lineas || []).map((l: any) => ({
          name: String(l.product_name || ''),
          quantity: Number(l.quantity) || 1,
        })),
      }))
    } catch (e: any) {
      console.warn('[pedido-enviado] no se pudo avisar del envío:', e?.message || e)
    }
  }

  return { ok: true }
})
