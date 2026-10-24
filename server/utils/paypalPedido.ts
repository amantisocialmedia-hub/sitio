// Cobrar una orden de PayPal y dejar el pedido de Supabase como corresponde.
//
// Lo usan dos caminos que pueden correr AL MISMO TIEMPO: el regreso del
// cliente a /api/paypal-return y el webhook CHECKOUT.ORDER.APPROVED. Los dos
// terminan igual porque la captura en PayPal es idempotente (mismo
// PayPal-Request-Id) y aplicarEstadoPedido solo deja ganar a uno.
import { aplicarEstadoPedido, type ResultadoEstado } from './pagoConfirmado'
import {
  capturarOrdenPaypal,
  estadoPedidoDesdeCaptura,
  type ConfigPaypal,
  type ResumenOrdenPaypal,
} from './paypal'

export type DestinoCliente = 'success' | 'pending' | 'failure'

export interface ResultadoCobro {
  resumen: ResumenOrdenPaypal
  /** null si no se tocó el pedido (sin estado nuevo, o id que no coincide). */
  resultado: ResultadoEstado | null
  /** A qué pantalla mandar al cliente. */
  destino: DestinoCliente
}

export function destinoDesdeEstado(estado: ResumenOrdenPaypal['estado']): DestinoCliente {
  if (estado === 'COMPLETED') return 'success'
  if (estado === 'PENDING') return 'pending'
  return 'failure'
}

export async function cobrarOrdenPaypal(
  cfg: ConfigPaypal,
  token: string,
  paypalOrderId: string,
  orderIdEsperado: string | null,
  etiqueta: string,
): Promise<ResultadoCobro> {
  const resumen = await capturarOrdenPaypal(cfg, token, paypalOrderId)

  // El pedido lo dice PayPal (custom_id de la captura), no la URL: la URL la
  // puede escribir cualquiera. Si los dos vienen y no coinciden, no se toca nada.
  if (orderIdEsperado && resumen.orderId && resumen.orderId !== orderIdEsperado) {
    console.error(`[${etiqueta}] la orden de PayPal ${paypalOrderId} es del pedido ${resumen.orderId}, no de ${orderIdEsperado}`)
    return { resumen, resultado: null, destino: 'failure' }
  }
  const orderId = resumen.orderId || orderIdEsperado
  const nuevo = estadoPedidoDesdeCaptura(resumen.estado)

  let resultado: ResultadoEstado | null = null
  if (orderId && nuevo) {
    resultado = await aplicarEstadoPedido({
      orderId,
      nuevo,
      columnasOpcionales: {
        paypal_order_id: paypalOrderId,
        ...(resumen.captureId ? { paypal_capture_id: resumen.captureId } : {}),
      },
      etiqueta,
    })
  }
  return { resumen, resultado, destino: destinoDesdeEstado(resumen.estado) }
}
