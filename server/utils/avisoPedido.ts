/**
 * Aviso de pedido nuevo para quien surte.
 *
 * Nancy lo pidió textual el 27-ago-2026: «que me llegue por whats por favor».
 * Antes no había forma de enterarse de una venta salvo entrando a la base.
 *
 * COMO LLEGA: por el webhook de GoHighLevel, que es el único canal de WhatsApp
 * que el proyecto ya tiene conectado y funcionando. Del lado de GHL, César
 * arma un workflow que reciba este evento y mande el mensaje a Nancy — aquí
 * solo se emite el aviso con todo lo que ella necesita para surtir.
 *
 * NO se manda desde aquí con la API de WhatsApp directamente: eso implicaría
 * credenciales nuevas y un canal más que mantener, cuando ya hay uno andando.
 *
 * Como todo lo que toca el camino del pago: si esto falla, el pedido YA quedó
 * cobrado y no se puede tumbar por un aviso que no salió.
 */
import { emitirEventoGhl, ghlConectado, type GhlEvento } from './ghl'

/** Nombre del evento en GHL. Debe coincidir con el workflow que arme César. */
const EVENTO_AVISO = 'pedido_para_surtir' as GhlEvento

export interface DatosAviso {
  pedidoId: string
  total: number
  items: { nombre: string; cantidad: number }[]
  envio: {
    email?: string
    recipient?: string
    phone?: string
    line1?: string
    colonia?: string
    line2?: string
    city?: string
    state?: string
    postal_code?: string
  } | null
  esRegalo?: boolean
}

/**
 * Arma la dirección en una sola cadena, ya lista para pegar en una guía.
 *
 * Se manda formateada y no en campos sueltos porque el destino es un mensaje de
 * WhatsApp: Nancy necesita poder copiarla de un jalón, no armarla a mano.
 */
export function direccionParaGuia(envio: DatosAviso['envio']): string {
  if (!envio?.line1) return ''
  return [
    envio.recipient,
    envio.phone,
    envio.line1,
    envio.colonia,
    envio.line2,
    [envio.city, envio.state].filter(Boolean).join(', '),
    envio.postal_code ? `C.P. ${envio.postal_code}` : '',
  ].filter(Boolean).join(' · ')
}

/** El texto tal cual le va a llegar a Nancy. Corto: se lee en el teléfono. */
export function textoAviso(d: DatosAviso): string {
  const arts = d.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(', ')
  const dir = direccionParaGuia(d.envio)
  return [
    `Pedido nuevo · $${Number(d.total || 0).toLocaleString('es-MX')}`,
    arts,
    d.esRegalo ? '🎁 Es regalo (caja neutra, sin precios)' : '',
    dir ? `Enviar a: ${dir}` : '⚠️ SIN DIRECCIÓN — hay que pedírsela al cliente',
    `Detalle: https://amanti.mx/pedidos`,
  ].filter(Boolean).join('\n')
}

/**
 * Emite el aviso. No espera respuesta y nunca lanza: va enganchado al webhook
 * de pago y un aviso que falla no puede tumbar el registro de una venta.
 */
export function avisarPedidoParaSurtir(d: DatosAviso): void {
  if (!ghlConectado(EVENTO_AVISO)) return
  void emitirEventoGhl(EVENTO_AVISO, {
    pedido_id: d.pedidoId,
    total: d.total,
    articulos: d.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(', '),
    direccion: direccionParaGuia(d.envio),
    sin_direccion: !d.envio?.line1,
    es_regalo: !!d.esRegalo,
    telefono: d.envio?.phone ?? null,
    // Para poder contactar al cliente si el paquete rebota o falta un dato.
    email: d.envio?.email ?? null,
    mensaje: textoAviso(d),
    url_pedidos: 'https://amanti.mx/pedidos',
  }).catch(() => false)
}
