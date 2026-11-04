import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCartStore } from '~/stores/cart'
import { resolveItems } from '~/server/utils/orderItems'
import data from '~/data/products.json'
import { precioVigente } from '~/utils/campana'

vi.stubGlobal('useRuntimeConfig', () => ({ public: { whatsappPhone: '5214431112233' } }))
beforeEach(() => setActivePinia(createPinia()))
const unavailable = data.products.find(p => p.slug === 'conejo-travieso')!
const available = data.products.find(p => p.slug === 'tiny-teasers-nubby')!
const item = (p: typeof available) => ({ slug: p.slug, name: p.name, price: precioVigente(p.price), emoji: p.emoji, bg: p.bg, quantity: 1 })

describe('Conejo Travieso agotado', () => {
  it('conserva la ficha y bloquea añadir desde cualquier entrada al store', () => {
    expect(unavailable).toMatchObject({ name: 'Conejo Travieso', brand: 'Selopa', price: 918, agotado: true })
    expect(unavailable.images.length).toBe(5)
    const cart = useCartStore()
    expect(cart.addItem(item(unavailable))).toBe(false)
    expect(cart.isEmpty).toBe(true)
  })
  it('detecta carrito persistido y no permite aumentar agotados', () => {
    const cart = useCartStore()
    cart.items = [item(unavailable), item(available)]
    cart.refreshPrices()
    expect(cart.hasUnavailableItems).toBe(true)
    expect(cart.unavailableItems.map(p => p.slug)).toEqual(['conejo-travieso'])
    cart.updateQuantity(unavailable.slug, 2)
    expect(cart.items[0].quantity).toBe(1)
    expect(() => cart.whatsappOrderUrl()).toThrow(/agotados/)
  })
  it('retirar el agotado permite continuar y conserva descuento y envío', () => {
    const cart = useCartStore()
    cart.items = [item(unavailable), item(available)]
    cart.unavailableItems.forEach(p => cart.removeItem(p.slug))
    expect(cart.hasUnavailableItems).toBe(false)
    expect(cart.totalPrice).toBe(401)
    expect(cart.shippingCost).toBe(80)
    expect(cart.totalToPay).toBe(481)
    const url = decodeURIComponent(cart.whatsappOrderUrl())
    expect(url).toContain('481')
    expect(url).not.toContain('Conejo Travieso')
  })
  it('el servidor rechaza con 409 un carrito antiguo o manipulado', () => {
    try {
      resolveItems([{ slug: unavailable.slug, quantity: 1, price: 1 }])
      expect.fail('No debe aceptar productos agotados')
    } catch (error: any) {
      expect(error.statusCode).toBe(409)
      expect(error.message).toContain('Conejo Travieso')
    }
  })
  it('rechaza pedidos mixtos sin cobrar parcialmente', () => {
    expect(() => resolveItems([{ slug: available.slug, quantity: 1 }, { slug: unavailable.slug, quantity: 1 }])).toThrow(/se agotó/)
  })
  it('los productos disponibles siguen entrando al carrito y al pedido', () => {
    const cart = useCartStore()
    cart.addItem(item(available))
    expect(cart.totalItems).toBe(1)
    expect(resolveItems([{ slug: available.slug, quantity: 1 }])[0].unitPrice).toBe(401)
  })
})
