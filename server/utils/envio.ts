/**
 * Dirección de envío del pedido.
 *
 * Vive aparte de `orders.ts` a propósito: ese archivo importa el runtime de
 * Nuxt (`#supabase/server`) y no se puede cargar desde un test. Esta regla
 * decide si un pedido se puede surtir o no, así que tiene que ser probable.
 *
 * Contexto de por qué existe: hasta el 27-ago-2026 el sitio solo guardaba
 * dirección si el cliente tenía cuenta Y la había dado de alta en su perfil.
 * Las compras de invitado —que son la mayoría— se cobraban con
 * `shipping_address` en null. Se detectó con los tres pedidos pagados de ese
 * día: los tres cobrados, ninguno con a dónde enviarse.
 */
export interface EnvioInfo {
  /**
   * Correo de quien compra. Va aqui y no aparte porque se pide en el mismo
   * formulario y se guarda con el pedido: es el unico modo de avisarle a un
   * invitado que su compra salió.
   */
  email?: string
  recipient?: string
  phone?: string
  line1?: string
  colonia?: string
  line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

/**
 * El correo, o undefined si no parece correo.
 *
 * Se valida en el servidor y no solo en el navegador porque este dato viaja al
 * `payer` de Mercado Pago: un correo mal formado hace que MP rechace la
 * preferencia entera y el cliente se queda sin poder pagar, que es exactamente
 * el problema que este campo vino a resolver.
 */
export function correoValido(v: any): string | undefined {
  const s = String(v ?? '').trim().slice(0, 200).toLowerCase()
  if (!s) return undefined
  // Deliberadamente laxa: algo@algo.algo. Validar correos "bien" es imposible y
  // rechazar uno bueno cuesta una venta.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : undefined
}

/**
 * Normaliza la dirección que llega del navegador.
 *
 * Cada campo se recorta a 200 caracteres: es una entrada pública y sin sesión,
 * y nadie necesita 10 KB en el nombre de una calle.
 *
 * Devuelve null si falta calle o código postal. Guardar media dirección es peor
 * que no guardar nada, porque parece que el pedido se puede enviar y no se
 * puede: el error aparecería hasta que alguien intenta surtirlo.
 */
export function normalizarEnvio(e: any): EnvioInfo | null {
  if (!e || typeof e !== 'object') return null
  const t = (v: any) => String(v ?? '').trim().slice(0, 200) || undefined
  const dir: EnvioInfo = {
    email: correoValido(e.email),
    recipient: t(e.recipient),
    phone: t(e.phone),
    line1: t(e.line1),
    colonia: t(e.colonia),
    line2: t(e.line2),
    city: t(e.city),
    state: t(e.state),
    postal_code: t(e.postal_code),
    country: t(e.country) || 'MX',
  }
  if (!dir.line1 || !dir.postal_code) return null
  return dir
}
