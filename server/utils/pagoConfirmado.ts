// El estado final de un pedido, en UN solo lugar.
//
// Lo llaman el webhook de Mercado Pago y el regreso/webhook de PayPal: las dos
// pasarelas deciden distinto si un pago quedó, pero lo que pasa DESPUÉS tiene
// que ser idéntico. Antes vivía dentro de mp-webhook.post.ts; al entrar PayPal
// (24-oct-2026) se sacó aquí para no tener dos copias que se desincronicen.
//
// Reglas (las mismas desde agosto de 2026):
//  - Idempotente: el mismo estado dos veces no hace nada.
//  - Transiciones SOLO hacia adelante: 'paid' no se revierte por un evento
//    tardío de rechazo. 'paid' sí admite venir de 'cancelled' porque un
//    reintento aprobado puede llegar tras un primer intento rechazado.
//  - El UPDATE es atómico (.in('status', permitidos)): entre dos entregas
//    concurrentes solo una gana, y solo esa avisa a GoHighLevel.
//  - Nunca se marca 'paid' un pedido sin artículos.
import { createError } from 'h3'
import { supabaseAdmin } from './supabaseAdmin'
import { ghlConectado, emitirEventoGhlSinEsperar, payloadCompra } from './ghl'
import { avisarPedidoParaSurtir } from './avisoPedido'
import { correoValido } from './envio'

export type EstadoFinal = 'paid' | 'cancelled' | 'refunded'

// Estados previos permitidos por estado destino.
export const ALLOWED_PREV: Record<EstadoFinal, string[]> = {
  paid: ['pending', 'cancelled'],
  cancelled: ['pending'],
  refunded: ['paid'],
}

export function transicionPermitida(actual: string, nuevo: EstadoFinal): boolean {
  return (ALLOWED_PREV[nuevo] || []).includes(actual)
}

/** La respuesta que se le devuelve a la pasarela. Las formas se conservan tal cual las esperaban los tests. */
export interface ResultadoEstado {
  ok?: true
  ignored?: true
  idempotent?: true
  noChange?: true
  reason?: string
  from?: string
  to?: string
  orderId?: string
  status?: string
}

export interface CambioDeEstado {
  orderId: string
  nuevo: EstadoFinal
  /** Columnas que van en el MISMO update que el estado (deben existir en la tabla). */
  columnas?: Record<string, unknown>
  /**
   * Columnas que se intentan guardar aparte, después, y cuyo fallo no importa:
   * para ids de la pasarela cuya columna puede no existir todavía.
   */
  columnasOpcionales?: Record<string, unknown>
  /** Prefijo para los logs: 'mp-webhook', 'paypal-return', ... */
  etiqueta?: string
}

/**
 * Aplica el estado final a un pedido con todas las salvaguardas, y si quedó
 * pagado avisa a GoHighLevel (a quien surte y al marketing).
 */
export async function aplicarEstadoPedido(cambio: CambioDeEstado): Promise<ResultadoEstado> {
  const { orderId, nuevo } = cambio
  const tag = `[${cambio.etiqueta || 'pago'}]`
  const admin = supabaseAdmin()

  const { data: order } = await admin.from('orders').select('id, status').eq('id', orderId).maybeSingle()
  if (!order) return { ignored: true, reason: 'order-not-found' }
  if (order.status === nuevo) return { ok: true, idempotent: true } // reintento de la pasarela

  const allowedPrev = ALLOWED_PREV[nuevo] || []
  if (!allowedPrev.includes(order.status)) {
    // p.ej. un rechazo tardío sobre un pedido ya pagado -> no se aplica.
    return { ok: true, noChange: true, reason: 'transition-not-allowed', from: order.status, to: nuevo }
  }

  // Salvaguarda: nunca marcar 'paid' un pedido sin artículos (rollback huérfano, etc.).
  if (nuevo === 'paid') {
    const { count } = await admin.from('order_items').select('id', { count: 'exact', head: true }).eq('order_id', orderId)
    if (!count) {
      console.error(`${tag} pago aprobado para order sin items, no se marca paid:`, orderId)
      return { ignored: true, reason: 'order-has-no-items' }
    }
  }

  // UPDATE atómico: .in('status', allowedPrev) garantiza que solo una de dos
  // entregas concurrentes aplique el cambio (cierra el TOCTOU).
  const { data: updated, error } = await admin
    .from('orders')
    .update({ status: nuevo, ...(cambio.columnas || {}) })
    .eq('id', orderId)
    .in('status', allowedPrev)
    .select('id')
  if (error) {
    console.error(`${tag} no se pudo actualizar el pedido ${orderId}:`, error.message)
    throw createError({ statusCode: 500, message: 'No se pudo actualizar el pedido.' })
  }
  if (!updated || updated.length === 0) return { ok: true, idempotent: true } // perdió la carrera

  if (cambio.columnasOpcionales && Object.keys(cambio.columnasOpcionales).length) {
    const { error: opErr } = await admin.from('orders').update(cambio.columnasOpcionales).eq('id', orderId)
    if (opErr) console.warn(`${tag} no se guardaron las columnas opcionales (¿falta la columna?):`, opErr.message)
  }

  if (nuevo === 'paid') await avisarCompraConfirmada(orderId, tag)

  return { ok: true, orderId, status: nuevo }
}

/**
 * Aviso a GoHighLevel cuando un pedido queda pagado: a quien surte (Nancy) y al
 * evento de marketing (postcompra, reseña, cross-selling, sacar del carrito
 * abandonado). Son DOS cosas distintas con dos URLs y dos workflows.
 *
 * Va DESPUÉS del update atómico y solo si este ganó la carrera, para que un
 * reintento de la pasarela no dispare el correo dos veces. Todo el bloque va
 * envuelto y no se espera la respuesta: si GHL falla, el pedido YA quedó pagado
 * y la función devuelve ok igual. Un correo que no sale se arregla; un pago que
 * la pasarela reintenta porque le devolvimos 500 es mucho peor.
 */
export async function avisarCompraConfirmada(orderId: string, tag = '[pago]'): Promise<void> {
  // Cada emisor se auto-protege si su URL falta; aquí solo se pregunta si hay
  // ALGO que mandar, para no pagar las consultas a Supabase en balde.
  if (!ghlConectado('compra_confirmada') && !ghlConectado('pedido_para_surtir')) return
  try {
    const admin = supabaseAdmin()
    const [{ data: full }, { data: lineas }] = await Promise.all([
      admin.from('orders').select('user_id, total, shipping_address, gift').eq('id', orderId).maybeSingle(),
      admin.from('order_items').select('product_slug, product_name, unit_price, quantity').eq('order_id', orderId),
    ])
    // El correo no vive en una columna de `orders`: con cuenta sale del usuario
    // de Supabase; de invitado, del que tecleó en el carrito (shipping_address).
    let email: string | null = null
    if (full?.user_id) {
      const { data: u } = await admin.auth.admin.getUserById(String(full.user_id))
      email = u?.user?.email ?? null
    }
    if (!email) email = correoValido((full as any)?.shipping_address?.email) ?? null

    avisarPedidoParaSurtir({
      pedidoId: orderId,
      total: Number(full?.total) || 0,
      items: (lineas || []).map((l: any) => ({
        nombre: String(l.product_name || ''),
        cantidad: Number(l.quantity) || 1,
      })),
      envio: (full as any)?.shipping_address ?? null,
      esRegalo: !!(full as any)?.gift?.isGift,
    })

    const dir = ((full as any)?.shipping_address || {}) as Record<string, string>
    emitirEventoGhlSinEsperar('compra_confirmada', payloadCompra({
      orderId,
      email,
      nombre: dir.recipient || null,
      telefono: dir.phone || null,
      total: Number(full?.total) || 0,
      items: (lineas || []).map((l: any) => ({
        slug: String(l.product_slug || ''),
        name: String(l.product_name || ''),
        price: Number(l.unit_price) || 0,
        quantity: Number(l.quantity) || 1,
      })),
    }))
  } catch (e: any) {
    console.warn(`${tag} no se pudo avisar a GHL:`, e?.message || e)
  }
}
