<script setup lang="ts">
const cart = useCartStore()
const config = useRuntimeConfig()
const waUrl = `https://wa.me/${config.public.whatsappPhone}?text=${encodeURIComponent('¡Hola AMANTI! Tengo una duda 💜')}`

const cartBump = ref(false)
let ct: ReturnType<typeof setTimeout>
watch(() => cart.totalItems, () => { cartBump.value = true; clearTimeout(ct); ct = setTimeout(() => (cartBump.value = false), 320) })
</script>

<template>
  <nav class="bottomnav">
    <NuxtLink to="/"><span class="bi">🏠</span>Inicio</NuxtLink>
    <NuxtLink to="/tienda"><span class="bi">🗂️</span>Categorías</NuxtLink>
    <NuxtLink to="/carrito"><span class="bi">🛒<span v-if="cart.totalItems" class="bc" :class="{ bump: cartBump }">{{ cart.totalItems }}</span></span>Carrito</NuxtLink>
    <a :href="waUrl" target="_blank" rel="noopener"><span class="bi">💬</span>WhatsApp</a>
  </nav>
</template>
