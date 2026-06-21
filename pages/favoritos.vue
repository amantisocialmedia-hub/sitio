<script setup lang="ts">
const wishlist = useWishlistStore()
const { getBySlug } = useProducts()
const items = computed(() =>
  wishlist.slugs.map(s => getBySlug(s)).filter((p): p is NonNullable<typeof p> => !!p)
)
useHead({ title: 'Mis favoritos — AMANTI' })
</script>

<template>
  <PageHeader title="Mis Favoritos" subtitle="Tus juguetes guardados para después." current="Favoritos" />
  <div class="wrap" style="padding:40px 22px">
    <!-- La wishlist solo existe en cliente (localStorage): ClientOnly evita hydration mismatch. -->
    <ClientOnly>
      <div v-if="items.length" class="grid">
        <ProductCard v-for="(p, i) in items" :key="p.slug" :product="p" v-reveal :data-reveal-index="i % 8" />
      </div>
      <div v-else class="emptybox beat">
        <div class="e">🤍</div>
        <h3>Aún no tienes favoritos</h3>
        <p style="opacity:.7;margin:8px 0 16px">Toca el corazón en cualquier producto para guardarlo aquí.</p>
        <NuxtLink to="/tienda" class="btn">Explorar la tienda</NuxtLink>
      </div>
      <template #fallback>
        <div class="emptybox"><div class="e">🤍</div><h3>Cargando tus favoritos…</h3></div>
      </template>
    </ClientOnly>
  </div>
</template>
