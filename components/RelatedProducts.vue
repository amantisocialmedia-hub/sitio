<script setup lang="ts">
import type { Product } from '~/composables/useProducts'

// Carrusel de productos relacionados (Eroteca). Reusa ProductCard y el carril `.rail`
// (scroll horizontal en móvil/desktop). No se renderiza si no hay productos.
const props = defineProps<{ products: Product[]; title?: string }>()
const heading = computed(() => props.title || 'Productos para ti')
</script>

<template>
  <section v-if="products.length" class="section related-products">
    <div class="wrap">
      <div class="rp-head">
        <h2 class="rp-title">{{ heading }}</h2>
        <span class="rp-accent" aria-hidden="true"></span>
      </div>
      <div class="rail">
        <ProductCard v-for="(p, i) in products" :key="p.slug" :product="p" v-reveal :data-reveal-index="i" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.related-products { padding-top: 8px; }
.rp-head { text-align: center; margin-bottom: 26px; }
/* Título serif de marca con acento coral debajo. */
.rp-title { font-family: var(--fh); font-size: clamp(1.6rem, 3.4vw, 2.3rem); color: var(--purple); margin: 0; }
.rp-accent { display: block; width: 64px; height: 4px; border-radius: 999px; background: var(--pink); margin: 12px auto 0; }
</style>
