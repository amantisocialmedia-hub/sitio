<script setup lang="ts">
// Canonical por-ruta: usa route.path (sin query) para consolidar las variantes
// filtradas de /tienda (?cat=/&sale=/&q=) sobre la URL limpia.
const route = useRoute()
const config = useRuntimeConfig()
const ogImage = `${config.public.siteUrl}/og-cover.png`
useHead(() => ({
  link: [{ rel: 'canonical', href: config.public.siteUrl + route.path }],
  // Imagen OG/Twitter por defecto (URL absoluta desde siteUrl). Home y PDP la sobreescriben vía useSeoMeta.
  meta: [
    { property: 'og:image', content: ogImage },
    { name: 'twitter:image', content: ogImage },
  ],
}))
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
