// Permiso para dejar reseña sin tener cuenta.
//
// Este es el candado que separa "el cliente que compró deja su reseña" de
// "cualquiera publica lo que quiera en las fichas de producto". El enlace del
// correo del día 10 lleva una firma de (pedido + producto) hecha con una llave
// que solo vive en el servidor.
//
// Se prueba en los dos sentidos, y el que importa es el segundo: que una firma
// inventada, prestada de otro producto o de otro pedido NO pase.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { firmarResena, verificarResena, urlResena, resenasInvitadoActivas } from '~/server/utils/resenaToken'

const PEDIDO = '8d483cb7-7840-46e4-9ca4-870fceec8247'
const OTRO_PEDIDO = '11111111-2222-3333-4444-555555555555'
const SLUG = 'tiny-teasers-nubby'

describe('permiso de reseña', () => {
  beforeEach(() => { process.env.NUXT_RESENA_SECRET = 'llave-de-prueba-no-es-la-real' })
  afterEach(() => { delete process.env.NUXT_RESENA_SECRET })

  it('una firma recién hecha se verifica', () => {
    const f = firmarResena(PEDIDO, SLUG)!
    expect(verificarResena(PEDIDO, SLUG, f)).toBe(true)
  })

  it('la misma entrada da siempre la misma firma', () => {
    // Tiene que serlo: el enlace se manda una vez y se abre días después.
    expect(firmarResena(PEDIDO, SLUG)).toBe(firmarResena(PEDIDO, SLUG))
  })

  it('la firma NO sirve para otro producto del mismo pedido', () => {
    // Si sirviera, quien compró una cosa podría reseñar todo el catálogo.
    const f = firmarResena(PEDIDO, SLUG)!
    expect(verificarResena(PEDIDO, 'otro-producto', f)).toBe(false)
  })

  it('la firma NO sirve para otro pedido', () => {
    const f = firmarResena(PEDIDO, SLUG)!
    expect(verificarResena(OTRO_PEDIDO, SLUG, f)).toBe(false)
  })

  it('rechaza firmas inventadas, vacías o de otro largo', () => {
    for (const mala of ['', '   ', 'abc', 'f'.repeat(32), 'f'.repeat(64), 'no-es-hex-pero-mide-32-caracteres']) {
      expect(verificarResena(PEDIDO, SLUG, mala)).toBe(false)
    }
  })

  it('acepta la firma en mayúsculas', () => {
    // Los clientes de correo a veces reescriben la URL. Que se caiga por eso
    // sería perder la reseña de alguien que sí compró.
    const f = firmarResena(PEDIDO, SLUG)!
    expect(verificarResena(PEDIDO, SLUG, f.toUpperCase())).toBe(true)
  })

  it('con otra llave la firma deja de valer', () => {
    const f = firmarResena(PEDIDO, SLUG)!
    process.env.NUXT_RESENA_SECRET = 'otra-llave'
    expect(verificarResena(PEDIDO, SLUG, f)).toBe(false)
  })

  it('el enlace lleva pedido, firma y el ancla de reseñas', () => {
    const u = urlResena('https://amanti.mx/', PEDIDO, SLUG)
    expect(u).toContain(`/tienda/${SLUG}`)
    expect(u).toContain(`pedido=${PEDIDO}`)
    expect(u).toContain(`firma=${firmarResena(PEDIDO, SLUG)}`)
    expect(u.endsWith('#resenas')).toBe(true)
    // Sin doble diagonal aunque la base venga con una al final.
    expect(u).not.toContain('mx//tienda')
  })
})

describe('sin llave configurada', () => {
  beforeEach(() => { delete process.env.NUXT_RESENA_SECRET })

  it('la función queda apagada', () => {
    expect(resenasInvitadoActivas()).toBe(false)
    expect(firmarResena(PEDIDO, SLUG)).toBeNull()
  })

  it('no acepta NINGUNA firma', () => {
    // Lo peligroso sería lo contrario: que sin llave todo pasara.
    expect(verificarResena(PEDIDO, SLUG, 'loquesea')).toBe(false)
    expect(verificarResena(PEDIDO, SLUG, '')).toBe(false)
  })

  it('el enlace sigue llevando a la ficha, nada más que sin permiso', () => {
    // El sitio se comporta como antes: quien tiene cuenta reseña igual.
    const u = urlResena('https://amanti.mx', PEDIDO, SLUG)
    expect(u).toBe(`https://amanti.mx/tienda/${SLUG}#resenas`)
  })
})
