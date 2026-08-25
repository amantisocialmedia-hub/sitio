// POST /api/cart-save
// Guarda/actualiza un snapshot del carrito abandonado (correo + items) con service_role.
// Sirve para recuperación posterior (WhatsApp manual hoy; correo cuando se conecte un ESP).
// Degrada con gracia: si la tabla `abandoned_carts` no existe, no rompe nada.
import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseUser } from '#supabase/server'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { ghlConectado, emitirEventoGhlSinEsperar, debeAvisarCarrito } from '../utils/ghl'

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

  // ¿Hay que avisarle a GHL? Solo si este carrito es un episodio NUEVO.
  //
  // Este endpoint se llama muchísimo: 4s despues de cada cambio del carrito y
  // cada vez que se oculta la pestaña. Un solo comprador genera facilmente 8-10
  // llamadas. Los triggers de GHL son premium y se cobran POR USO, asi que
  // seguir cada guardado seria tirar dinero — y ademas re-meteria al mismo
  // contacto en la secuencia de 1h/24h/48h una y otra vez.
  //
  // El candado: si ya existe una fila viva (no recuperada) para este correo, es
  // que ya le avisamos de este episodio y nos callamos. Solo disparamos en la
  // transicion de "sin carrito abandonado" a "con carrito abandonado".
  let episodioVivo = true // pesimista: si no logramos leer, asumimos que ya avisamos
  let registroDisponible = false

  try {
    const admin = supabaseAdmin()
    if (recuperado) {
      // No hay webhook de "recuperado": en GHL los extractores sacan al cliente
      // de la secuencia cuando compra. Aqui solo cerramos nuestro registro, que
      // es lo que rearma el candado para el proximo carrito.
      await admin.from('abandoned_carts').update({ recovered: true, updated_at: new Date().toISOString() }).eq('email', email)
    } else {
      const { data: previo } = await admin
        .from('abandoned_carts')
        .select('email')
        .eq('email', email)
        .eq('recovered', false)
        .maybeSingle()
      episodioVivo = !!previo
      registroDisponible = true
      await admin.from('abandoned_carts').upsert(
        { user_id: userId, email, items, total, recovered: false, updated_at: new Date().toISOString() },
        { onConflict: 'email' },
      )
    }
  } catch {
    // La tabla puede no existir aun. Sin ella no hay forma de saber si ya
    // avisamos, y ante la duda NO disparamos: equivocarse hacia el lado de
    // mandar de mas aqui significa cobrar de mas y spamear al cliente.
    registroDisponible = false
  }

  // GHL es quien manda los correos de 1h / 24h / 48h. Le contamos una sola vez
  // por episodio; los tiempos y el contenido los maneja el workflow.
  if (debeAvisarCarrito({ recuperado, episodioVivo, registroDisponible }) && ghlConectado('carrito_abandonado')) {
    emitirEventoGhlSinEsperar('carrito_abandonado', {
      email,
      total,
      num_articulos: items.reduce((n, i) => n + i.quantity, 0),
      items,
      url_carrito: `${(process.env.NUXT_PUBLIC_SITE_URL || 'https://amanti.mx').replace(/\/+$/, '')}/carrito`,
    })
  }
  return { ok: true }
})
