import { describe, it, expect, vi, afterEach } from 'vitest'
import { calcularEnvio, UMBRAL_ENVIO_GRATIS } from '~/server/utils/costoEnvio'

afterEach(() => vi.unstubAllEnvs())
describe('envío autorizado: $80 bajo $1,000', () => {
  it.each([[262,80],[999,80],[999.99,80],[1000,0],[1000.01,0],[1500,0]])('subtotal %s cobra %s', (subtotal, envio) => {
    expect(calcularEnvio(subtotal)).toBe(envio)
  })
  it('el umbral es inclusivo y no depende de las variables antiguas', () => {
    expect(UMBRAL_ENVIO_GRATIS).toBe(1000)
    for (const value of ['', '0', '70', '150', 'invalid']) {
      vi.stubEnv('NUXT_ENVIO_COSTO', value)
      vi.stubEnv('NUXT_PUBLIC_ENVIO_COSTO', value)
      expect(calcularEnvio(262)).toBe(80)
      expect(calcularEnvio(1000)).toBe(0)
    }
  })
  it('no concede envío gratuito con subtotal inválido', () => {
    expect(calcularEnvio(NaN)).toBe(80)
    expect(calcularEnvio(-1)).toBe(80)
  })
})
