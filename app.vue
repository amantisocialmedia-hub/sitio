<script setup lang="ts">
// Canonical por-ruta: usa route.path (sin query) para consolidar las variantes
// filtradas de /tienda (?cat=/&sale=/&q=) sobre la URL limpia.
const route = useRoute()
const config = useRuntimeConfig()
useHead(() => ({
  link: [{ rel: 'canonical', href: config.public.siteUrl + route.path }],
}))
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
