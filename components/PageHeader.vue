<script setup lang="ts">
defineProps<{ title: string; subtitle?: string; current?: string }>()
</script>

<template>
  <section class="pagehero">
    <div class="wrap">
      <div class="bc"><NuxtLink to="/">AMANTI</NuxtLink><span class="sep">›</span><span>{{ current || title }}</span></div>
      <h1 v-reveal>{{ title }}</h1>
      <p v-if="subtitle" v-reveal="{ i: 1 }">{{ subtitle }}</p>
    </div>
  </section>
</template>
