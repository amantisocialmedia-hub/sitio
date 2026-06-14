<script setup lang="ts">
const cart = useCartStore()
const config = useRuntimeConfig()
const waUrl = `https://wa.me/${config.public.whatsappPhone}?text=${encodeURIComponent('¡Hola AMANTI! Tengo una duda 💜')}`
</script>

<template>
  <nav class="bottomnav">
    <NuxtLink to="/tienda?sale=1"><span class="bi">🏷️</span>Rebajas</NuxtLink>
    <NuxtLink to="/tienda"><span class="bi">🗂️</span>Categorías</NuxtLink>
    <NuxtLink to="/carrito"><span class="bi">🛒<span v-if="cart.totalItems" class="bc">{{ cart.totalItems }}</span></span>Carrito</NuxtLink>
    <a :href="waUrl" target="_blank" rel="noopener"><span class="bi">💬</span>WhatsApp</a>
  </nav>
</template>
