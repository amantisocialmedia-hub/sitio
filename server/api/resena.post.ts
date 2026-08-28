// POST /api/resena — reseña de alguien que compró sin tener cuenta.
//
// Quien tiene sesión sigue reseñando por el camino de siempre (Supabase directo,
// con RLS). Esto es SOLO para el invitado que llega desde el correo del día 10.
//
// Tres candados, en este orden:
//   1. La firma del enlace es válida (se hizo con la llave del servidor).
//   2. El pedido está PAGADO.
//   3. Ese pedido de verdad incluye ese producto.
//
// Sin los tres, cualquiera podría dejar reseñas de productos que nunca compró.
// De hecho queda MEJOR que el camino con cuenta, donde hoy cualquier usuario
// registrado puede reseñar cualquier cosa sin haberla comprado.
import { defineEventHandler, readBody, createError } from 'h3'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { verificarResena, resenasInvitadoActivas } from '../utils/resenaToken'

export default defineEventHandler(async (event) => {
  if (!resenasInvitadoActivas()) throw createError({ statusCode: 404, message: 'No disponible.' })

  const body = await readBody<{
    pedido?: string; firma?: string; slug?: string
    rating?: number; texto?: string; nombre?: string
  }>(event)

  const pedido = String(body?.pedido || '').trim()
  const slug = String(body?.slug || '').trim()
  const firma = String(body?.firma || '').trim()
  if (!pedido || !slug || !firma) throw createError({ statusCode: 400, message: 'Enlace incompleto.' })

  // 1) La firma. Se revisa ANTES de tocar la base: si no es válida, no hay por
  //    qué gastar una consulta ni revelar si ese pedido existe.
  if (!verificarResena(pedido, slug, firma)) {
    throw createError({ statusCode: 403, message: 'Este enlace no es válido.' })
  }

  const rating = Math.round(Number(body?.rating))
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw createError({ statusCode: 400, message: 'Elige una calificación del 1 al 5.' })
  }
  const texto = String(body?.texto || '').trim().slice(0, 2000)
  if (texto.length < 4) throw createError({ statusCode: 400, message: 'Cuéntanos un poco más.' })

  const admin = supabaseAdmin()

  // 2) y 3) El pedido está pagado y trae ese producto.
  const { data: orden, error: e1 } = await admin
    .from('orders')
    .select('id, status, shipping_address')
    .eq('id', pedido)
    .maybeSingle()
  if (e1 || !orden) throw createError({ statusCode: 403, message: 'Este enlace no es válido.' })
  if (orden.status !== 'paid') {
    throw createError({ statusCode: 403, message: 'Ese pedido todavía no aparece como pagado.' })
  }

  const { data: renglones, error: e2 } = await admin
    .from('order_items')
    .select('product_slug')
    .eq('order_id', pedido)
  if (e2) throw createError({ statusCode: 500, message: 'No se pudo verificar el pedido.' })
  if (!(renglones || []).some(r => r.product_slug === slug)) {
    throw createError({ statusCode: 403, message: 'Ese producto no viene en tu pedido.' })
  }

  // El nombre que se muestra. Si no escribe uno, el de quien recibió el paquete;
  // y si tampoco, algo neutro. NUNCA el correo: es una página pública.
  const dir = (orden.shipping_address || {}) as Record<string, string>
  const nombre = (String(body?.nombre || '').trim() || String(dir.recipient || '').trim() || 'Cliente AMANTI').slice(0, 60)

  const { error } = await admin.from('reviews').insert({
    user_id: null,
    order_id: pedido,
    product_slug: slug,
    author_name: nombre,
    rating,
    text: texto,
  })
  if (error) {
    // Índice único (order_id, product_slug): una reseña por producto y compra.
    if ((error as any).code === '23505') {
      throw createError({ statusCode: 409, message: 'Ya dejaste tu reseña de este producto. ¡Gracias!' })
    }
    throw createError({ statusCode: 500, message: 'No se pudo guardar tu reseña.' })
  }

  return { ok: true }
})
