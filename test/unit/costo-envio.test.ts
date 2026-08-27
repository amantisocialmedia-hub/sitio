// Cobro de envío.
//
// El riesgo es de dinero y va en los dos sentidos: si no se cobra, cada pedido
// bajo el umbral le cuesta el envío a Amanti (que es como estaba hasta el
// 27-ago-2026 y lo levantó Raúl); si se cobra de más o cuando no toca, el
// cliente paga algo que no debía.
//
// Lo más delicado es CUÁNDO aplica el umbral: sobre el subtotal después del
// descuento, no antes. Si fuera antes, alguien con un cupón grande cruzaría los
// $1,000 sin haber pagado esa cantidad y se llevaría el envío gratis.
import { describe, it, expect } from 'vitest'
import { calcularEnvio, UMBRAL_ENVIO_GRATIS } from '~/server/utils/costoEnvio'

const COSTO = 150

describe('calcularEnvio', () => {
  it('cobra el envío bajo el umbral', () => {
    expect(calcularEnvio(500, COSTO)).toBe(COSTO)
    expect(calcularEnvio(999, COSTO)).toBe(COSTO)
  })

  it('es gratis justo en el umbral y por encima', () => {
    expect(calcularEnvio(UMBRAL_ENVIO_GRATIS, COSTO)).toBe(0)
    expect(calcularEnvio(1500, COSTO)).toBe(0)
  })

  it('con costo 0 el envío es gratis para todos', () => {
    // Es el comportamiento que tenía el sitio antes. Encender el cobro debe ser
    // una decisión explícita, no un efecto secundario de desplegar.
    expect(calcularEnvio(200, 0)).toBe(0)
    expect(calcularEnvio(5000, 0)).toBe(0)
  })

  it('el umbral se mide sobre lo que el cliente REALMENTE paga', () => {
    // Compra de $1,200 con cupón de $300 → paga $900 → sí se le cobra envío.
    // Si se midiera sobre los $1,200 originales, se regalaría el envío de una
    // compra de $900.
    expect(calcularEnvio(900, COSTO)).toBe(COSTO)
  })

  it('no regala el envío con entradas inválidas', () => {
    // Ante la duda, cobrar: equivocarse hacia "gratis" cuesta dinero en cada
    // pedido y nadie se entera hasta el corte.
    expect(calcularEnvio(NaN, COSTO)).toBe(COSTO)
    expect(calcularEnvio(-100, COSTO)).toBe(COSTO)
    expect(calcularEnvio(undefined as any, COSTO)).toBe(COSTO)
  })

  it('nunca devuelve un cobro negativo ni fraccionario raro', () => {
    const r = calcularEnvio(100, 99.6)
    expect(r).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(r)).toBe(true)
  })
})
