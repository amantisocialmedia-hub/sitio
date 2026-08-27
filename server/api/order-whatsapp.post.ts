// POST /api/order-whatsapp
// Registra un order 'pending' (payment_method 'whatsapp') + order_items ANTES de que el
// cliente abra el link de WhatsApp. user_id sólo si hay sesión; shipping_address = snapshot
// de la dirección predeterminada (vía el helper compartido). Server-side con service_role.
// El cliente degrada con gracia: si esto falla, igual abre WhatsApp.
import { defineEventHandler, readBody, createError } from 'h3'
import { createPendingOrder } from '../utils/orders'
import type { EnvioInfo } from '../utils/envio'
import type { InCartItem } from '../utils/orderItems'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ items: InCartItem[]; gift?: { isGift?: boolean; recipient?: string; sender?: string; message?: string }; coupon?: string; envio?: EnvioInfo }>(event)
  const items = body?.items ?? []
  if (!items.length) throw createError({ statusCode: 400, message: 'El carrito está vacío.' })
  // El cupón se re-valida y el descuento se recalcula server-side dentro de createPendingOrder.
  // La direccion es OPCIONAL aqui, a diferencia del pago con tarjeta: quien ordena
  // por WhatsApp la va a dar en la conversacion. Pero si ya la escribio en el
  // carrito, se guarda: le ahorra a Nancy tener que pedirla otra vez.
  const order = await createPendingOrder(event, items, 'whatsapp', body?.gift, body?.coupon, body?.envio ?? null)
  return { ok: true, orderId: order.id, total: order.total, discount: order.discount, couponCode: order.couponCode }
})
