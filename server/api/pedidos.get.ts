// GET /api/pedidos?pin=XXXX — pedidos pagados, para surtir.
//
// Para que Nancy vea qué mandar y a dónde. Antes del 27-ago-2026 no había forma:
// los pedidos vivían solo en la base y nadie del equipo la abre.
//
// SEGURIDAD: esto expone nombre, teléfono y domicilio de clientes. Va detrás de
// un PIN compartido (NUXT_PEDIDOS_PIN), que es lo mínimo razonable para algo que
// usa una persona desde su teléfono. No es autenticación de verdad:
//   - Si el PIN se filtra, se cambia la variable en Vercel y listo.
//   - Cuando haya más gente surtiendo, esto debe pasar a cuentas con rol.
// Sin PIN configurado el endpoint queda APAGADO (404), no abierto: un descuido
// de configuración no puede terminar publicando domicilios.
import { defineEventHandler, getQuery, createError } from 'h3'
import { supabaseAdmin } from '../utils/supabaseAdmin'

export default defineEventHandler(async (event) => {
  const pin = (process.env.NUXT_PEDIDOS_PIN || '').trim()
  if (!pin) throw createError({ statusCode: 404, message: 'No disponible.' })

  const q = getQuery(event)
  if (String(q.pin || '') !== pin) {
    throw createError({ statusCode: 401, message: 'PIN incorrecto.' })
  }

  const admin = supabaseAdmin()

  // Solo pagados y reembolsados: lo pendiente no se surte, y mostrarlo invita a
  // mandar algo que nadie pagó.
  const { data: pedidos, error } = await admin
    .from('orders')
    .select('id, status, total, currency, shipping_address, gift, coupon_code, discount_amount, mp_payment_id, created_at, shipped_at')
    .in('status', ['paid', 'refunded'])
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw createError({ statusCode: 500, message: 'No se pudieron leer los pedidos.' })

  const ids = (pedidos || []).map((p: any) => p.id)
  const porPedido: Record<string, any[]> = {}
  if (ids.length) {
    const { data: items } = await admin
      .from('order_items')
      .select('order_id, product_name, product_slug, quantity, unit_price, line_total')
      .in('order_id', ids)
    for (const it of items || []) {
      ;(porPedido[it.order_id] ??= []).push(it)
    }
  }

  return {
    pedidos: (pedidos || []).map((p: any) => ({
      ...p,
      items: porPedido[p.id] || [],
      // Un pedido sin dirección NO se puede surtir. Se marca explícito para que
      // salte a la vista en vez de descubrirse al momento de empacar.
      sinDireccion: !p.shipping_address?.line1,
    })),
  }
})
