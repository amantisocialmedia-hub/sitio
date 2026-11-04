import { describe, it, expect, vi, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCartStore } from '~/stores/cart'
import { resolveItems, computeTotal } from '~/server/utils/orderItems'
import { calcularEnvio } from '~/server/utils/costoEnvio'
import { crearOrdenPaypal } from '~/server/utils/paypal'

afterEach(() => vi.unstubAllGlobals())
describe('carrito → precios autoritativos → solicitud PayPal (sin red)', () => {
  it.each([[262,80],[999.99,80],[1000,0],[1000.01,0]])('subtotal %s: envío %s en el cuerpo HTTP', async (subtotal, shippingCost) => {
    setActivePinia(createPinia())
    const cart = useCartStore()
    cart.items = [{ slug: 'fixture', name: 'Producto', price: subtotal, quantity: 1, emoji: '', bg: '' }]
    const items = resolveItems([{ slug: 'fixture', price: 1, quantity: 1 }], {
      price: { fixture: subtotal }, name: { fixture: 'Producto' }, img: { fixture: null },
    })
    const serverSubtotal = computeTotal(items)
    const order = { id: 'test-order', items, discount: 0, shippingCost: calcularEnvio(serverSubtotal),
      total: serverSubtotal + calcularEnvio(serverSubtotal), shippingAddress: null }
    const fetchMock = vi.fn().mockResolvedValue({ id: 'PP-TEST', status: 'CREATED', links: [{ rel: 'payer-action', href: 'https://example.invalid/approve' }] })
    vi.stubGlobal('$fetch', fetchMock)
    await crearOrdenPaypal({ ambiente: 'sandbox', clientId: 'dummy', clientSecret: 'dummy', webhookId: '' }, 'dummy', {
      order, returnUrl: 'https://example.invalid/return', cancelUrl: 'https://example.invalid/cancel',
    })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api-m.sandbox.paypal.com/v2/checkout/orders')
    const amount = options.body.purchase_units[0].amount
    expect(amount.currency_code).toBe('MXN')
    expect(amount.value).toBe((subtotal + shippingCost).toFixed(2))
    expect(amount.breakdown.item_total.value).toBe(subtotal.toFixed(2))
    expect(amount.breakdown.shipping?.value).toBe(shippingCost ? '80.00' : undefined)
    expect(cart.shippingCost).toBe(order.shippingCost)
    expect(cart.totalToPay).toBe(order.total)
  })
  it('cupón que baja de 1200 a 900: cobra 80; carrito vacío no cobra', () => {
    setActivePinia(createPinia())
    const cart = useCartStore()
    expect(cart.shippingCost).toBe(0)
    expect(cart.totalToPay).toBe(0)
    cart.items = [{ slug: 'fixture', name: 'Producto', price: 1200, quantity: 1, emoji: '', bg: '' }]
    cart.applyCoupon({ code: 'TEST', type: 'fixed', value: 300, discount: 300 })
    expect(cart.freeShipping).toBe(false)
    expect(cart.freeShippingRemaining).toBe(100)
    expect(cart.shippingCost).toBe(calcularEnvio(900))
    expect(cart.totalToPay).toBe(980)
  })
})
