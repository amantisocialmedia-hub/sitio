import { defineStore } from 'pinia'
import productsData from '~/data/products.json'
import { useAnalytics } from '~/composables/useAnalytics'

// Precio vigente por slug (fuente de verdad = catálogo, igual que el server). Para que el
// carrito persistido en localStorage no muestre un precio obsoleto distinto al que se cobra.
const priceBySlug: Record<string, number> = Object.fromEntries(
  (productsData.products as { slug: string; price: number }[]).map((p) => [p.slug, p.price]),
)

export interface CartItem {
  slug: string
  name: string
  price: number
  emoji: string
  bg: string
  quantity: number
}

export interface GiftInfo {
  isGift: boolean
  recipient: string
  sender: string
  message: string
}

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as CartItem[],
    gift: { isGift: false, recipient: '', sender: '', message: '' } as GiftInfo,
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
      useAnalytics().addToCart({ slug: item.slug, name: item.name, price: item.price, quantity })
    },
    removeItem(slug: string) {
      this.items = this.items.filter(i => i.slug !== slug)
    },
    updateQuantity(slug: string, quantity: number) {
      const it = this.items.find(i => i.slug === slug)
      if (!it) return
      // Coacciona a entero; valores no finitos o <= 0 eliminan la línea.
      const q = Math.floor(Number(quantity))
      if (!Number.isFinite(q) || q <= 0) this.removeItem(slug)
      else it.quantity = q
    },
    clearCart() {
      this.items = []
      this.gift = { isGift: false, recipient: '', sender: '', message: '' }
    },

    /** Re-sincroniza el precio de cada línea con el catálogo vigente (lo que cobra el server).
     *  Se llama al abrir el carrito para que la UI y el mensaje de WhatsApp no muestren un
     *  precio obsoleto guardado en localStorage. Si el slug ya no existe, conserva el persistido. */
    refreshPrices() {
      this.items.forEach((i) => {
        const p = priceBySlug[i.slug]
        if (p != null) i.price = p
      })
    },

    /** Arma el link wa.me con el pedido completo. El numero sale de runtimeConfig. */
    whatsappOrderUrl() {
      const config = useRuntimeConfig()
      const phone = config.public.whatsappPhone
      let msg = '¡Hola AMANTI! Me gustaría ordenar:\n\n'
      this.items.forEach(i => {
        msg += `• ${i.name} x${i.quantity} — $${(i.price * i.quantity).toLocaleString('es-MX')} MXN\n`
      })
      msg += `\nTotal: $${this.totalPrice.toLocaleString('es-MX')} MXN\n`
      if (this.gift.isGift) {
        msg += `\n🎁 Es un regalo (caja neutra, sin precios)`
        if (this.gift.recipient) msg += `\nPara: ${this.gift.recipient}`
        if (this.gift.sender) msg += `\nDe: ${this.gift.sender}`
        if (this.gift.message) msg += `\nMensaje: "${this.gift.message}"`
        msg += `\n`
      }
      msg += `\n¿Me ayudan a completar mi pedido? 🙌`
      return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
    },
  },

  persist: true,
})
