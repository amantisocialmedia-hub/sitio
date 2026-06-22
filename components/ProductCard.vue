<script setup lang="ts">
import type { Product } from '~/composables/useProducts'
const props = defineProps<{ product: Product; isNew?: boolean; priority?: boolean }>()
const cart = useCartStore()
const wishlist = useWishlistStore()
const stars = (r: number) => '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r)
const onSale = computed(() => props.product.compareAt && props.product.compareAt > props.product.price)

const justAdded = ref(false)
const popped = ref(false)

function add() {
  cart.addItem({
    slug: props.product.slug,
    name: props.product.name,
    price: props.product.price,
    emoji: props.product.emoji,
    bg: props.product.bg,
  })
  justAdded.value = true
  setTimeout(() => (justAdded.value = false), 1200)
  if (import.meta.client) window.dispatchEvent(new CustomEvent('cart:add'))
}
function toggleWish() {
  wishlist.toggle(props.product.slug)
  popped.value = true
  setTimeout(() => (popped.value = false), 350)
}
</script>

<template>
  <div class="pcard">
    <NuxtLink :to="`/tienda/${product.slug}`" class="pthumb" :style="{ background: product.bg }">
      <template v-if="product.images?.length">
        <NuxtImg :src="product.images[0]" :alt="product.name" class="pimg"
                 format="webp" width="400" height="400" sizes="(max-width:560px) 50vw, 240px"
                 :loading="priority ? 'eager' : 'lazy'" :fetchpriority="priority ? 'high' : 'auto'"
                 :preload="priority || undefined" />
        <!-- Segunda foto: aparece con crossfade al pasar el mouse (como PlatanoMelón/Cake) -->
        <NuxtImg v-if="product.images.length > 1" :src="product.images[1]" :alt="product.name" class="pimg pimg2"
                 format="webp" width="400" height="400" sizes="(max-width:560px) 50vw, 240px" loading="lazy" />
      </template>
      <span v-else class="d">{{ product.emoji }}</span>
      <span v-if="onSale" class="pbadge">rebaja</span>
      <span v-else-if="isNew" class="pbadge" style="background:var(--cyan)">nuevo</span>
    </NuxtLink>
    <!-- ClientOnly: la wishlist solo existe en el cliente (localStorage); evita el parpadeo ♡→♥ -->
    <ClientOnly>
      <button class="pwish" :class="{ liked: wishlist.has(product.slug), pop: popped }" @click="toggleWish" :aria-label="wishlist.has(product.slug) ? 'Quitar de favoritos' : 'Agregar a favoritos'">{{ wishlist.has(product.slug) ? '♥' : '♡' }}</button>
      <template #fallback><button class="pwish" aria-label="Agregar a favoritos">♡</button></template>
    </ClientOnly>
    <div class="pbody">
      <div class="pbrand">{{ product.brand }}</div>
      <h3><NuxtLink :to="`/tienda/${product.slug}`">{{ product.name }}</NuxtLink></h3>
      <div class="stars">{{ stars(product.rating) }}</div>
      <div class="prices">
        <span v-if="onSale" class="was">{{ peso(product.compareAt) }}</span>
        <span class="now" :class="{ red: onSale }">{{ peso(product.price) }}</span>
      </div>
      <button class="btn magenta addmini" :class="{ added: justAdded }" @click="add">{{ justAdded ? '✓ Añadido' : 'Añadir 🛍️' }}</button>
    </div>
  </div>
</template>
