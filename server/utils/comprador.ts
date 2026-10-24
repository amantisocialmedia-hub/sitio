// Quién paga: el correo y el nombre que se le entregan a la pasarela.
//
// POR QUE ESTO IMPORTA: sin `payer.email`, Mercado Pago pinta el checkout
// completo --tarjeta, mensualidades, todo-- pero el boton de pagar NUNCA se
// habilita. El cliente llega hasta el final y no puede cerrar la compra, sin
// mensaje de error. Raul lo reporto el 26-ago-2026 con dos tarjetas distintas:
// "Solo ingreso el tipo de pago pero no me deja pagar".
//
// Es tambien la explicacion de por que la conversion de compra de Google Ads
// llevaba en 0: no es que no disparara, es que nunca hubo una compra que la
// disparara.
//
// PayPal no exige el correo para cobrar, pero el sitio sí lo necesita: es el
// único modo de avisarle a un invitado que su compra salió (GoHighLevel). Por
// eso las dos pasarelas usan esta misma regla.
//
// De donde sale el correo, en orden: la sesion de Supabase si la hay, y si no
// el que el cliente escribio en el carrito (compra de invitado). Si no hay
// ninguno, undefined -- y el checkout se detiene ANTES de mandar al cliente a
// la pasarela, donde se toparia con una pared sin explicacion.
import type { H3Event } from 'h3'
import { serverSupabaseUser } from '#supabase/server'
import { correoValido } from './envio'

export interface Comprador { email: string; name?: string; surname?: string }

export async function datosDelComprador(event: H3Event, body: any): Promise<Comprador | undefined> {
  let email: string | null = null
  try {
    const u = (await serverSupabaseUser(event)) as any
    email = u?.email ?? null
  } catch { /* sin sesion: compra de invitado */ }

  // Sin sesion, el correo sale del formulario de envio. Antes se leia de
  // localStorage ('amanti_email'), pero ese dato lo escribia el modal de
  // bienvenida y ese modal se sustituyo por el formulario de GoHighLevel: la
  // llave quedo huerfana y para un invitado SIEMPRE era null. Lo reporto Raul
  // el 27-ago-2026: «me comentan que no pidio correo electronico solo la
  // direccion».
  email = email || correoValido(body?.envio?.email) || correoValido(body?.payer?.email) || null
  if (!email) return undefined

  // El nombre de quien recibe sirve tambien como nombre del pagador: es la
  // misma persona en la practica y la pasarela muestra el checkout mas completo.
  const nombre = String(body?.payer?.name || body?.envio?.recipient || '').trim().split(/\s+/)[0] || ''
  const apellido = String(body?.payer?.surname || '').trim()
  return {
    email,
    ...(nombre ? { name: nombre } : {}),
    ...(apellido ? { surname: apellido } : {}),
  }
}
