// Dirección de envío del pedido.
//
// El riesgo aquí no es visual, es operativo: hasta el 27-ago-2026 el sitio
// COBRABA sin dirección. Se verificó en los tres pedidos pagados de ese día,
// los tres con `shipping_address` en null. El cliente pagaba y Nancy no tenía
// a dónde mandar el paquete.
//
// Por eso se prueba en los dos sentidos: que una dirección incompleta NO se
// guarde como si sirviera, y que una completa conserve cada campo.
import { describe, it, expect } from 'vitest'
import { normalizarEnvio } from '~/server/utils/envio'

const completa = {
  recipient: 'Nancy Ramírez',
  phone: '4431234567',
  line1: 'Av. Camelinas 3020',
  colonia: 'Las Américas',
  line2: 'Depto 4B',
  city: 'Morelia',
  state: 'Michoacán',
  postal_code: '58270',
}

describe('normalizarEnvio', () => {
  it('conserva todos los campos de una dirección completa', () => {
    const r = normalizarEnvio(completa)
    expect(r).toMatchObject(completa)
    expect(r?.country).toBe('MX')
  })

  it('rechaza una dirección sin calle: no se puede entregar', () => {
    expect(normalizarEnvio({ ...completa, line1: '' })).toBeNull()
    expect(normalizarEnvio({ ...completa, line1: '   ' })).toBeNull()
  })

  it('rechaza una dirección sin código postal', () => {
    // Sin CP la paquetería no cotiza ni rutea.
    expect(normalizarEnvio({ ...completa, postal_code: '' })).toBeNull()
  })

  it('devuelve null con basura, en vez de un objeto a medias', () => {
    // Guardar media dirección es peor que no guardar nada: parece que sí se
    // puede enviar y no se puede.
    expect(normalizarEnvio(null)).toBeNull()
    expect(normalizarEnvio(undefined)).toBeNull()
    expect(normalizarEnvio('Av. Siempre Viva 742')).toBeNull()
    expect(normalizarEnvio({})).toBeNull()
  })

  it('limpia espacios alrededor de cada campo', () => {
    const r = normalizarEnvio({ ...completa, recipient: '  Nancy  ', postal_code: ' 58270 ' })
    expect(r?.recipient).toBe('Nancy')
    expect(r?.postal_code).toBe('58270')
  })

  it('recorta entradas absurdamente largas', () => {
    // Es una entrada pública y sin sesión: nadie necesita 10 KB en una calle.
    const r = normalizarEnvio({ ...completa, line1: 'x'.repeat(5000) })
    expect(r?.line1?.length).toBe(200)
  })

  it('deja fuera los campos opcionales vacíos en vez de guardarlos en blanco', () => {
    const r = normalizarEnvio({ ...completa, colonia: '', line2: '' })
    expect(r?.colonia).toBeUndefined()
    expect(r?.line2).toBeUndefined()
    // Pero lo obligatorio sigue ahí.
    expect(r?.line1).toBe(completa.line1)
  })

  it('asume México cuando no viene país', () => {
    expect(normalizarEnvio(completa)?.country).toBe('MX')
  })
})
