<script setup lang="ts">
const route = useRoute()
const { products, categories, peso } = useProducts()

const selectedCats = ref<string[]>([])
const onlyAmanti = ref(false)
const priceMin = ref<number | null>(null)
const priceMax = ref<number | null>(null)
const sort = ref('relevancia')
const q = ref('')
const showFilters = ref(false) // toggle de filtros en móvil (en desktop el aside siempre se muestra)

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
  if (q.value) {
    const t = q.value.toLowerCase()
    list = list.filter(p => (p.name + ' ' + p.subtitle + ' ' + p.brand + ' ' + p.description).toLowerCase().includes(t))
  }
  if (priceMin.value != null) list = list.filter(p => p.price >= priceMin.value!)
  if (priceMax.value != null) list = list.filter(p => p.price <= priceMax.value!)
  switch (sort.value) {
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
  selectedCats.value = []; onlyAmanti.value = false
  priceMin.value = null; priceMax.value = null; q.value = ''
}
</script>

<template>
  <div class="wrap">
    <div class="collhero"><span class="em"><img v-if="heroImage" :key="heroImage" :src="heroImage" :alt="title" class="cat-img" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'"><span :style="heroImage ? 'display:none' : ''">{{ heroEmoji }}</span></span></div>

    <div class="breadcrumb">
      <NuxtLink to="/">AMANTI</NuxtLink><span class="sep">›</span><span>{{ title }}</span>
    </div>

    <div class="colltop">
      <h1>{{ title }}</h1>
      <p>{{ blurb }}</p>
    </div>

    <div class="shoplayout">
      <!-- sidebar (en móvil se colapsa; el botón "Filtrar" del toolbar lo abre) -->
      <aside class="filters" :class="{ open: showFilters }">
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
        <div class="fgroup">
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
  </div>
</template>
