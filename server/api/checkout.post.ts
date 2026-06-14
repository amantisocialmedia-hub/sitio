// POST /api/checkout
// Crea una preferencia de pago en Mercado Pago y devuelve el init_point.
// Requiere la env NUXT_MP_ACCESS_TOKEN (token de la cuenta de AMANTI, sandbox o produccion).
import { defineEventHandler, readBody, createError } from 'h3'

interface CartItem { name: string; price: number; quantity: number; slug?: string }

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = config.mpAccessToken

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'MP token missing',
      message: 'Falta configurar el token de MercadoPago (NUXT_MP_ACCESS_TOKEN).',
    })
  }

  const body = await readBody<{ items: CartItem[] }>(event)
  const items = body?.items ?? []
  if (!items.length) {
    throw createError({ statusCode: 400, message: 'El carrito está vacío.' })
  }

  const base = config.public.publicBaseUrl

  try {
    const pref = await $fetch<{ init_point: string; sandbox_init_point: string; id: string }>(
      'https://api.mercadopago.com/checkout/preferences',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: {
          items: items.map((i) => ({
            title: i.name,
            quantity: i.quantity,
            unit_price: i.price,
            currency_id: 'MXN',
          })),
          back_urls: {
            success: `${base}/carrito?status=success`,
            failure: `${base}/carrito?status=failure`,
            pending: `${base}/carrito?status=pending`,
          },
          auto_return: 'approved',
          statement_descriptor: 'AMANTI',
        },
      }
    )

    // En sandbox usa sandbox_init_point; en produccion, init_point.
    return { init_point: pref.init_point || pref.sandbox_init_point, preferenceId: pref.id }
  } catch (e: any) {
    throw createError({
      statusCode: 502,
      message: e?.data?.message || 'No se pudo crear el pago en MercadoPago.',
    })
  }
})
