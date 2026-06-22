<script setup lang="ts">
const route = useRoute()
const { products, categories, peso } = useProducts()

const selectedCats = ref<string[]>([])
const onlyAmanti = ref(false)
const priceMin = ref<number | null>(null)
const priceMax = ref<number | null>(null)
const sort = ref('relevancia')
const q = ref('')
const quick = ref('') // chip rápido: '' | 'top' | 'nuevos'
const showFilters = ref(false) // toggle de filtros en móvil (en desktop el aside siempre se muestra)

function setQuick(v: string) { quick.value = quick.value === v ? '' : v }

// Bloquea el scroll del fondo mientras el bottom-sheet de filtros está abierto (móvil).
watch(showFilters, (v) => { if (import.meta.client) document.body.style.overflow = v ? 'hidden' : '' })
onBeforeUnmount(() => { if (import.meta.client) document.body.style.overflow = '' })

// La marca casa real es 'AMANTI Select' (el resto son marcas de fabricante).
const amantiCount = computed(() => products.filter(p => p.brand === 'AMANTI Select').length)

// Sincroniza con la URL (?cat= / ?sale= / ?q=)
function syncFromRoute() {
  const cat = route.query.cat as string | undefined
  selectedCats.value = cat ? [cat] : []
  q.value = (route.query.q as string) || ''
}
syncFromRoute()
watch(() => route.query, syncFromRoute)

const counts = computed(() => {
  const m: Record<string, number> = {}
  for (const c of categories) m[c.slug] = products.filter(p => p.category === c.slug).length
  return m
})

const filtered = computed(() => {
  let list = products.slice()
  if (selectedCats.value.length) list = list.filter(p => selectedCats.value.includes(p.category))
  if (onlyAmanti.value) list = list.filter(p => p.brand === 'AMANTI Select')
  if (quick.value === 'top') list = list.filter(p => p.hot)
  if (quick.value === 'nuevos') list = list.filter(p => p.featured)
  if (q.value) {
    const t = q.value.toLowerCase()
    list = list.filter(p => (p.name + ' ' + p.subtitle + ' ' + p.brand + ' ' + p.description).toLowerCase().includes(t))
  }
  if (priceMin.value != null) list = list.filter(p => p.price >= priceMin.value!)
  if (priceMax.value != null) list = list.filter(p => p.price <= priceMax.value!)
  switch (sort.value) {
    case 'top': list.sort((a, b) => (Number(b.hot) - Number(a.hot)) || (b.rating - a.rating)); break
    case 'nuevos': list.sort((a, b) => (Number(b.featured) - Number(a.featured)) || (b.rating - a.rating)); break
    case 'precio-asc': list.sort((a, b) => a.price - b.price); break
    case 'precio-desc': list.sort((a, b) => b.price - a.price); break
    case 'az': list.sort((a, b) => a.name.localeCompare(b.name)); break
    case 'za': list.sort((a, b) => b.name.localeCompare(a.name)); break
  }
  return list
})

const title = computed(() => {
  if (q.value) return `Resultados: “${q.value}”`
  if (selectedCats.value.length === 1) return categories.find(c => c.slug === selectedCats.value[0])?.name || 'Tienda'
  return 'Juguetes Sexuales'
})
const heroEmoji = computed(() => {
  if (selectedCats.value.length === 1) return categories.find(c => c.slug === selectedCats.value[0])?.emoji || '🛍️'
  return '🛍️'
})
const heroImage = computed(() => {
  if (selectedCats.value.length === 1) return categories.find(c => c.slug === selectedCats.value[0])?.image || ''
  return ''
})
const blurb = computed(() => {
  if (selectedCats.value.length === 1) return categories.find(c => c.slug === selectedCats.value[0])?.blurb || ''
  return 'Descubre el universo del placer en AMANTI: vibradores, juguetes para parejas, lubricantes y más. Calidad, discreción y mucha variedad — sin tabúes.'
})

// SEO por-página (reactivo a los filtros). El canonical lo pone app.vue vía route.path.
useSeoMeta({
  title: () => `${title.value} — AMANTI`,
  description: () => blurb.value,
})

function toggleCat(slug: string) {
  selectedCats.value = selectedCats.value.includes(slug)
    ? selectedCats.value.filter(s => s !== slug)
    : [...selectedCats.value, slug]
}
function clearAll() {
  selectedCats.value = []; onlyAmanti.value = false; quick.value = ''
  priceMin.value = null; priceMax.value = null; q.value = ''
}

// Vitrina del banner: hasta 5 productos reales de la categoría (o del catálogo si "todo").
const bannerProducts = computed(() => {
  const base = selectedCats.value.length === 1
    ? products.filter(p => p.category === selectedCats.value[0])
    : products
  return base.slice(0, 5)
})
</script>

<template>
  <div class="wrap">
    <div class="breadcrumb">
      <NuxtLink to="/">AMANTI</NuxtLink><span class="sep">›</span><span>{{ title }}</span>
    </div>

    <section class="collbanner" v-reveal>
      <div class="cb-info">
        <span class="cb-eyebrow">Colección AMANTI</span>
        <h1>{{ title }}</h1>
        <p>{{ blurb }}</p>
        <span class="cb-count">{{ filtered.length }} producto{{ filtered.length === 1 ? '' : 's' }}</span>
      </div>
      <div class="cb-strip">
        <NuxtLink v-for="(p, i) in bannerProducts" :key="p.slug" :to="`/tienda/${p.slug}`" class="cb-thumb" :style="{ background: p.bg }" :data-reveal-index="i" v-reveal>
          <NuxtImg v-if="p.images?.length" :src="p.images[0]" :alt="p.name" class="cb-thumb-img" format="webp" width="160" height="200" loading="lazy" />
          <span v-else class="cb-thumb-emo">{{ p.emoji }}</span>
        </NuxtLink>
      </div>
      <span class="cb-blob cb-blob1"></span>
      <span class="cb-blob cb-blob2"></span>
    </section>

    <!-- chips de filtro rápido -->
    <div class="chiprow">
      <button class="chip" :class="{ on: !quick && !onlyAmanti && !selectedCats.length }" @click="clearAll">✨ Todo</button>
      <button class="chip" :class="{ on: quick === 'top' }" @click="setQuick('top')">🔥 Más vendidos</button>
      <button class="chip" :class="{ on: quick === 'nuevos' }" @click="setQuick('nuevos')">🆕 Novedades</button>
      <button class="chip" :class="{ on: onlyAmanti }" @click="onlyAmanti = !onlyAmanti">💎 AMANTI Select</button>
    </div>

    <!-- overlay del bottom-sheet de filtros (solo móvil) -->
    <div v-if="showFilters" class="filters-bg" @click="showFilters = false"></div>

    <div class="shoplayout">
      <!-- sidebar: en desktop fijo; en móvil bottom-sheet que abre el botón "Filtrar" -->
      <aside class="filters" :class="{ open: showFilters }">
        <div class="filters-head"><b>Filtros</b><button class="filters-x" @click="showFilters = false" aria-label="Cerrar">✕</button></div>
        <div class="fgroup">
          <h4>Categorías</h4>
          <label v-for="c in categories" :key="c.slug" class="fopt">
            <input type="checkbox" :checked="selectedCats.includes(c.slug)" @change="toggleCat(c.slug)" />
            {{ c.name }}<span class="cnt">({{ counts[c.slug] }})</span>
          </label>
        </div>
        <div class="fgroup">
          <h4>Marca</h4>
          <label class="fopt"><input type="checkbox" v-model="onlyAmanti" /> AMANTI Select <span class="cnt">({{ amantiCount }})</span></label>
        </div>
        <div class="fgroup">
          <h4>Precio</h4>
          <div class="pricerow">
            <input type="number" placeholder="$ min" aria-label="Precio mínimo" v-model.number="priceMin" />
            <span>—</span>
            <input type="number" placeholder="$ max" aria-label="Precio máximo" v-model.number="priceMax" />
          </div>
        </div>
        <div class="fgroup filters-foot">
          <button class="btn magenta block filters-apply" @click="showFilters = false">Ver {{ filtered.length }} producto{{ filtered.length === 1 ? '' : 's' }}</button>
          <button class="btn outline block" @click="clearAll">Limpiar filtros</button>
        </div>
      </aside>

      <!-- main -->
      <div>
        <div class="toolbar">
          <button type="button" class="filterbtn" @click="showFilters = !showFilters">{{ showFilters ? 'Ocultar filtros' : 'Filtrar' }}</button>
          <span class="count">{{ filtered.length }} producto{{ filtered.length === 1 ? '' : 's' }}</span>
          <label for="sort">Ordenar por:</label>
          <select id="sort" v-model="sort">
            <option value="relevancia">Más relevantes</option>
            <option value="top">Más vendidos</option>
            <option value="nuevos">Novedades</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
            <option value="az">Alfabético A-Z</option>
            <option value="za">Alfabético Z-A</option>
          </select>
        </div>

        <div v-if="filtered.length" class="grid">
          <ProductCard v-for="(p, i) in filtered" :key="p.slug" :product="p" :priority="i < 4" v-reveal :data-reveal-index="i % 8" />
        </div>
        <div v-else class="emptybox">
          <div class="e">🔍</div>
          <h3>Aún no hay productos aquí</h3>
          <p style="opacity:.7;margin:8px 0 16px">Estamos sumando inventario a esta categoría. Mientras, explora todo el catálogo.</p>
          <NuxtLink to="/tienda" class="btn" @click="clearAll">Ver todo</NuxtLink>
        </div>
      </div>
    </div>

    <!-- mini-FAQ de la tienda (confianza + SEO, sin muro de texto) -->
    <section class="section" style="padding:30px 0 6px">
      <div class="faq" style="max-width:820px;margin:0 auto">
        <details><summary>¿El envío es discreto?</summary><p>Sí. Tu pedido llega en caja sin marca, con remitente genérico y un cargo neutral en tu estado de cuenta. Nadie sabrá qué contiene.</p></details>
        <details><summary>¿Qué materiales usan los juguetes?</summary><p>Materiales body-safe (silicona hipoalergénica y ABS de grado médico). Revisa la ficha de cada producto para el detalle.</p></details>
        <details><summary>Es mi primera vez, ¿cuál me recomiendan?</summary><p>Haz nuestro <NuxtLink to="/quiz" style="color:var(--magenta);text-decoration:underline">quiz de 4 preguntas</NuxtLink> y te recomendamos tu match ideal, o escríbenos por WhatsApp sin pena.</p></details>
      </div>
    </section>
  </div>
</template>
