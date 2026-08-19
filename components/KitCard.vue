<script setup lang="ts">
const props = defineProps<{ kit: { slug: string; name: string; emoji: string; grad: string; blurb: string; items: string[] } }>()
const { getBySlug, peso } = useProducts()
const cart = useCartStore()

const items = computed(() => props.kit.items.map(s => getBySlug(s)).filter(Boolean) as any[])
const total = computed(() => items.value.reduce((s, p) => s + p.price, 0))
const added = ref(false)

function addKit() {
  items.value.forEach(p => cart.addItem({ slug: p.slug, name: p.name, price: p.price, emoji: p.emoji, bg: p.bg }))
  added.value = true
  setTimeout(() => (added.value = false), 1500)
  if (import.meta.client) window.dispatchEvent(new CustomEvent('cart:add'))
}
</script>

<template>
  <div v-if="items.length" class="kitcard">
    <div class="kit-head" :style="{ background: kit.grad }">
      <span class="kit-emo">{{ kit.emoji }}</span>
      <h3>{{ kit.name }}</h3>
      <span class="kit-tag">{{ items.length }} productos</span>
    </div>
    <div class="kit-body">
      <p class="kit-blurb">{{ kit.blurb }}</p>
      <ul class="kit-items">
        <li v-for="p in items" :key="p.slug">
          <NuxtLink :to="`/tienda/${p.slug}`" class="ki-link">
            <span class="ki-th" :style="{ background: p.bg }">
              <img v-if="p.images?.length" :src="p.images[0]" :alt="p.name" loading="lazy" />
              <span v-else>{{ p.emoji }}</span>
            </span>
            <span class="ki-name">{{ p.name }}</span>
            <span class="ki-price">{{ peso(p.price) }}</span>
          </NuxtLink>
        </li>
      </ul>
      <div class="kit-foot">
        <div class="kit-total"><span>Total del kit</span><b>{{ peso(total) }}</b></div>
        <button class="btn magenta block" :class="{ added }" @click="addKit">{{ added ? '✓ Kit añadido' : 'Añadir kit al carrito 🛍️' }}</button>
        <span v-if="CAMPANA.activa" class="kit-coupon">Precios con <b>-{{ CAMPANA_PCT }}%</b> ya aplicado</span>
        <span v-else-if="MOSTRAR_CUPONES" class="kit-coupon">+ aplica tu cupón <b>AMANTI15</b> al pagar</span>
      </div>
    </div>
  </div>
</template>
