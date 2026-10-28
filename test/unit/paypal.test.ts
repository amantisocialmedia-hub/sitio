// Lo PURO de la integración con PayPal (server/utils/paypal.ts): montos,
// desglose, dirección, lectura de respuestas y mapeo de estados.
//
// Es dinero: si el desglose no cuadra al centavo PayPal rechaza la orden y el
// cliente no puede pagar; si el mapeo de estados se equivoca, un pedido queda
// pagado sin cobrar o cobrado sin marcar. Sin red ni secretos.
import { describe, it, expect } from 'vitest'
import {
  ambientePaypal,
  baseApiPaypal,
  centavos,
  montoTexto,
  direccionPaypal,
  armarPurchaseUnit,
  armarOrdenPaypal,
  urlAprobacion,
  detalleErrorPaypal,
  errorPorDireccion,
  resumirOrdenPaypal,
  estadoDeCaptura,
  estadoPedidoDesdeCaptura,
  accionDeEvento,
  capturaDeReembolso,
  resumirCapturaPaypal,
  leerConfigPaypal,
} from '~/server/utils/paypal'

const DIR = {
  email: 'ana@ejemplo.mx', recipient: 'Ana Pérez', phone: '4431112233', line1: 'Av. Madero 100',
  colonia: 'Centro', line2: 'Int. 4', city: 'Morelia', state: 'Michoacán', postal_code: '58000', country: 'MX',
}

const pedido = (extra: Partial<Parameters<typeof armarPurchaseUnit>[0]> = {}) => ({
  id: 'a1b2c3d4-0000-4000-8000-000000000000',
  total: 2242,
  items: [
    { name: 'Vibrating G', unitPrice: 921, quantity: 2 },
    { name: 'Denzel', unitPrice: 400, quantity: 1 },
  ],
  discount: 0,
  shippingCost: 0,
  shippingAddress: DIR,
  ...extra,
})

describe('ambiente', () => {
  it('respeta NUXT_PAYPAL_ENV', () => {
    expect(ambientePaypal('live', {})).toBe('live')
    expect(ambientePaypal(' LIVE ', {})).toBe('live')
    expect(ambientePaypal('sandbox', { VERCEL_ENV: 'production' })).toBe('sandbox')
  })
  it('sin valor: live solo en el deploy de producción de Vercel', () => {
    // Un sandbox en producción mandaría a los clientes a una pantalla de pruebas
    // donde su dinero no vale; un live en local cobraría de verdad al probar.
    expect(ambientePaypal('', { VERCEL_ENV: 'production' })).toBe('live')
    expect(ambientePaypal('', { VERCEL_ENV: 'preview' })).toBe('sandbox')
    expect(ambientePaypal(undefined, {})).toBe('sandbox')
  })
  it('cada ambiente tiene su host', () => {
    expect(baseApiPaypal('live')).toBe('https://api-m.paypal.com')
    expect(baseApiPaypal('sandbox')).toBe('https://api-m.sandbox.paypal.com')
  })
  it('leerConfigPaypal exige id y secreto', () => {
    expect(() => leerConfigPaypal({})).toThrow()
    expect(() => leerConfigPaypal({ paypalClientId: 'x' })).toThrow()
    const c = leerConfigPaypal({ paypalClientId: ' id ', paypalClientSecret: 'sec', paypalEnv: 'live', paypalWebhookId: 'WH' })
    expect(c).toEqual({ clientId: 'id', clientSecret: 'sec', ambiente: 'live', webhookId: 'WH' })
  })
})

describe('montos en centavos', () => {
  it('convierte sin errores de coma flotante', () => {
    expect(centavos(921)).toBe(92100)
    expect(centavos(0.1 + 0.2)).toBe(30)
    expect(montoTexto(92100)).toBe('921.00')
    expect(montoTexto(30)).toBe('0.30')
    expect(montoTexto(123457)).toBe('1234.57')
  })
})

describe('purchase_unit', () => {
  it('sin cupón ni envío: un renglón por producto y el total cuadra', () => {
    const u = armarPurchaseUnit(pedido())
    expect(u.custom_id).toBe('a1b2c3d4-0000-4000-8000-000000000000')
    expect(u.amount.value).toBe('2242.00')
    expect(u.amount.currency_code).toBe('MXN')
    expect(u.amount.breakdown.item_total.value).toBe('2242.00')
    expect(u.amount.breakdown.shipping).toBeUndefined()
    expect(u.amount.breakdown.discount).toBeUndefined()
    expect(u.items).toHaveLength(2)
    expect(u.items[0]).toEqual({ name: 'Vibrating G', quantity: '2', unit_amount: { currency_code: 'MXN', value: '921.00' }, category: 'PHYSICAL_GOODS' })
    expect(u.description).toBe('Pedido AMANTI #A1B2C3D4')
    expect(u.soft_descriptor).toBe('AMANTI')
  })

  it('el envío va como su propio renglón del desglose', () => {
    // Si se omite, las líneas suman solo el producto y se cobra de menos.
    const u = armarPurchaseUnit(pedido({ total: 470, items: [{ name: 'Denzel', unitPrice: 400, quantity: 1 }], shippingCost: 70 }))
    expect(u.amount.value).toBe('470.00')
    expect(u.amount.breakdown.item_total.value).toBe('400.00')
    expect(u.amount.breakdown.shipping.value).toBe('70.00')
  })

  it('con cupón, el descuento va en el desglose y el total ya lo trae restado', () => {
    const u = armarPurchaseUnit(pedido({ total: 410, items: [{ name: 'Denzel', unitPrice: 400, quantity: 1 }], shippingCost: 70, discount: 60 }))
    expect(u.amount.value).toBe('410.00')
    expect(u.amount.breakdown.item_total.value).toBe('400.00')
    expect(u.amount.breakdown.shipping.value).toBe('70.00')
    expect(u.amount.breakdown.discount.value).toBe('60.00')
    expect(u.items).toHaveLength(1)
  })

  it('si el desglose no cuadra al centavo manda solo el total, nunca una orden que PayPal rechace', () => {
    const u = armarPurchaseUnit(pedido({ total: 999 }))
    expect(u.amount.value).toBe('999.00')
    expect(u.amount.breakdown).toBeUndefined()
    expect(u.items).toBeUndefined()
  })

  it('recorta nombres largos a 127 y pone un nombre si falta', () => {
    const u = armarPurchaseUnit(pedido({ total: 1, items: [{ name: 'x'.repeat(300), unitPrice: 1, quantity: 1 }] }))
    expect(u.items[0].name).toHaveLength(127)
    const v = armarPurchaseUnit(pedido({ total: 1, items: [{ name: '   ', unitPrice: 1, quantity: 1 }] }))
    expect(v.items[0].name).toBe('Producto')
  })

  it('incluye la dirección del carrito, y se puede pedir sin ella', () => {
    const u = armarPurchaseUnit(pedido())
    expect(u.shipping.name.full_name).toBe('Ana Pérez')
    expect(u.shipping.address).toEqual({
      address_line_1: 'Av. Madero 100', address_line_2: 'Centro, Int. 4', admin_area_2: 'Morelia',
      admin_area_1: 'Michoacán', postal_code: '58000', country_code: 'MX',
    })
    expect(armarPurchaseUnit(pedido(), { conDireccion: false }).shipping).toBeUndefined()
    expect(armarPurchaseUnit(pedido({ shippingAddress: null })).shipping).toBeUndefined()
  })
})

describe('dirección', () => {
  it('sin calle o sin código postal no hay dirección', () => {
    expect(direccionPaypal({ ...DIR, line1: '' })).toBeUndefined()
    expect(direccionPaypal({ ...DIR, postal_code: '' })).toBeUndefined()
    expect(direccionPaypal(null)).toBeUndefined()
  })
  it('país raro cae a MX; sin nombre no manda name', () => {
    const d = direccionPaypal({ ...DIR, country: 'mexico', recipient: '' })!
    expect(d.address.country_code).toBe('MX')
    expect((d as any).name).toBeUndefined()
  })
})

describe('cuerpo de la orden', () => {
  const base = { order: pedido(), returnUrl: 'https://amanti.mx/api/paypal-return?order=x', cancelUrl: 'https://amanti.mx/carrito?status=failure' }

  it('es CAPTURE, con PAY_NOW, cobro inmediato y las URLs de regreso', () => {
    const o = armarOrdenPaypal(base)
    expect(o.intent).toBe('CAPTURE')
    const ctx = o.payment_source.paypal.experience_context
    expect(ctx.user_action).toBe('PAY_NOW')
    expect(ctx.payment_method_preference).toBe('IMMEDIATE_PAYMENT_REQUIRED')
    expect(ctx.return_url).toBe(base.returnUrl)
    expect(ctx.cancel_url).toBe(base.cancelUrl)
    expect(ctx.brand_name).toBe('AMANTI')
    expect(ctx.locale).toBe('es-MX')
  })

  it('abre el formulario de tarjeta sin pedir iniciar sesión en PayPal', () => {
    expect(armarOrdenPaypal(base).payment_source.paypal.experience_context.landing_page).toBe('GUEST_CHECKOUT')
  })

  it('con dirección la fija; sin dirección no pide ninguna', () => {
    expect(armarOrdenPaypal(base).payment_source.paypal.experience_context.shipping_preference).toBe('SET_PROVIDED_ADDRESS')
    expect(armarOrdenPaypal({ ...base, conDireccion: false }).payment_source.paypal.experience_context.shipping_preference).toBe('NO_SHIPPING')
  })

  it('lleva correo y nombre del comprador solo cuando vienen', () => {
    const con = armarOrdenPaypal({ ...base, comprador: { email: 'ana@ejemplo.mx', nombre: 'Ana', apellido: 'Pérez' } })
    expect((con.payment_source.paypal as any).email_address).toBe('ana@ejemplo.mx')
    expect((con.payment_source.paypal as any).name).toEqual({ given_name: 'Ana', surname: 'Pérez' })
    const sin = armarOrdenPaypal(base)
    expect((sin.payment_source.paypal as any).email_address).toBeUndefined()
    expect((sin.payment_source.paypal as any).name).toBeUndefined()
  })
})

describe('lectura de respuestas', () => {
  it('toma el enlace payer-action, o approve si no hay', () => {
    expect(urlAprobacion({ links: [{ rel: 'self', href: 'a' }, { rel: 'payer-action', href: 'https://pp/x' }] })).toBe('https://pp/x')
    expect(urlAprobacion({ links: [{ rel: 'approve', href: 'https://pp/y' }] })).toBe('https://pp/y')
    expect(urlAprobacion({ links: [] })).toBeNull()
    expect(urlAprobacion(null)).toBeNull()
  })

  it('aplana el error de PayPal y detecta cuando fue por la dirección', () => {
    const e = { response: { status: 422 }, data: { name: 'UNPROCESSABLE_ENTITY', message: 'The requested action could not be performed.', details: [{ issue: 'SHIPPING_ADDRESS_INVALID', description: 'Provided shipping address is invalid.' }] } }
    expect(detalleErrorPaypal(e)).toEqual({ status: 422, name: 'UNPROCESSABLE_ENTITY', issues: ['SHIPPING_ADDRESS_INVALID'], message: 'Provided shipping address is invalid.' })
    expect(errorPorDireccion(e)).toBe(true)
    expect(errorPorDireccion({ response: { status: 422 }, data: { details: [{ issue: 'INSTRUMENT_DECLINED' }] } })).toBe(false)
    expect(errorPorDireccion({ response: { status: 500 }, data: { details: [{ issue: 'SHIPPING_ADDRESS_INVALID' }] } })).toBe(false)
    expect(errorPorDireccion({ message: 'fetch failed' })).toBe(false)
  })

  it('resume una orden capturada: captura completada, custom_id y estado', () => {
    const r = resumirOrdenPaypal({
      id: 'PPO-1', status: 'COMPLETED',
      purchase_units: [{ custom_id: 'ped-1', payments: { captures: [
        { id: 'CAP-A', status: 'DECLINED', custom_id: 'ped-1' },
        { id: 'CAP-B', status: 'COMPLETED', custom_id: 'ped-1' },
      ] } }],
    })
    expect(r).toEqual({ paypalOrderId: 'PPO-1', status: 'COMPLETED', orderId: 'ped-1', captureId: 'CAP-B', estado: 'COMPLETED' })
  })

  it('una orden solo aprobada no tiene captura: estado OTRO y nadie la marca pagada', () => {
    const r = resumirOrdenPaypal({ id: 'PPO-2', status: 'APPROVED', purchase_units: [{ custom_id: 'ped-2' }] })
    expect(r.estado).toBe('OTRO')
    expect(r.orderId).toBe('ped-2')
    expect(r.captureId).toBeNull()
    expect(estadoPedidoDesdeCaptura(r.estado)).toBeNull()
  })

  it('resume una captura leída de la API (fuente de verdad del webhook)', () => {
    const c = resumirCapturaPaypal({ id: 'CAP-9', status: 'REFUNDED', custom_id: 'ped-9', supplementary_data: { related_ids: { order_id: 'PPO-9' } } })
    expect(c).toEqual({ captureId: 'CAP-9', estado: 'REFUNDED', orderId: 'ped-9', paypalOrderId: 'PPO-9' })
    expect(resumirCapturaPaypal({ id: 'CAP-0' }).orderId).toBeNull()
  })
})

describe('estados', () => {
  it('mapea el estado de la captura al del pedido, solo hacia donde hay certeza', () => {
    expect(estadoPedidoDesdeCaptura(estadoDeCaptura('COMPLETED'))).toBe('paid')
    expect(estadoPedidoDesdeCaptura(estadoDeCaptura('DECLINED'))).toBe('cancelled')
    expect(estadoPedidoDesdeCaptura(estadoDeCaptura('FAILED'))).toBe('cancelled')
    expect(estadoPedidoDesdeCaptura(estadoDeCaptura('REFUNDED'))).toBe('refunded')
    // Pendiente y reembolso parcial NO cambian nada: el pedido sigue como está.
    expect(estadoPedidoDesdeCaptura(estadoDeCaptura('PENDING'))).toBeNull()
    expect(estadoPedidoDesdeCaptura(estadoDeCaptura('PARTIALLY_REFUNDED'))).toBeNull()
    expect(estadoPedidoDesdeCaptura(estadoDeCaptura('lo-que-sea'))).toBeNull()
  })
})

describe('webhook', () => {
  it('decide qué hacer con cada evento', () => {
    expect(accionDeEvento('CHECKOUT.ORDER.APPROVED')).toBe('capturar')
    expect(accionDeEvento('PAYMENT.CAPTURE.COMPLETED')).toBe('captura')
    expect(accionDeEvento('PAYMENT.CAPTURE.DENIED')).toBe('captura')
    expect(accionDeEvento('PAYMENT.CAPTURE.REFUNDED')).toBe('reembolso')
    expect(accionDeEvento('BILLING.SUBSCRIPTION.CREATED')).toBeNull()
    expect(accionDeEvento(undefined)).toBeNull()
  })
  it('de un reembolso saca la captura por el enlace "up"', () => {
    expect(capturaDeReembolso({ links: [{ rel: 'self', href: 'https://api-m.paypal.com/v2/payments/refunds/R1' }, { rel: 'up', href: 'https://api-m.paypal.com/v2/payments/captures/CAP-7' }] })).toBe('CAP-7')
    expect(capturaDeReembolso({ links: [] })).toBeNull()
    expect(capturaDeReembolso(null)).toBeNull()
  })
})
