import piniaPersist from 'pinia-plugin-persistedstate'

// Persistencia de stores (carrito, wishlist) en localStorage. Plugin .client => solo en el navegador.
// El prefijo "0." lo hace correr PRIMERO entre los plugins de usuario (después del módulo de pinia,
// pero antes de cart-recovery / wishlist-sync, que instancian stores). Si un store se crea antes de
// este .use(), no persiste — por eso el orden importa.
export default defineNuxtPlugin((nuxtApp) => {
  ;(nuxtApp.$pinia as any).use(piniaPersist)
})
