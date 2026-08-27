import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// useRuntimeConfig es un auto-import de Nuxt; lo stubeamos para el entorno de test.
vi.stubGlobal('useRuntimeConfig', () => ({ public: { whatsappPhone: '5214431112233' } }))

import { useCartStore, FREE_SHIPPING_THRESHOLD } from '~/stores/cart'

const P = (over = {}) => ({ slug: 'vibrating-g', name: 'Vibrating G', price: 1013, emoji: '🪐', bg: '#fff', ...over })

describe('cart store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('agrega un item', () => {
    const c = useCartStore()
    c.addItem(P())
    expect(c.items.length).toBe(1)
    expect(c.totalItems).toBe(1)
  })

  it('suma cantidades del mismo producto en vez de duplicar', () => {
    const c = useCartStore()
    c.addItem(P(), 2)
    c.addItem(P(), 3)
    expect(c.items.length).toBe(1)
    expect(c.items[0].quantity).toBe(5)
    expect(c.totalItems).toBe(5)
  })

  it('quita un item', () => {
    const c = useCartStore()
    c.addItem(P())
    c.addItem(P({ slug: 'denzel', name: 'Denzel', price: 400 }))
    c.removeItem('vibrating-g')
    expect(c.items.length).toBe(1)
    expect(c.items[0].slug).toBe('denzel')
  })

  it('updateQuantity a 0 elimina el item', () => {
    const c = useCartStore()
    c.addItem(P())
    c.updateQuantity('vibrating-g', 0)
    expect(c.isEmpty).toBe(true)
  })

  it('updateQuantity coacciona a entero y elimina con valores no finitos / <=0', () => {
    const c = useCartStore()
    c.addItem(P())
    c.updateQuantity('vibrating-g', 3.9)        // floor -> 3
    expect(c.items[0].quantity).toBe(3)
    c.updateQuantity('vibrating-g', Number.NaN)  // no finito -> elimina
    expect(c.isEmpty).toBe(true)
  })

  it('totalItems y totalPrice', () => {
    const c = useCartStore()
    c.addItem(P({ price: 1000 }), 2)            // 2000
    c.addItem(P({ slug: 'a', name: 'A', price: 250 }), 4) // 1000
    expect(c.totalItems).toBe(6)
    expect(c.totalPrice).toBe(3000)
  })

  describe('envío gratis (umbral $1,000)', () => {
    it('el umbral es 1000', () => {
      expect(FREE_SHIPPING_THRESHOLD).toBe(1000)
    })

    it('NO aplica con subtotal por debajo del umbral (caso del bug: $818)', () => {
      const c = useCartStore()
      c.addItem(P({ price: 818 }))
      expect(c.totalPrice).toBe(818)
      expect(c.freeShipping).toBe(false)
      expect(c.freeShippingRemaining).toBe(182)
    })

    it('NO aplica justo por debajo del umbral ($999)', () => {
      const c = useCartStore()
      c.addItem(P({ price: 999 }))
      expect(c.freeShipping).toBe(false)
      expect(c.freeShippingRemaining).toBe(1)
    })

    it('aplica con subtotal exactamente igual al umbral ($1,000) — comparador >=', () => {
      const c = useCartStore()
      c.addItem(P({ price: 1000 }))
      expect(c.freeShipping).toBe(true)
      expect(c.freeShippingRemaining).toBe(0)
    })

    it('aplica con subtotal por encima del umbral', () => {
      const c = useCartStore()
      c.addItem(P({ price: 1500 }))
      expect(c.freeShipping).toBe(true)
      expect(c.freeShippingRemaining).toBe(0)
    })

    it('decide por el SUBTOTAL, no por el número de artículos', () => {
      const c = useCartStore()
      // 5 artículos baratos: muchos ítems pero subtotal por debajo del umbral.
      c.addItem(P({ price: 100 }), 5) // subtotal 500, 5 ítems
      expect(c.totalItems).toBe(5)
      expect(c.totalPrice).toBe(500)
      expect(c.freeShipping).toBe(false)
      // Un solo artículo caro: 1 ítem pero subtotal sobre el umbral → gratis.
      c.clearCart()
      c.addItem(P({ slug: 'caro', price: 1200 }), 1)
      expect(c.totalItems).toBe(1)
      expect(c.freeShipping).toBe(true)
    })
  })

  // El carrito y el servidor tienen que medir el umbral IGUAL. Hasta el
  // 27-ago-2026 el carrito lo mediía sobre el subtotal sin descuento y el
  // servidor (server/utils/costoEnvio.ts) sobre el subtotal con descuento: una
  // compra de $1,200 con cupón de $300 decía "Envío GRATIS" en pantalla y
  // Mercado Pago cobraba el envío de todos modos. El cliente veía un total y
  // pagaba otro.
  describe('envío gratis y cupones', () => {
    const CUPON = { code: 'PRUEBA', type: 'fixed' as const, value: 300, discount: 300 }

    it('el umbral se mide sobre lo que el cliente REALMENTE paga', () => {
      const c = useCartStore()
      c.addItem(P({ price: 1200 }))
      expect(c.freeShipping).toBe(true) // sin cupón sí califica
      c.applyCoupon(CUPON)
      expect(c.totalWithDiscount).toBe(900)
      expect(c.freeShipping).toBe(false) // paga $900: no califica
      expect(c.freeShippingRemaining).toBe(100)
    })

    it('quitar el cupón devuelve el envío gratis', () => {
      const c = useCartStore()
      c.addItem(P({ price: 1200 }))
      c.applyCoupon(CUPON)
      expect(c.freeShipping).toBe(false)
      c.removeCoupon()
      expect(c.freeShipping).toBe(true)
    })
  })

  it('whatsappOrderUrl arma el link con número, productos y total', () => {
    const c = useCartStore()
    c.addItem(P({ price: 1000 }), 2)
    const url = c.whatsappOrderUrl()
    expect(url.startsWith('https://wa.me/5214431112233?text=')).toBe(true)
    const text = decodeURIComponent(url.split('text=')[1])
    expect(text).toContain('Vibrating G x2')
    expect(text).toContain('Total: $2,000 MXN')
  })

  // El mensaje que le sale al cliente y el pedido que /api/order-whatsapp guarda
  // son la MISMA venta. Si el mensaje dijera $824 y en la pantalla de Nancy
  // apareciera $894, alguien acaba cobrando de menos.
  describe('whatsappOrderUrl con cobro de envío', () => {
    const conEnvio = (costo: number) =>
      vi.stubGlobal('useRuntimeConfig', () => ({
        public: { whatsappPhone: '5214431112233', envioCosto: costo },
      }))

    afterEach(() => {
      vi.stubGlobal('useRuntimeConfig', () => ({ public: { whatsappPhone: '5214431112233' } }))
    })

    it('desglosa el envío y suma el total bajo el umbral', () => {
      conEnvio(70)
      const c = useCartStore()
      c.addItem(P({ price: 412 }), 2) // subtotal 824
      const text = decodeURIComponent(c.whatsappOrderUrl().split('text=')[1])
      expect(text).toContain('Subtotal: $824 MXN')
      expect(text).toContain('Envío: $70 MXN')
      expect(text).toContain('Total: $894 MXN')
    })

    it('sobre el umbral no menciona envío y el total es el subtotal', () => {
      conEnvio(70)
      const c = useCartStore()
      c.addItem(P({ price: 1200 }))
      const text = decodeURIComponent(c.whatsappOrderUrl().split('text=')[1])
      expect(text).not.toContain('Envío:')
      expect(text).toContain('Total: $1,200 MXN')
    })

    it('con la variable sin poner el mensaje queda como antes', () => {
      const c = useCartStore()
      c.addItem(P({ price: 412 }), 2)
      const text = decodeURIComponent(c.whatsappOrderUrl().split('text=')[1])
      expect(text).not.toContain('Envío:')
      expect(text).toContain('Total: $824 MXN')
    })
  })

  it('whatsappOrderUrl arma el mensaje multilínea con subtotales por línea y total (es-MX)', () => {
    const c = useCartStore()
    c.addItem(P({ price: 1000 }), 2)                                  // 2,000
    c.addItem(P({ slug: 'denzel', name: 'Denzel', price: 600 }), 2)   // 1,200
    const url = c.whatsappOrderUrl()
    expect(url).not.toContain('\n')   // saltos codificados, no literales
    expect(url).toContain('%0A')
    const text = decodeURIComponent(url.split('text=')[1])
    expect(text).toContain('¡Hola AMANTI!')
    expect(text).toContain('• Vibrating G x2 — $2,000 MXN')
    expect(text).toContain('• Denzel x2 — $1,200 MXN')
    expect(text).toContain('Total: $3,200 MXN')
  })
})
