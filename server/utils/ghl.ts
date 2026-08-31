// Puente de eventos del sitio hacia GoHighLevel.
//
// César tiene armadas en GHL las secuencias (postcompra, reseña al día 10,
// cross-selling al 21, carrito abandonado 1h/24h/48h, reactivación). Lo que le
// falta para dispararlas son los datos del sitio. Esto es ese puente.
//
// UNA URL POR AUTOMATIZACIÓN, NO UNA GLOBAL
// GHL genera una URL de "Inbound Webhook" distinta por cada workflow, así que
// aquí el evento no viaja como campo: el evento ES la URL a la que se manda.
// El campo `evento` va igual dentro del cuerpo, pero solo para depurar.
//
// ⚠️ CADA DISPARO CUESTA DINERO
// César avisó que estos triggers son premium y se cobran POR USO. Eso cambia el
// diseño: no basta con que funcione, tiene que dispararse el mínimo de veces
// posible. Por eso `carrito_abandonado` lleva un candado en el llamador (ver
// server/api/cart-save.post.ts) que lo limita a UNA vez por episodio de
// carrito, en vez de las 8-10 que saldrían si siguiéramos cada guardado.
//
// TRES REGLAS QUE NO SE NEGOCIAN
//
// 1. SIN URL CONFIGURADA NO HACE NADA. Devuelve false y ya. El sitio se comporta
//    igual con GHL conectado o sin conectar, y cada evento se enciende por
//    separado según qué URLs estén puestas.
//
// 2. NUNCA LANZA. Va enganchado al webhook de Mercado Pago, que es el camino por
//    el que se confirma un pago. Si un fallo de red con GHL tumbara ese handler,
//    MP lo reintentaría y el pedido podría quedarse sin marcar como pagado. Un
//    correo de marketing que no sale es un problema; un pago que no se registra
//    es otro tamaño de problema.
//
// 3. NO BLOQUEA AL CLIENTE. Timeout corto y el llamador no espera el resultado.

import { urlResena } from './resenaToken'

/** Eventos que el sitio sabe emitir. Cada uno tiene su propia URL en GHL. */
export type GhlEvento =
  | 'compra_confirmada' // → workflow de postcompra (reseña día 10, cross-selling día 21)
  | 'carrito_abandonado' // → workflow de carrito abandonado (1h / 24h / 48h)
  | 'reactivacion' // → workflow de reactivación / recompra
  // → mensaje de WhatsApp a quien surte. Lo pidió Nancy el 27-ago-2026:
  //   «que me llegue por whats por favor».
  | 'pedido_para_surtir'

/**
 * De qué variable de entorno sale la URL de cada evento.
 *
 * Las URLs NO se commitean: llevan el id de la cuenta de GHL y quien las tenga
 * puede disparar el workflow —y generar cobro— sin más. Van en .env y en las
 * variables de entorno de Vercel.
 */
const ENV_POR_EVENTO: Record<GhlEvento, string> = {
  compra_confirmada: 'NUXT_GHL_WEBHOOK_POSTCOMPRA',
  carrito_abandonado: 'NUXT_GHL_WEBHOOK_CARRITO_ABANDONADO',
  reactivacion: 'NUXT_GHL_WEBHOOK_REACTIVACION',
  pedido_para_surtir: 'NUXT_GHL_WEBHOOK_AVISO_PEDIDO',
}

/** Cuánto esperamos a GHL antes de rendirnos. Corto a propósito: ver regla 3. */
const TIMEOUT_MS = 4000

function urlDe(evento: GhlEvento): string {
  return (process.env[ENV_POR_EVENTO[evento]] || '').trim()
}

/**
 * Si ESTE evento tiene su URL puesta. Se pregunta por evento, no global: se
 * puede tener postcompra conectado y carrito todavía no.
 */
export function ghlConectado(evento: GhlEvento): boolean {
  return urlDe(evento).length > 0
}

/**
 * Manda un evento a GHL. Devuelve si GHL lo aceptó.
 *
 * NUNCA rechaza la promesa: un fallo devuelve false. Eso es intencional y es lo
 * que permite llamarla desde el camino de confirmación de pago sin miedo.
 */
export async function emitirEventoGhl(
  evento: GhlEvento,
  datos: Record<string, unknown>,
): Promise<boolean> {
  const url = urlDe(evento)
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
 * otro lado. El `void` y el `.catch` redundante son a propósito: garantizan que
 * ni una promesa rechazada escape al runtime como "unhandled rejection".
 */
export function emitirEventoGhlSinEsperar(
  evento: GhlEvento,
  datos: Record<string, unknown>,
): void {
  void emitirEventoGhl(evento, datos).catch(() => false)
}

/**
 * Decide si hay que avisarle a GHL de un carrito abandonado.
 *
 * Vive aquí y no dentro del endpoint porque es LA regla que evita que nos cobren
 * de más: el trigger es premium y se paga por uso, y /api/cart-save se llama 8-10
 * veces por comprador. Separada así queda probada.
 *
 * @param recuperado          el carrito se vació o ya compró
 * @param episodioVivo        ya hay una fila sin recuperar para este correo, o sea
 *                            que de este mismo carrito ya le avisamos a GHL
 * @param registroDisponible  se pudo leer la tabla `abandoned_carts`
 */
export function debeAvisarCarrito(opts: {
  recuperado: boolean
  episodioVivo: boolean
  registroDisponible: boolean
}): boolean {
  if (opts.recuperado) return false // no hay webhook de "recuperado": lo hacen los extractores
  if (!opts.registroDisponible) return false // sin registro no sabemos si ya avisamos; ante la duda, no
  return !opts.episodioVivo // solo en la transición de "sin carrito" a "carrito abandonado"
}

/**
 * Arma el payload de una compra confirmada.
 *
 * Lo que César pidió que GHL pudiera recibir del sitio: qué producto compró,
 * datos del pedido, enlace a la ficha y lo suficiente para recomendar
 * relacionados. `url_resena` es el que va en el correo del día 10 — lo pidió por
 * su nombre: mandar al cliente directo a la ficha a dejar su review.
 */
export function payloadCompra(opts: {
  orderId: string
  email: string | null
  total: number
  items: { slug: string; name: string; price: number; quantity: number }[]
  sitio?: string
  nombre?: string | null
  telefono?: string | null
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
    // Nombre y telefono van para que GHL pueda armar un CONTACTO de verdad y la
    // plantilla tenga con quien saludar. Sin esto el correo de confirmacion sale
    // como "Hola ," y en GHL el comprador aparece como un ID sin persona: asi se
    // veia el unico registro que existia en el historial de postcompra.
    nombre: opts.nombre || null,
    telefono: opts.telefono || null,
    total: opts.total,
    num_articulos: items.reduce((n, i) => n + (Number(i.cantidad) || 0), 0),
    items,
    // Atajos para las plantillas: GHL sufre para iterar arreglos dentro de un
    // correo, así que el producto principal va también aplanado.
    producto_principal: principal?.nombre ?? null,
    producto_principal_slug: principal?.slug ?? null,
    url_producto: principal?.url_producto ?? null,
    url_resena: principal ? urlResena(base, opts.orderId, principal.slug) : null,
    // Un enlace por producto: el correo del día 10 puede pedir reseña de cada
    // cosa que se llevó, no solo de la primera.
    urls_resena: items.map((i) => ({
      producto: i.nombre,
      slug: i.slug,
      url: urlResena(base, opts.orderId, i.slug),
    })),
  }
}
