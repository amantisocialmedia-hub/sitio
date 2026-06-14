import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// useRuntimeConfig es un auto-import de Nuxt; lo stubeamos para el entorno de test.
vi.stubGlobal('useRuntimeConfig', () => ({ public: { whatsappPhone: '5214431112233' } }))

import { useCartStore } from '~/stores/cart'

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

  it('totalItems y totalPrice', () => {
    const c = useCartStore()
    c.addItem(P({ price: 1000 }), 2)            // 2000
    c.addItem(P({ slug: 'a', name: 'A', price: 250 }), 4) // 1000
    expect(c.totalItems).toBe(6)
    expect(c.totalPrice).toBe(3000)
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
})
