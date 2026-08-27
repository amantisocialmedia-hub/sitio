// Datos del comprador en la preferencia de Mercado Pago.
//
// Esto no es un detalle de forma: SIN `payer.email`, MP pinta el checkout
// completo --tarjeta, mensualidades, todo-- pero el boton de pagar nunca se
// habilita. El cliente llega hasta el final y no puede cerrar la compra, sin
// mensaje de error que lo explique.
//
// Raul lo reporto el 26-ago-2026, dos veces, con tarjeta de prueba y con su
// Visa real: "Solo ingreso el tipo de pago pero no me deja pagar". Y es la
// explicacion de por que la conversion de compra de Google Ads llevaba en 0:
// no es que no disparara, es que nunca hubo una compra que la disparara.
//
// Se prueba la REGLA de resolucion del comprador, que es donde esta el riesgo.
import { describe, it, expect } from 'vitest'
import { correoValido } from '~/server/utils/envio'

/**
 * Misma regla que server/api/checkout.post.ts:
 * la sesion manda; si no hay, el correo del formulario de envio; si no hay
 * ninguno, undefined -- y entonces el checkout se detiene antes de mandar al
 * cliente a Mercado Pago, porque alla se toparia con un boton que no se habilita
 * y ningun mensaje que lo explique.
 */
function resolverComprador(
  emailSesion: string | null,
  body: { envio?: { email?: string; recipient?: string }; payer?: { email?: string; name?: string; surname?: string } },
) {
  const email = emailSesion || correoValido(body?.envio?.email) || correoValido(body?.payer?.email) || null
  if (!email) return undefined
  const nombre = String(body?.payer?.name || body?.envio?.recipient || '').trim().split(/\s+/)[0] || ''
  const apellido = String(body?.payer?.surname || '').trim()
  return { email, ...(nombre ? { name: nombre } : {}), ...(apellido ? { surname: apellido } : {}) }
}

describe('comprador en la preferencia de MP', () => {
  it('usa el correo de la sesión cuando el cliente entró con cuenta', () => {
    expect(resolverComprador('cliente@ejemplo.mx', {})).toEqual({ email: 'cliente@ejemplo.mx' })
  })

  it('la sesión gana sobre lo que mande el navegador', () => {
    // El navegador es manipulable; la sesión no. Si alguien edita el
    // formulario, el cobro sigue asociado a quien de verdad inició sesión.
    const r = resolverComprador('real@ejemplo.mx', { envio: { email: 'otro@ejemplo.mx' } })
    expect(r?.email).toBe('real@ejemplo.mx')
  })

  it('en compra de invitado usa el correo del formulario de envío', () => {
    // Este es EL caso que estaba roto: hasta el 27-ago-2026 el correo se leía de
    // localStorage, que ya nadie llenaba, así que ningún invitado podía pagar.
    const r = resolverComprador(null, { envio: { email: 'invitado@ejemplo.mx' } })
    expect(r?.email).toBe('invitado@ejemplo.mx')
  })

  it('limpia espacios y mayúsculas del correo', () => {
    // Un correo con espacios lo rechaza MP y el botón se queda muerto otra vez.
    expect(resolverComprador(null, { envio: { email: '  X@Y.mx  ' } })?.email).toBe('x@y.mx')
  })

  it('un correo mal escrito cuenta como no tener correo', () => {
    // Mejor detener el checkout aquí, donde el cliente puede corregirlo, que
    // mandarlo a una preferencia que MP va a rechazar.
    expect(resolverComprador(null, { envio: { email: 'nancy@amanti' } })).toBeUndefined()
    expect(resolverComprador(null, { envio: { email: 'sin arroba .mx' } })).toBeUndefined()
  })

  it('sin ningún correo devuelve undefined, no un objeto vacío', () => {
    // Mandar `payer: {}` a MP es peor que no mandarlo: lo rechaza.
    expect(resolverComprador(null, {})).toBeUndefined()
    expect(resolverComprador(null, { payer: {} })).toBeUndefined()
    expect(resolverComprador(null, { envio: { email: '   ' } })).toBeUndefined()
  })

  it('toma el nombre de quien recibe como nombre del pagador', () => {
    // Es la misma persona en la práctica, y con nombre MP pinta un checkout más
    // completo. Solo el primer nombre: el apellido va en su propio campo y MP
    // valida el formato de lo que recibe.
    const r = resolverComprador(null, { envio: { email: 'a@b.mx', recipient: 'Nancy Pérez Ortiz' } })
    expect(r).toEqual({ email: 'a@b.mx', name: 'Nancy' })
  })

  it('incluye nombre y apellido solo cuando vienen', () => {
    expect(resolverComprador(null, { payer: { email: 'a@b.mx', name: 'Ana' } }))
      .toEqual({ email: 'a@b.mx', name: 'Ana' })
    // Campos vacíos NO se mandan: MP valida el formato de lo que recibe.
    expect(resolverComprador(null, { payer: { email: 'a@b.mx', name: '', surname: '' } }))
      .toEqual({ email: 'a@b.mx' })
  })
})
