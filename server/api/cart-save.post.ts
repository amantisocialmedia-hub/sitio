// POST /api/cart-save
// Guarda/actualiza un snapshot del carrito abandonado (correo + items) con service_role.
// Sirve para recuperación posterior (WhatsApp manual hoy; correo cuando se conecte un ESP).
// Degrada con gracia: si la tabla `abandoned_carts` no existe, no rompe nada.
import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseUser } from '#supabase/server'
import { supabaseAdmin } from '../utils/supabaseAdmin'

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

  try {
    const admin = supabaseAdmin()
    // Carrito vacío o compra completada → marca como recuperado.
    if (body?.recovered || !Array.isArray(body?.items) || !body!.items!.length) {
      await admin.from('abandoned_carts').update({ recovered: true, updated_at: new Date().toISOString() }).eq('email', email)
      return { ok: true }
    }
    const items = body!.items!.slice(0, 50).map((i: any) => ({
      slug: String(i?.slug || ''), name: String(i?.name || ''), price: Number(i?.price) || 0, quantity: Number(i?.quantity) || 1,
    }))
    await admin.from('abandoned_carts').upsert(
      { user_id: userId, email, items, total: Number(body?.total) || 0, recovered: false, updated_at: new Date().toISOString() },
      { onConflict: 'email' },
    )
  } catch { /* tabla puede no existir aún */ }
  return { ok: true }
})
