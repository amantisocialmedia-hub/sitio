<script setup lang="ts">
import data from '~/data/articles.json'
const articles = data.articles
const covers = ['#FFE8D9', '#FFE4D2', '#E2F5EF', '#FFF2CC', '#FFEAD9', '#FFE4D6']
useHead({ title: 'Blog Eroteca — AMANTI' })
</script>

<template>
  <PageHeader title="Eroteca" subtitle="Tips, salud sexual y placer sin tabúes. Aprende y disfruta mejor." current="Blog" />
  <div class="wrap" style="padding:40px 22px">
    <div class="bloggrid">
      <NuxtLink v-for="(a, i) in articles" :key="a.slug" :to="`/blog/${a.slug}`" class="blogcard">
        <div class="cover" :style="{ background: covers[i % covers.length] }">{{ a.emoji }}</div>
        <div class="bc-body">
          <div class="cat">{{ a.category }}</div>
          <h3>{{ a.title }}</h3>
          <p>{{ a.excerpt }}</p>
          <div class="blogmeta">⏱ {{ a.readTime }} de lectura</div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
