<script setup lang="ts">
const config = useRuntimeConfig()
const link = (ref_ = '') =>
  `https://wa.me/${config.public.whatsappPhone}?text=${encodeURIComponent('¡Hola AMANTI! Quiero información 💜' + ref_)}`
// La referencia del clic de Ads solo existe en cliente; se agrega tras montar para no
// provocar un desajuste de hidratación en el href.
const waUrl = ref(link())
onMounted(() => { waUrl.value = link(waRef()) })
</script>

<template>
  <a class="wa-float" :href="waUrl" target="_blank" rel="noopener" aria-label="WhatsApp">💬</a>
</template>
