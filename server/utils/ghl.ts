// Puente de eventos del sitio hacia GoHighLevel.
//
// César tiene armadas en GHL las plantillas y las automatizaciones (carrito
// abandonado, postcompra, reseña al día 10, cross-selling al 21, reactivación,
// extractores). Lo que le falta para dispararlas son los datos del sitio: qué
// compró el cliente, cuánto, cuándo, y a qué ficha mandarlo. Este archivo es
// ese puente, y nada más: un POST de JSON al webhook entrante de GHL.
//
// TRES REGLAS QUE NO SE NEGOCIAN
//
// 1. SIN URL CONFIGURADA NO HACE NADA.
//    Devuelve false y se acabó. El sitio se comporta igual con GHL conectado o
//    sin conectar, así que esto se puede mezclar y desplegar hoy, antes de que
//    exista la URL. El día que César la dé, se pega en la env y empieza a fluir
//    sin tocar código.
//
// 2. NUNCA LANZA.
//    Va enganchado al webhook de Mercado Pago, que es el camino por el que se
//    confirma un pago. Si un fallo de red con GHL tumbara ese handler, MP lo
//    reintentaría y —peor— el pedido podría quedarse sin marcar como pagado.
//    Un correo de marketing que no sale es un problema; un pago que no se
//    registra es otro tamaño de problema. Por eso aquí todo va envuelto y lo
//    máximo que pasa es un console.warn.
//
// 3. NO BLOQUEA AL CLIENTE.
//    Timeout corto y el llamador no espera el resultado. Nadie debería ver la
//    pantalla de "gracias por tu compra" más lenta porque GHL tardó.
//
// El contrato con GHL es deliberadamente plano: `evento` + `datos`. Los
// workflows de GHL filtran por `evento` y leen los campos de `datos`. Si mañana
// cambia el nombre de un workflow, no se toca este archivo.

/** Eventos que el sitio sabe emitir. Cada uno alimenta un workflow de GHL. */
export type GhlEvento =
  | 'compra_confirmada' // dispara postcompra, reseña, cross-selling y saca de las secuencias de abandono
  | 'carrito_abandonado' // dispara la secuencia de 1h / 24h / 48h
  | 'carrito_recuperado' // saca al cliente de la secuencia de abandono

/** Cuánto esperamos a GHL antes de rendirnos. Corto a propósito: ver regla 3. */
const TIMEOUT_MS = 4000

/** La URL del webhook entrante de GHL. Vacía = integración apagada. */
function webhookUrl(): string {
  return (process.env.NUXT_GHL_WEBHOOK_URL || '').trim()
}

/**
 * Si la integración con GHL está conectada ahora mismo.
 * Útil para no armar payloads caros cuando no hay a dónde mandarlos.
 */
export function ghlConectado(): boolean {
  return webhookUrl().length > 0
}

/**
 * Manda un evento a GHL. Devuelve si GHL lo aceptó.
 *
 * NUNCA rechaza la promesa: un fallo devuelve false. Eso es intencional y es lo
 * que permite llamarla desde el camino de confirmación de pago sin miedo.
 *
 * @param evento  cuál de los workflows de GHL se busca disparar
 * @param datos   campos que el correo necesita para personalizarse
 */
export async function emitirEventoGhl(
  evento: GhlEvento,
  datos: Record<string, unknown>,
): Promise<boolean> {
  const url = webhookUrl()
  if (!url) return false // regla 1: sin configurar, no-op silencioso

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ evento, enviado_en: new Date().toISOString(), ...datos }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn(`[ghl] ${evento}: GHL respondió ${res.status}`)
      return false
    }
    return true
  } catch (e: any) {
    // Red caída, timeout, DNS, JSON no serializable: todo cae aquí y muere aquí.
    console.warn(`[ghl] ${evento}: no se pudo entregar —`, e?.message || e)
    return false
  }
}

/**
 * Igual que `emitirEventoGhl` pero sin esperar: dispara y sigue.
 *
 * Esta es la que se usa desde los handlers que tienen un cliente esperando del
 * otro lado (confirmación de pago, guardado de carrito). El `void` y el `.catch`
 * redundante son a propósito: garantizan que ni siquiera una promesa rechazada
 * escape hacia el runtime y ensucie los logs con "unhandled rejection".
 */
export function emitirEventoGhlSinEsperar(
  evento: GhlEvento,
  datos: Record<string, unknown>,
): void {
  void emitirEventoGhl(evento, datos).catch(() => false)
}

/**
 * Arma el payload de una compra confirmada.
 *
 * Lo que César pidió explícitamente que GHL pudiera recibir del sitio: qué
 * producto compró, datos del pedido, enlace a la ficha del producto, e
 * información suficiente para recomendar relacionados. El `url_resena` es el
 * que va en el correo del día 10 — César lo pidió por su nombre: poder mandar
 * al cliente directo a la ficha a dejar su review.
 */
export function payloadCompra(opts: {
  orderId: string
  email: string | null
  total: number
  items: { slug: string; name: string; price: number; quantity: number }[]
  sitio?: string
}): Record<string, unknown> {
  const base = (opts.sitio || process.env.NUXT_PUBLIC_SITE_URL || 'https://amanti.mx').replace(/\/+$/, '')
  const items = (opts.items || []).map((i) => ({
    slug: i.slug,
    nombre: i.name,
    precio: i.price,
    cantidad: i.quantity,
    url_producto: `${base}/tienda/${i.slug}`,
  }))
  const principal = items[0] || null

  return {
    pedido_id: opts.orderId,
    email: opts.email,
    total: opts.total,
    num_articulos: items.reduce((n, i) => n + (Number(i.cantidad) || 0), 0),
    items,
    // Atajos para las plantillas: GHL sufre para iterar arreglos dentro de un
    // correo, así que el producto principal va también aplanado.
    producto_principal: principal?.nombre ?? null,
    producto_principal_slug: principal?.slug ?? null,
    url_producto: principal?.url_producto ?? null,
    url_resena: principal ? `${base}/tienda/${principal.slug}#resenas` : null,
  }
}
