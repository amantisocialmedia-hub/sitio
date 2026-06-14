<script setup lang="ts">
const config = useRuntimeConfig()
const waUrl = `https://wa.me/${config.public.whatsappPhone}?text=${encodeURIComponent('¡Hola AMANTI! Quiero información 💜')}`
</script>

<template>
  <a class="wa-float" :href="waUrl" target="_blank" rel="noopener" aria-label="WhatsApp">💬</a>
</template>
