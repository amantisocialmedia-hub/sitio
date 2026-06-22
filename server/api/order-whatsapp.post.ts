// POST /api/order-whatsapp
// Registra un order 'pending' (payment_method 'whatsapp') + order_items ANTES de que el
// cliente abra el link de WhatsApp. user_id sólo si hay sesión; shipping_address = snapshot
// de la dirección predeterminada (vía el helper compartido). Server-side con service_role.
// El cliente degrada con gracia: si esto falla, igual abre WhatsApp.
import { defineEventHandler, readBody, createError } from 'h3'
import { createPendingOrder } from '../utils/orders'
import type { InCartItem } from '../utils/orderItems'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ items: InCartItem[]; gift?: { isGift?: boolean; recipient?: string; sender?: string; message?: string } }>(event)
  const items = body?.items ?? []
  if (!items.length) throw createError({ statusCode: 400, message: 'El carrito está vacío.' })
  const order = await createPendingOrder(event, items, 'whatsapp', body?.gift)
  return { ok: true, orderId: order.id }
})
