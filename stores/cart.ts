import { defineStore } from 'pinia'
import productsData from '~/data/products.json'
import { useAnalytics } from '~/composables/useAnalytics'

/** Umbral de envío gratis (MXN). Fuente única de verdad para carrito, drawer y textos.
 *  El envío gratis aplica con SUBTOTAL (no número de artículos) >= este monto. */
export const FREE_SHIPPING_THRESHOLD = 1000

const round2 = (n: number) => Math.round(n * 100) / 100

/** Cupón aplicado en el carrito (solo previsualización). El descuento REAL lo recalcula y
 *  valida el servidor al crear el pedido. Se limpia ante cualquier cambio del carrito, así que
 *  el `discount` guardado siempre corresponde al subtotal vigente. */
export interface AppliedCoupon {
  code: string
  type: 'percent' | 'fixed'
  value: number
  discount: number
}

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
    coupon: null as AppliedCoupon | null,
  }),

  getters: {
    totalItems: (state) => state.items.reduce((s, i) => s + i.quantity, 0),
    totalPrice: (state) => state.items.reduce((s, i) => s + i.price * i.quantity, 0),
    isEmpty: (state) => state.items.length === 0,
    // Envío gratis: SOLO cuando el SUBTOTAL (no el número de artículos) alcanza el umbral.
    // Comparación >= : con subtotal exactamente igual al umbral, ya es gratis.
    freeShipping(): boolean {
      return this.totalPrice >= FREE_SHIPPING_THRESHOLD
    },
    // Cuánto falta para alcanzar el envío gratis (0 si ya califica).
    freeShippingRemaining(): number {
      return Math.max(0, FREE_SHIPPING_THRESHOLD - this.totalPrice)
    },
    // Descuento del cupón validado por el servidor (acotado al subtotal vigente por seguridad).
    // Solo previsualización; el servidor recalcula y es la autoridad al cobrar.
    discount(): number {
      if (!this.coupon) return 0
      return Math.min(round2(this.coupon.discount), this.totalPrice)
    },
    // Total a pagar = subtotal − descuento (nunca negativo).
    totalWithDiscount(): number {
      return Math.max(0, round2(this.totalPrice - this.discount))
    },
  },

  actions: {
    addItem(item: Omit<CartItem, 'quantity'>, quantity = 1) {
      const existing = this.items.find(i => i.slug === item.slug)
      if (existing) existing.quantity += quantity
      else this.items.push({ ...item, quantity })
      this.coupon = null // cambió el carrito → re-aplica el cupón (evita descuentos obsoletos)
      useAnalytics().addToCart({ slug: item.slug, name: item.name, price: item.price, quantity })
    },
    removeItem(slug: string) {
      this.items = this.items.filter(i => i.slug !== slug)
      this.coupon = null
    },
    updateQuantity(slug: string, quantity: number) {
      const it = this.items.find(i => i.slug === slug)
      if (!it) return
      // Coacciona a entero; valores no finitos o <= 0 eliminan la línea.
      const q = Math.floor(Number(quantity))
      if (!Number.isFinite(q) || q <= 0) this.removeItem(slug)
      else it.quantity = q
      this.coupon = null
    },
    clearCart() {
      this.items = []
      this.gift = { isGift: false, recipient: '', sender: '', message: '' }
      this.coupon = null
    },

    /** Guarda el cupón validado por el servidor (code/type/value/discount). */
    applyCoupon(c: AppliedCoupon) {
      this.coupon = { code: c.code, type: c.type, value: c.value, discount: round2(c.discount) }
    },
    removeCoupon() {
      this.coupon = null
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
      if (this.coupon && this.discount > 0) {
        msg += `\nSubtotal: $${this.totalPrice.toLocaleString('es-MX')} MXN`
        msg += `\nCupón ${this.coupon.code}: −$${this.discount.toLocaleString('es-MX')} MXN`
        msg += `\nTotal: $${this.totalWithDiscount.toLocaleString('es-MX')} MXN\n`
      } else {
        msg += `\nTotal: $${this.totalPrice.toLocaleString('es-MX')} MXN\n`
      }
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

  // Persistimos solo items y gift. El cupón NO se persiste: se re-aplica (y re-valida) cada
  // sesión, así nunca queda un descuento obsoleto guardado en localStorage.
  persist: { paths: ['items', 'gift'] },
})
