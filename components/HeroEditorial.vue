<script setup lang="ts">
import type { Product } from '~/composables/useProducts'
defineProps<{ product?: Product }>()
const { peso } = useProducts()
const stars = (r: number) => '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r)
</script>

<template>
  <section class="hero-ed">
    <div class="he-text">
      <span class="he-accent">Bienvenidx a AMANTI</span>
      <h1 class="he-title">
        <span v-reveal :data-reveal-index="0">El placer</span>
        <span v-reveal :data-reveal-index="1">es <em>tuyo</em>.</span>
        <span v-reveal :data-reveal-index="2">Explóralo sin pena.</span>
      </h1>
      <p class="he-sub" v-reveal :data-reveal-index="3">
        Juguetes y bienestar íntimo con entrega 100% discreta en todo México. Sin tabúes, sin juicios — a tu manera.
      </p>
      <div class="he-cta" v-reveal :data-reveal-index="4">
        <NuxtLink to="/tienda" class="btn">Explorar la tienda</NuxtLink>
        <NuxtLink to="/quiz" class="btn outline">✨ Encuentra tu match →</NuxtLink>
      </div>
    </div>

    <NuxtLink v-if="product" :to="`/tienda/${product.slug}`" class="he-spot" :style="{ '--spot': product.bg }">
      <span class="he-spot-tag">★ Lo más deseado</span>
      <NuxtImg
        v-if="product.images?.length"
        :src="product.images[0]"
        :alt="product.name"
        class="he-spot-img"
        format="webp"
        width="600"
        height="760"
        sizes="(max-width:860px) 64vw, 380px"
        loading="eager"
        fetchpriority="high"
        preload
      />
      <span v-else class="he-spot-emo">{{ product.emoji }}</span>
      <div class="he-spot-info">
        <span class="stars">{{ stars(product.rating) }}</span>
        <span class="he-spot-name">{{ product.name }}</span>
        <span class="he-spot-price">{{ peso(product.price) }}</span>
      </div>
    </NuxtLink>
  </section>
</template>
