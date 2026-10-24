// GET /api/keepalive — un toque diario a Supabase para que el plan gratis no
// pause el proyecto.
//
// El 24-oct-2026 la tienda estaba sin poder registrar pedidos: la organización
// de AMANTI en Supabase está en plan Free, y Free pausa un proyecto tras 7 días
// sin peticiones. La tienda sólo le pega a la base cuando alguien compra, deja
// reseña o guarda carrito, así que una semana floja basta para que se pause.
// Vercel llama esta ruta una vez al día (vercel.json → crons). No cambia nada:
// es un conteo. La solución de fondo es el plan Pro de Supabase; esto es la red.
import { defineEventHandler } from 'h3'
import { supabaseAdmin } from '../utils/supabaseAdmin'

export default defineEventHandler(async () => {
  try {
    const { count, error } = await supabaseAdmin().from('coupons').select('code', { count: 'exact', head: true })
    if (error) return { ok: false, error: error.message, at: new Date().toISOString() }
    return { ok: true, coupons: count ?? 0, at: new Date().toISOString() }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e), at: new Date().toISOString() }
  }
})
