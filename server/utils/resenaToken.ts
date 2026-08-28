/**
 * Permiso para dejar reseña sin tener cuenta.
 *
 * POR QUE EXISTE: hasta el 27-ago-2026 dejar reseña exigía iniciar sesión. Ese
 * mismo día se descubrió que quien compra SIN cuenta es la mayoría —de hecho
 * hasta esa tarde era el único que no podía ni pagar—. La secuencia del día 10
 * que arma César manda al cliente a la ficha del producto a dejar su reseña; sin
 * esto, todos esos clientes llegan a un «Inicia sesión» y se van.
 *
 * COMO FUNCIONA: el enlace del correo lleva una firma de (pedido + producto).
 * La firma se hace aquí con una llave que solo vive en el servidor, así que
 * nadie la puede fabricar. Al recibirla se comprueba, además, que ese pedido
 * esté PAGADO y que de verdad incluya ese producto.
 *
 * POR QUE NO UN MAGIC LINK: César propuso mandar un enlace de acceso para que el
 * invitado se cree cuenta y reseñe. Esto sale mejor por dos razones: no obliga a
 * nadie a crear cuenta para opinar, y la reseña queda amarrada a una compra
 * real. Con el sistema viejo cualquiera con cuenta podía reseñar cualquier
 * producto sin haberlo comprado nunca.
 *
 * SIN LLAVE CONFIGURADA NO HACE NADA: no se firman enlaces y no se aceptan. El
 * sitio se comporta como antes. Encenderlo es una decisión explícita.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

function llave(): string {
  return (process.env.NUXT_RESENA_SECRET || '').trim()
}

/** Si la reseña de invitado está encendida. */
export function resenasInvitadoActivas(): boolean {
  return llave().length > 0
}

/**
 * Firma de un permiso. Corta a 32 hex: un enlace de correo lo lee gente y a
 * veces lo teclea, y 128 bits sobran para lo que protege esto.
 */
export function firmarResena(orderId: string, slug: string): string | null {
  const k = llave()
  if (!k) return null
  return createHmac('sha256', k).update(`${orderId}:${slug}`).digest('hex').slice(0, 32)
}

/**
 * Comprueba una firma.
 *
 * La comparación es de tiempo constante: comparar con === filtra, byte a byte,
 * qué tan cerca anduvo quien lo intenta, y con suficientes intentos eso permite
 * construir una firma válida sin conocer la llave.
 */
export function verificarResena(orderId: string, slug: string, firma: string): boolean {
  const esperada = firmarResena(orderId, slug)
  if (!esperada || !firma) return false
  const a = Buffer.from(esperada, 'utf8')
  const b = Buffer.from(String(firma).trim().toLowerCase(), 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * El enlace que va en el correo del día 10.
 *
 * Sin llave configurada devuelve el enlace de siempre, sin permiso: la ficha se
 * abre igual y quien tenga cuenta puede reseñar como antes.
 */
export function urlResena(base: string, orderId: string, slug: string): string {
  const raiz = `${base.replace(/\/+$/, '')}/tienda/${slug}`
  const f = firmarResena(orderId, slug)
  return f ? `${raiz}?pedido=${orderId}&firma=${f}#resenas` : `${raiz}#resenas`
}
