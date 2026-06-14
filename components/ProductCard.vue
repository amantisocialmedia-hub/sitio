<script setup lang="ts">
import type { Product } from '~/composables/useProducts'
const props = defineProps<{ product: Product; isNew?: boolean; priority?: boolean }>()
const cart = useCartStore()
const wishlist = useWishlistStore()
const stars = (r: number) => '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r)
const onSale = computed(() => props.product.compareAt && props.product.compareAt > props.product.price)

function add() {
  cart.addItem({
    slug: props.product.slug,
    name: props.product.name,
    price: props.product.price,
    emoji: props.product.emoji,
    bg: props.product.bg,
  })
}
</script>

<template>
  <div class="pcard">
    <NuxtLink :to="`/tienda/${product.slug}`" class="pthumb" :style="{ background: product.bg }">
      <NuxtImg v-if="product.images?.length" :src="product.images[0]" :alt="product.name" class="pimg"
               format="webp" width="400" height="400" sizes="(max-width:560px) 50vw, 240px"
               :loading="priority ? 'eager' : 'lazy'" :fetchpriority="priority ? 'high' : 'auto'"
               :preload="priority || undefined" />
      <span v-else class="d">{{ product.emoji }}</span>
      <span v-if="onSale" class="pbadge">rebaja</span>
      <span v-else-if="isNew" class="pbadge" style="background:var(--cyan)">nuevo</span>
    </NuxtLink>
    <button class="pwish" @click="wishlist.toggle(product.slug)" aria-label="Favorito">{{ wishlist.has(product.slug) ? '♥' : '♡' }}</button>
    <div class="pbody">
      <div class="pbrand">{{ product.brand }}</div>
      <h3><NuxtLink :to="`/tienda/${product.slug}`">{{ product.name }}</NuxtLink></h3>
      <div class="stars">{{ stars(product.rating) }}</div>
      <div class="prices">
        <span v-if="onSale" class="was">{{ peso(product.compareAt) }}</span>
        <span class="now" :class="{ red: onSale }">{{ peso(product.price) }}</span>
      </div>
      <button class="btn magenta addmini" @click="add">Añadir 🛍️</button>
    </div>
  </div>
</template>
