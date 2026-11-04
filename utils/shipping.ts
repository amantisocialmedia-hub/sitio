/** Regla compartida en MXN. Subtotal después de campaña y cupón, sin envío.
 * Reemplaza las dos variables de entorno para evitar mostrar y cobrar importes distintos.
 */
export const FREE_SHIPPING_THRESHOLD = 1000
export const SHIPPING_COST = 80
export function calcularEnvio(subtotalConDescuento: number): number {
  return Number.isFinite(subtotalConDescuento) && subtotalConDescuento >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST
}
