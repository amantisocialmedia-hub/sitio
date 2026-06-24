<script setup lang="ts">
import { FREE_SHIPPING_THRESHOLD } from '~/stores/cart'
const cart = useCartStore()
const { peso } = useProducts()
const { open, openCart, closeCart } = useCartUI()

// Umbral de envío gratis: fuente única en el store (mismo que /carrito).
const remaining = computed(() => cart.freeShippingRemaining)
const pct = computed(() => Math.min(100, (cart.totalPrice / FREE_SHIPPING_THRESHOLD) * 100))

function onAdd() { cart.refreshPrices?.(); openCart() }
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeCart() }

onMounted(() => {
  window.addEventListener('cart:add', onAdd)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('cart:add', onAdd)
  window.removeEventListener('keydown', onKey)
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
watch(open, (v) => { if (typeof document !== 'undefined') document.body.style.overflow = v ? 'hidden' : '' })
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition name="cdrawer">
        <div v-if="open" class="cdrawer-wrap" role="dialog" aria-modal="true" aria-label="Tu carrito">
          <div class="cdrawer-bg" @click="closeCart"></div>
          <aside class="cdrawer">
            <header class="cd-head">
              <h3>Tu carrito <span v-if="cart.totalItems">({{ cart.totalItems }})</span></h3>
              <button class="cd-x" @click="closeCart" aria-label="Cerrar">✕</button>
            </header>

            <div class="cd-ship">
              <p v-if="remaining > 0">Te faltan <b>{{ peso(remaining) }}</b> para <b>envío gratis</b> 🚚</p>
              <p v-else>¡Listo! Tienes <b>envío gratis</b> 💜</p>
              <div class="cd-track"><div class="cd-fill" :style="{ width: pct + '%' }"></div></div>
            </div>

            <div v-if="cart.isEmpty" class="cd-empty">
              <div class="e">🛒</div>
              <p>Tu carrito está vacío.</p>
              <NuxtLink to="/tienda" class="btn" @click="closeCart">Ir a la tienda</NuxtLink>
            </div>

            <template v-else>
              <div class="cd-items">
                <TransitionGroup name="cdrow">
                  <div v-for="i in cart.items" :key="i.slug" class="cd-item">
                    <div class="cd-th" :style="{ background: i.bg }">{{ i.emoji }}</div>
                    <div class="cd-info">
                      <NuxtLink :to="`/tienda/${i.slug}`" class="cd-name" @click="closeCart">{{ i.name }}</NuxtLink>
                      <div class="cd-line">
                        <div class="cqty">
                          <button @click="cart.updateQuantity(i.slug, i.quantity - 1)" aria-label="Quitar uno">−</button>
                          <span>{{ i.quantity }}</span>
                          <button @click="cart.updateQuantity(i.slug, i.quantity + 1)" aria-label="Agregar uno">+</button>
                        </div>
                        <span class="cd-price">{{ peso(i.price * i.quantity) }}</span>
                      </div>
                    </div>
                    <button class="cd-rm" @click="cart.removeItem(i.slug)" aria-label="Quitar">✕</button>
                  </div>
                </TransitionGroup>
              </div>

              <footer class="cd-foot">
                <div class="cd-sub"><span>Subtotal</span><span>{{ peso(cart.totalPrice) }}</span></div>
                <NuxtLink to="/carrito" class="btn magenta block" @click="closeCart">Ir a pagar</NuxtLink>
                <button class="btn outline block" @click="closeCart">Seguir comprando</button>
              </footer>
            </template>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>
