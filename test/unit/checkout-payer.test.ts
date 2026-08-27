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

/**
 * Misma regla que server/api/checkout.post.ts:
 * la sesion manda; si no hay, el correo que dejo el invitado; si no hay
 * ninguno, undefined (MP lo pide en su pantalla: peor experiencia, pero no
 * bloquea la compra).
 */
function resolverComprador(
  emailSesion: string | null,
  body: { payer?: { email?: string; name?: string; surname?: string } },
) {
  const email = emailSesion || (body?.payer?.email ? String(body.payer.email).trim() : null)
  if (!email) return undefined
  const nombre = String(body?.payer?.name || '').trim()
  const apellido = String(body?.payer?.surname || '').trim()
  return { email, ...(nombre ? { name: nombre } : {}), ...(apellido ? { surname: apellido } : {}) }
}

describe('comprador en la preferencia de MP', () => {
  it('usa el correo de la sesión cuando el cliente entró con cuenta', () => {
    expect(resolverComprador('cliente@ejemplo.mx', {})).toEqual({ email: 'cliente@ejemplo.mx' })
  })

  it('la sesión gana sobre lo que mande el navegador', () => {
    // El navegador es manipulable; la sesión no. Si alguien edita el
    // localStorage, el cobro sigue asociado a quien de verdad inició sesión.
    const r = resolverComprador('real@ejemplo.mx', { payer: { email: 'otro@ejemplo.mx' } })
    expect(r?.email).toBe('real@ejemplo.mx')
  })

  it('en compra de invitado usa el correo que dejó el cliente', () => {
    const r = resolverComprador(null, { payer: { email: 'invitado@ejemplo.mx' } })
    expect(r?.email).toBe('invitado@ejemplo.mx')
  })

  it('limpia espacios alrededor del correo', () => {
    // Un correo con espacios lo rechaza MP y el botón se queda muerto otra vez.
    expect(resolverComprador(null, { payer: { email: '  x@y.mx  ' } })?.email).toBe('x@y.mx')
  })

  it('sin ningún correo devuelve undefined, no un objeto vacío', () => {
    // Mandar `payer: {}` a MP es peor que no mandarlo: lo rechaza.
    expect(resolverComprador(null, {})).toBeUndefined()
    expect(resolverComprador(null, { payer: {} })).toBeUndefined()
    expect(resolverComprador(null, { payer: { email: '   ' } })).toBeUndefined()
  })

  it('incluye nombre y apellido solo cuando vienen', () => {
    expect(resolverComprador(null, { payer: { email: 'a@b.mx', name: 'Ana' } }))
      .toEqual({ email: 'a@b.mx', name: 'Ana' })
    // Campos vacíos NO se mandan: MP valida el formato de lo que recibe.
    expect(resolverComprador(null, { payer: { email: 'a@b.mx', name: '', surname: '' } }))
      .toEqual({ email: 'a@b.mx' })
  })
})
