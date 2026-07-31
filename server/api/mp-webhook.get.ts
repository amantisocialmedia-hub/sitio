// GET /api/mp-webhook — solo para la prueba de conectividad del panel de Mercado Pago.
//
// Al registrar la URL, MP la valida con un GET tipo IPN clásico
// (?topic=payment&id=123456) y marca la prueba como fallida si no recibe 2xx.
// El handler real vive en mp-webhook.post.ts, y por el sufijo .post.ts Nitro NO
// registra la ruta para GET: MP recibía 404 y no dejaba avanzar el registro.
//
// A PROPÓSITO esto no procesa nada. Un GET tiene que ser seguro e idempotente: si
// aquí actualizáramos pedidos, bastaría con que alguien abriera un enlace (o que un
// crawler lo siguiera) para disparar el flujo de pagos. Las notificaciones reales
// del evento "Pagos" llegan por POST y las atiende mp-webhook.post.ts.
import { defineEventHandler } from 'h3'

export default defineEventHandler(() => ({
  ok: true,
  handler: 'mp-webhook',
  note: 'Ping de validación. Las notificaciones reales se reciben por POST.',
}))
