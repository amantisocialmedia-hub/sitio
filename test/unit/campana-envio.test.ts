import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import productsData from '~/data/products.json'
import { useCartStore } from '~/stores/cart'
import { priceBySlug } from '~/server/utils/orderItems'
import { armarPurchaseUnit } from '~/server/utils/paypal'
import { CAMPANA, precioVigente } from '~/utils/campana'

beforeEach(() => setActivePinia(createPinia()))
describe('20% general con envío vigente', () => {
  it('los 152 precios conservan lista y cobran 80% redondeado en cliente y servidor', () => {
    expect(CAMPANA.descuento).toBe(0.2)
    const cart = useCartStore()
    const products = productsData.products
    expect(products).toHaveLength(152)
    cart.items = products.map(p => ({slug:p.slug,name:p.name,price:Math.round(p.price * 0.6),quantity:1,emoji:'',bg:''}))
    cart.refreshPrices()
    products.forEach((p,i) => {
      const expected = Math.round(p.price * 0.8)
      expect(precioVigente(p.price)).toBe(expected)
      expect(priceBySlug[p.slug]).toBe(expected)
      expect(cart.items[i].price).toBe(expected)
    })
  })
  it.each([[1,970,80,1050],[2,1940,0,1940]])('cantidad %s: carrito anterior se actualiza y PayPal conserva envío', (quantity,subtotal,shipping,total) => {
    const p = productsData.products.find(p => p.price === 1213)!
    expect(p).toBeDefined()
    const cart = useCartStore()
    cart.items = [{slug:p.slug,name:p.name,price:728,quantity,emoji:'',bg:''}]
    cart.refreshPrices()
    expect(cart.totalPrice).toBe(subtotal)
    expect(cart.shippingCost).toBe(shipping)
    expect(cart.totalToPay).toBe(total)
    const unit = armarPurchaseUnit({
      id:'campaign-preview-test',items:[{name:p.name,unitPrice:priceBySlug[p.slug],quantity}],
      discount:0,shippingCost:shipping,total,shippingAddress:null,
    })
    expect(unit.amount.value).toBe(total.toFixed(2))
    expect(Number(unit.amount.breakdown.shipping?.value || 0)).toBe(shipping)
  })
})
