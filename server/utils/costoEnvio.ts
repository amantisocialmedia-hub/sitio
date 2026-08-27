/**
 * Costo de envío del pedido.
 *
 * POR QUÉ EXISTE: hasta el 27-ago-2026 el carrito decía «Envío: se calcula al
 * pagar» y nunca lo calculaba ni lo sumaba. Se cobraba solo el producto, así
 * que cada pedido bajo el umbral le costaba el envío a Amanti. Lo levantó Raúl
 * («¿Ya cobra lo del envío?») y se verificó en el código.
 *
 * El monto NO vive aquí: sale de NUXT_ENVIO_COSTO. Es una decisión comercial de
 * Raúl y Nancy, y cuando la muevan debe bastar con cambiar la variable en
 * Vercel — sin desplegar y sin depender de mí.
 *
 * Con la variable vacía o en 0 el envío sale gratis, que es el comportamiento
 * que ya tenía el sitio. Así encender el cobro es una decisión explícita y no
 * un efecto secundario de este archivo.
 */

/** Subtotal a partir del cual el envío es gratis. Igual que en stores/cart.ts. */
export const UMBRAL_ENVIO_GRATIS = 1000

/** Lo que se cobra de envío bajo el umbral. 0 = gratis para todos. */
export function costoEnvioConfigurado(): number {
  const n = Number(process.env.NUXT_ENVIO_COSTO || 0)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

/**
 * Cuánto se cobra de envío para un pedido.
 *
 * Se calcula sobre el subtotal DESPUÉS del descuento, que es lo que el cliente
 * realmente paga por producto. Hacerlo sobre el subtotal antes del cupón
 * regalaría envíos: alguien con un cupón grande cruzaría el umbral sin haber
 * pagado esa cantidad.
 */
export function calcularEnvio(subtotalConDescuento: number, costo = costoEnvioConfigurado()): number {
  // Siempre a pesos enteros. Un cargo de "$99.60" en el desglose se ve a error
  // y obliga a explicarlo; además Mercado Pago suma centavos por su cuenta y el
  // total del pedido dejaría de cuadrar con el de la preferencia.
  const c = Number.isFinite(costo) && costo > 0 ? Math.round(costo) : 0
  if (c <= 0) return 0
  // Ante una entrada inválida se cobra: equivocarse hacia "gratis" cuesta
  // dinero en cada pedido y no se nota hasta el corte del mes.
  if (!Number.isFinite(subtotalConDescuento) || subtotalConDescuento < 0) return c
  return subtotalConDescuento >= UMBRAL_ENVIO_GRATIS ? 0 : c
}
