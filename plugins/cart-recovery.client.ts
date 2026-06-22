// Captura del carrito abandonado: guarda un snapshot (correo + items) cuando el usuario
// tiene productos y una identidad (sesión o correo del welcome modal). Debounce de 4s +
// beacon al ocultar/abandonar la pestaña. Al vaciar el carrito (o tras comprar) lo marca
// como recuperado. Degrada con gracia (endpoint /api/cart-save no falla sin la tabla).
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  const cart = useCartStore()
  const user = useSupabaseUser()

  function email(): string | null {
    if (user.value?.email) return user.value.email
    try { return localStorage.getItem('amanti_email') } catch { return null }
  }
  const canSave = () => !!user.value || !!email()

  function payload() {
    return {
      email: email(),
      items: cart.items.map(i => ({ slug: i.slug, name: i.name, price: i.price, quantity: i.quantity })),
      total: cart.totalPrice,
    }
  }
  function save(immediate = false) {
    if (!canSave() || !cart.items.length) return
    if (immediate && navigator.sendBeacon) {
      try {
        navigator.sendBeacon('/api/cart-save', new Blob([JSON.stringify(payload())], { type: 'application/json' }))
        return
      } catch { /* cae a $fetch */ }
    }
    $fetch('/api/cart-save', { method: 'POST', body: payload() }).catch(() => {})
  }
  function markRecovered() {
    if (!canSave()) return
    $fetch('/api/cart-save', { method: 'POST', body: { email: email(), recovered: true } }).catch(() => {})
  }

  let t: ReturnType<typeof setTimeout> | null = null
  watch(
    () => (cart.items.length ? `${cart.totalItems}:${cart.totalPrice}` : ''),
    () => {
      if (t) clearTimeout(t)
      if (!cart.items.length) { markRecovered(); return }
      t = setTimeout(() => save(), 4000)
    },
  )

  const onHide = () => { if (cart.items.length) save(true) }
  window.addEventListener('pagehide', onHide)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') onHide() })
})
