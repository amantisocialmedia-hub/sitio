<script setup lang="ts">
import kitsData from '~/data/kits.json'
const kits = kitsData.kits
useHead({ title: 'Kits listos para disfrutar — AMANTI' })
useSeoMeta({
  description: 'Kits curados de AMANTI: sets listos para disfrutar — primera vez, parejas, para él y exploración. Todo en un clic, con envío 100% discreto.',
})
</script>

<template>
  <PageHeader title="Kits listos para disfrutar" subtitle="Sets curados por nosotros: todo lo que necesitas, en un solo clic." current="Kits" />
  <div class="wrap" style="padding:34px 22px 10px">
    <div class="kitgrid">
      <KitCard v-for="(k, i) in kits" :key="k.slug" :kit="k" v-reveal :data-reveal-index="i % 4" />
    </div>
  </div>
</template>
