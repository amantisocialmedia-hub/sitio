<script setup lang="ts">
import data from '~/data/articles.json'
const route = useRoute()
const article = computed(() => data.articles.find(a => a.slug === route.params.slug))
const more = computed(() => data.articles.filter(a => a.slug !== route.params.slug).slice(0, 3))
useHead(() => ({ title: article.value ? `${article.value.title} — AMANTI` : 'Eroteca — AMANTI' }))
useSeoMeta({ description: () => article.value?.excerpt })
</script>

<template>
  <template v-if="article">
    <!-- hero editorial del artículo -->
    <section class="bloghero" :style="{ background: `linear-gradient(135deg, ${article.c1}, ${article.c2})` }">
      <span class="bh-emo" aria-hidden="true">{{ article.emoji }}</span>
      <div class="bloghero-in">
        <NuxtLink to="/blog" class="bh-eyebrow">Eroteca · {{ article.category }}</NuxtLink>
        <h1>{{ article.title }}</h1>
        <div class="bh-meta">⏱ {{ article.readTime }} de lectura</div>
      </div>
    </section>

    <article class="prose blogprose">
      <template v-for="(b, i) in article.body" :key="i">
        <h2 v-if="b.h2">{{ b.h2 }}</h2>
        <ul v-else-if="b.ul"><li v-for="(li, j) in b.ul" :key="j">{{ li }}</li></ul>
        <p v-else :class="{ lead: i === 0 }">{{ b.p }}</p>
      </template>
      <div class="note"><p>¿Tienes dudas? Escríbenos por WhatsApp y te orientamos sin juicios 💜. ¿Buscas tu match? <NuxtLink to="/quiz">Haz el quiz →</NuxtLink></p></div>
      <p><NuxtLink to="/blog">← Volver a la Eroteca</NuxtLink></p>
    </article>

    <section class="section" style="padding-top:0">
      <div class="wrap">
        <div class="sec-head"><h2>Sigue leyendo</h2></div>
        <div class="bloggrid">
          <NuxtLink v-for="(a, i) in more" :key="a.slug" :to="`/blog/${a.slug}`" class="blogcard" v-reveal :data-reveal-index="i">
            <div class="cover" :style="{ background: `linear-gradient(135deg, ${a.c1}, ${a.c2})` }">
              <span class="cv-tag">{{ a.category }}</span>
              <span class="cv-emo">{{ a.emoji }}</span>
            </div>
            <div class="bc-body">
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
