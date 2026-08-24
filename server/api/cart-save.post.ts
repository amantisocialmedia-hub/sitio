// POST /api/cart-save
// Guarda/actualiza un snapshot del carrito abandonado (correo + items) con service_role.
// Sirve para recuperación posterior (WhatsApp manual hoy; correo cuando se conecte un ESP).
// Degrada con gracia: si la tabla `abandoned_carts` no existe, no rompe nada.
import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseUser } from '#supabase/server'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { ghlConectado, emitirEventoGhlSinEsperar } from '../utils/ghl'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string; items?: any[]; total?: number; recovered?: boolean }>(event)

  let userId: string | null = null
  let userEmail: string | null = null
  try {
    const u = (await serverSupabaseUser(event)) as any
    userId = u?.id ?? u?.sub ?? null
    userEmail = u?.email ?? null
  } catch { /* sin sesión */ }

  const email = ((body?.email || userEmail || '').toString().trim().toLowerCase()) || null
  if (!email) return { ok: false } // sin correo no podemos recuperar

  // Carrito vacío o compra completada → se marca como recuperado.
  const recuperado = !!body?.recovered || !Array.isArray(body?.items) || !body!.items!.length
  const items = recuperado
    ? []
    : body!.items!.slice(0, 50).map((i: any) => ({
        slug: String(i?.slug || ''), name: String(i?.name || ''), price: Number(i?.price) || 0, quantity: Number(i?.quantity) || 1,
      }))
  const total = Number(body?.total) || 0

  try {
    const admin = supabaseAdmin()
    if (recuperado) {
      await admin.from('abandoned_carts').update({ recovered: true, updated_at: new Date().toISOString() }).eq('email', email)
    } else {
      await admin.from('abandoned_carts').upsert(
        { user_id: userId, email, items, total, recovered: false, updated_at: new Date().toISOString() },
        { onConflict: 'email' },
      )
    }
  } catch { /* tabla puede no existir aún */ }

  // Aviso a GoHighLevel, que es quien manda los correos de 1h / 24h / 48h.
  //
  // Va FUERA del try de Supabase a propósito: nuestra tabla es el registro
  // interno, pero el correo lo dispara GHL. Si alguien no ha corrido
  // supabase/abandoned-carts.sql, la secuencia debe funcionar igual.
  if (ghlConectado()) {
    emitirEventoGhlSinEsperar(recuperado ? 'carrito_recuperado' : 'carrito_abandonado', {
      email,
      total,
      num_articulos: items.reduce((n, i) => n + i.quantity, 0),
      items,
      url_carrito: `${(process.env.NUXT_PUBLIC_SITE_URL || 'https://amanti.mx').replace(/\/+$/, '')}/carrito`,
    })
  }
  return { ok: true }
})
