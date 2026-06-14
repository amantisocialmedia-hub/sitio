import piniaPersist from 'pinia-plugin-persistedstate'

// Carrito persistente (localStorage). Plugin .client => solo corre en el navegador.
export default defineNuxtPlugin((nuxtApp) => {
  ;(nuxtApp.$pinia as any).use(piniaPersist)
})
