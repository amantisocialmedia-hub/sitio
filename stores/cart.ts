import { defineStore } from 'pinia'

export interface CartItem {
  slug: string
  name: string
  price: number
  emoji: string
  bg: string
  quantity: number
}

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as CartItem[],
  }),

  getters: {
    totalItems: (state) => state.items.reduce((s, i) => s + i.quantity, 0),
    totalPrice: (state) => state.items.reduce((s, i) => s + i.price * i.quantity, 0),
    isEmpty: (state) => state.items.length === 0,
  },

  actions: {
    addItem(item: Omit<CartItem, 'quantity'>, quantity = 1) {
      const existing = this.items.find(i => i.slug === item.slug)
      if (existing) existing.quantity += quantity
      else this.items.push({ ...item, quantity })
      if (typeof window !== 'undefined' && (window as any).fbq) {
        ;(window as any).fbq('track', 'AddToCart', {
          content_name: item.name,
          value: item.price * quantity,
          currency: 'MXN',
        })
      }
    },
    removeItem(slug: string) {
      this.items = this.items.filter(i => i.slug !== slug)
    },
    updateQuantity(slug: string, quantity: number) {
      const it = this.items.find(i => i.slug === slug)
      if (!it) return
      if (quantity <= 0) this.removeItem(slug)
      else it.quantity = quantity
    },
    clearCart() {
      this.items = []
    },

    /** Arma el link wa.me con el pedido completo. El numero sale de runtimeConfig. */
    whatsappOrderUrl() {
      const config = useRuntimeConfig()
      const phone = config.public.whatsappPhone
      let msg = '¡Hola AMANTI! Me gustaría ordenar:\n\n'
      this.items.forEach(i => {
        msg += `• ${i.name} x${i.quantity} — $${(i.price * i.quantity).toLocaleString('es-MX')} MXN\n`
      })
      msg += `\nTotal: $${this.totalPrice.toLocaleString('es-MX')} MXN\n\n¿Me ayudan a completar mi pedido? 🙌`
      return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
    },
  },

  persist: true,
})
