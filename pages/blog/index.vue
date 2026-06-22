<script setup lang="ts">
import data from '~/data/articles.json'
const articles = data.articles
const covers = ['#FFE8D9', '#FFE4D2', '#E2F5EF', '#FFF2CC', '#FFEAD9', '#FFE4D6']
const { bestsellers } = useProducts()
const masVendido = bestsellers()

// Hub: filtro por categoría + artículo destacado + carril de productos.
const cats = ['Todo', ...Array.from(new Set(articles.map(a => a.category)))]
const activeCat = ref('Todo')
const featured = computed(() => articles[0])
const list = computed(() =>
  activeCat.value === 'Todo'
    ? articles.slice(1)
    : articles.filter(a => a.category === activeCat.value),
)
useHead({ title: 'Blog Eroteca — AMANTI' })
useSeoMeta({
  description: 'Eroteca de AMANTI: guías, salud sexual y tips de placer sin tabúes. Aprende y disfruta mejor.',
})
</script>

<template>
  <PageHeader title="Eroteca" subtitle="Tips, salud sexual y placer sin tabúes. Aprende y disfruta mejor." current="Blog" />
  <div class="wrap" style="padding:28px 22px 10px">
    <!-- chips de categoría -->
    <div class="chiprow">
      <button v-for="c in cats" :key="c" class="chip" :class="{ on: activeCat === c }" @click="activeCat = c">{{ c }}</button>
    </div>

    <!-- artículo destacado (solo en "Todo") -->
    <NuxtLink v-if="activeCat === 'Todo'" :to="`/blog/${featured.slug}`" class="blogfeat" v-reveal>
      <div class="bf-emo" :style="{ background: covers[0] }"><span>{{ featured.emoji }}</span></div>
      <div class="bf-body">
        <span class="bf-tag">★ Destacado · {{ featured.category }}</span>
        <h2>{{ featured.title }}</h2>
        <p>{{ featured.excerpt }}</p>
        <span class="bf-cta">Leer más →</span>
        <div class="blogmeta">⏱ {{ featured.readTime }} de lectura</div>
      </div>
    </NuxtLink>

    <!-- grid -->
    <div v-if="list.length" class="bloggrid">
      <NuxtLink v-for="(a, i) in list" :key="a.slug" :to="`/blog/${a.slug}`" class="blogcard" v-reveal :data-reveal-index="i % 3">
        <div class="cover" :style="{ background: covers[(i + 1) % covers.length] }"><span class="cv-emo">{{ a.emoji }}</span></div>
        <div class="bc-body">
          <div class="cat">{{ a.category }}</div>
          <h3>{{ a.title }}</h3>
          <p>{{ a.excerpt }}</p>
          <div class="blogmeta">⏱ {{ a.readTime }} de lectura</div>
        </div>
      </NuxtLink>
    </div>
    <p v-else class="rev-empty">Aún no hay artículos en esta categoría. ¡Pronto!</p>
  </div>

  <!-- del contenido a la compra -->
  <section class="section" style="padding-top:6px">
    <div class="wrap">
      <div class="sec-head" v-reveal><h2>Del placer a la práctica</h2><NuxtLink to="/tienda" class="link-all">Ver la tienda</NuxtLink></div>
      <div class="rail">
        <ProductCard v-for="(p, i) in masVendido" :key="p.slug" :product="p" v-reveal :data-reveal-index="i" />
      </div>
    </div>
  </section>
</template>
