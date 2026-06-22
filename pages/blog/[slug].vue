<script setup lang="ts">
import data from '~/data/articles.json'
const route = useRoute()
const article = computed(() => data.articles.find(a => a.slug === route.params.slug))
const more = computed(() => data.articles.filter(a => a.slug !== route.params.slug).slice(0, 3))
const covers = ['#FFE8D9', '#FFE4D2', '#E2F5EF', '#FFF2CC', '#FFEAD9', '#FFE4D6']
useHead(() => ({ title: article.value ? `${article.value.title} — AMANTI` : 'Eroteca — AMANTI' }))
</script>

<template>
  <template v-if="article">
    <PageHeader :title="article.title" :subtitle="article.category" current="Eroteca" />
    <article class="prose">
      <div class="blogmeta" style="margin-bottom:18px">⏱ {{ article.readTime }} de lectura · {{ article.category }}</div>
      <p v-for="(par, i) in article.body" :key="i" :class="{ lead: i === 0 }">{{ par }}</p>
      <div class="note"><p>¿Tienes dudas? Escríbenos por WhatsApp y te orientamos sin juicios. 💜</p></div>
      <p><NuxtLink to="/blog">← Volver a la Eroteca</NuxtLink></p>
    </article>

    <section class="section" style="padding-top:0">
      <div class="wrap">
        <div class="sec-head"><h2>Sigue leyendo</h2></div>
        <div class="bloggrid">
          <NuxtLink v-for="(a, i) in more" :key="a.slug" :to="`/blog/${a.slug}`" class="blogcard" v-reveal :data-reveal-index="i">
            <div class="cover" :style="{ background: covers[i % covers.length] }"><span class="cv-emo">{{ a.emoji }}</span></div>
            <div class="bc-body">
              <div class="cat">{{ a.category }}</div>
              <h3>{{ a.title }}</h3>
              <p>{{ a.excerpt }}</p>
              <div class="blogmeta">⏱ {{ a.readTime }} de lectura</div>
            </div>
          </NuxtLink>
        </div>
      </div>
    </section>
  </template>

  <div v-else class="wrap">
    <div class="emptybox" style="margin:60px 0">
      <div class="e">📄</div>
      <h3>Artículo no encontrado</h3>
      <p style="opacity:.7;margin:8px 0 16px">Puede que ya no esté disponible.</p>
      <NuxtLink to="/blog" class="btn">Volver al blog</NuxtLink>
    </div>
  </div>
</template>
