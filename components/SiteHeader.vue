<script setup lang="ts">
const cart = useCartStore()
const wishlist = useWishlistStore()
const router = useRouter()
const { user } = useAuth()

const showDiscreta = ref(true)
const drawerOpen = ref(false)
const q = ref('')

// Pop del badge al cambiar el carrito / favoritos.
const cartBump = ref(false)
const wishBump = ref(false)
let ct: ReturnType<typeof setTimeout>, wt: ReturnType<typeof setTimeout>
watch(() => cart.totalItems, () => { cartBump.value = true; clearTimeout(ct); ct = setTimeout(() => (cartBump.value = false), 320) })
watch(() => wishlist.count, () => { wishBump.value = true; clearTimeout(wt); wt = setTimeout(() => (wishBump.value = false), 320) })

// Modo discreto (botón 👁) + barra superior con mensajes rotativos.
const { on: discreetOn, toggle: toggleDiscreet, init: initDiscreet } = useDiscreet()
const discretaMsgs = [
  'Entrega 100% discreta · empaque neutro 📦',
  '+235 reseñas reales ★ 4.9',
  'Hecho en México, sin tabúes 🇲🇽',
  'Pregúntanos lo que sea por WhatsApp 💬',
]
const discretaIdx = ref(0)
let di: ReturnType<typeof setInterval>
function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && discreetOn.value) toggleDiscreet() }

// Header estilo Cake: en móvil se esconde al bajar y reaparece al subir (así deja de tapar el
// producto al hacer scroll — reporte de Raúl, jul-2026). Solo aplica en móvil (ver main.css).
const navHidden = ref(false)
let lastY = 0
function onScroll() {
  const y = window.scrollY || 0
  if (y < 120) navHidden.value = false             // cerca del top: siempre visible
  else if (y > lastY + 6) navHidden.value = true   // bajando → se esconde
  else if (y < lastY - 6) navHidden.value = false  // subiendo → reaparece
  lastY = y
}
onMounted(() => {
  initDiscreet()
  di = setInterval(() => { discretaIdx.value = (discretaIdx.value + 1) % discretaMsgs.length }, 4500)
  window.addEventListener('keydown', onKey)
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => {
  clearInterval(di)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', onScroll)
})

function goSearch() {
  drawerOpen.value = false
  searchFocused.value = false
  router.push({ path: '/tienda', query: q.value ? { q: q.value } : {} })
}

// Buscador instantáneo: resultados en vivo mientras se escribe (catálogo en cliente).
const { products, peso, bySubcategory, subcategories: subs } = useProducts()
const searchFocused = ref(false)
const results = computed(() => {
  const t = q.value.trim().toLowerCase()
  if (t.length < 2) return []
  return products
    .filter(p => `${p.name} ${p.subtitle || ''} ${p.brand} ${p.category}`.toLowerCase().includes(t))
    .slice(0, 6)
})
const showResults = computed(() => searchFocused.value && q.value.trim().length >= 2)
function pickResult() { searchFocused.value = false; q.value = '' }
function onSearchBlur() { setTimeout(() => { searchFocused.value = false }, 160) }

// Mega-menú estilo Cake. Los rótulos de subcategoría se resuelven contra la taxonomía
// del catálogo (composables/useProducts). El menú es DINÁMICO: una subcategoría solo
// aparece si tiene al menos 1 producto (ver `mega`), y al elegirla se filtra SOLO sus
// productos vía /tienda?cat=&sub= (ver itemHref).
const subByLabel = new Map(subs.map(s => [s.label, s]))

const megaBase = [
  {
    label: 'Juguetes Sexuales', to: '/tienda',
    items: ['Vibradores', 'Masturbadores', 'Dildos', 'Anales', 'Lubricantes', 'Succionadores', 'Anillos Para Pene', 'Fundas Para Pene', 'Juguetes BDSM', 'Kegel', 'Accesorios'],
  },
  {
    label: 'Vibradores', to: '/tienda?cat=vibradores',
    items: ['Vibrador Conejo', 'Bala Vibradora', 'Vibrador Butterfly', 'Calzón Vibrador', 'Vibrador Punto G', 'Vibrador Con App', 'Vibrador Control Remoto', 'Dedal Vibrador', 'Vibrador Con Empuje', 'Huevo Vibrador', 'Vibrador Masajeador', 'Vibrador Para Parejas', 'Vibrador Con Succionador', 'Succionador De Clítoris', 'Vibradores Anales'],
  },
  {
    label: 'Masturbadores', to: '/tienda?cat=masturbadores',
    items: ['Pocket Pussy', 'Masturbador Vibrador', 'Masturbador Con App', 'Huevo Masturbador', 'Bombas De Vacío', 'Muñecas Y Torsos', 'Masajeador De Próstata', 'Anillos Retardantes', 'Fundas Y Extensiones', '★ Porn Stars'],
  },
  {
    label: 'Dildos', to: '/tienda?cat=dildos',
    items: ['Dildo Realista', 'Dildo Vibrador', 'Dildo Con Ventosa', 'Dildo Strap-On', 'Dildo Strapless', 'Dildo Control Remoto', 'Dildo Anal', 'Dildo Doble Penetración', 'Dildo Eyaculador', 'Dildo Hueco', 'Dildo De Cristal', 'Monster Dildo'],
  },
  // Lencería OCULTA del menú (QA jul-2026): la categoría no existe en el catálogo (0
  // productos) y el rótulo mandaba a /tienda completa ("dildos bajo Lencería").
  // Para reactivarla: descomentar cuando haya productos reales con category 'lenceria'
  // (y dar de alta sus subcategorías en composables/useProducts.ts).
  // {
  //   label: 'Lencería', to: '/tienda',
  //   items: ['Disfraces', 'Femenina', 'Masculina', 'Trajes De Baño'],
  // },
  {
    label: 'Blog', to: '/blog', blog: true,
    items: ['Tips Sexuales', 'Salud Sexual', 'Juguetes Sexuales', 'Estilo De Vida', 'Relaciones Y Amores'],
  },
  { label: '✨ Quiz', to: '/quiz', items: [] as string[] },
]

// Oculta las subcategorías sin productos (las del Blog no dependen del catálogo).
const mega = computed(() => megaBase.map(m => ({
  ...m,
  items: (m as { blog?: boolean }).blog
    ? m.items
    : m.items.filter((it) => {
        const sub = subByLabel.get(it)
        return sub ? bySubcategory(sub.slug).length > 0 : false
      }),
})))

// Resuelve cada rótulo a su URL real de catálogo. Subcategoría con palabras clave →
// /tienda?cat=X&sub=Y (filtra SOLO sus productos); categoría completa → /tienda?cat=X.
function itemHref(m: { label: string; to: string; blog?: boolean }, it: string) {
  if (m.blog) return '/blog'
  const sub = subByLabel.get(it)
  if (!sub) return m.to
  const base = `/tienda?cat=${sub.category}`
  return sub.keywords?.length ? `${base}&sub=${sub.slug}` : base
}
</script>

<template>
  <div class="strip0"></div>
  <header class="nav" :class="{ 'nav--hidden': navHidden }">
    <div class="nav-in">
      <NuxtLink to="/" class="logo" aria-label="AMANTI — Inicio">
        <span class="logo-iso" aria-hidden="true"></span>
        <span class="logo-word">AMANTI<span class="logo-r" aria-hidden="true">®</span></span>
      </NuxtLink>

      <ul class="menu">
        <li v-for="m in mega" :key="m.label">
          <NuxtLink :to="m.to">{{ m.label }}</NuxtLink>
          <div v-if="m.items.length" class="dropdown">
            <NuxtLink v-for="it in m.items" :key="it" :to="itemHref(m, it)">
              {{ it }}<span class="chev">›</span>
            </NuxtLink>
          </div>
        </li>
      </ul>

      <div class="nav-right">
        <NuxtLink to="/cuenta" class="hide-sm">{{ user ? '👤 Mi cuenta' : 'Entrar' }}</NuxtLink>
        <button class="ic discreet-btn" :class="{ on: discreetOn }" @click="toggleDiscreet" :aria-pressed="discreetOn" :aria-label="discreetOn ? 'Desactivar modo discreto' : 'Activar modo discreto'" title="Modo discreto (oculta lo sensible)">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
            <path v-if="discreetOn" d="M4 4l16 16" />
          </svg>
        </button>
        <NuxtLink to="/favoritos" class="ic" aria-label="Favoritos">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20.5S3.5 15.5 3.5 9.3A4 4 0 0 1 12 7a4 4 0 0 1 8.5 2.3c0 6.2-8.5 11.2-8.5 11.2z" />
          </svg>
          <span v-if="wishlist.count" class="cart-c" :class="{ bump: wishBump }">{{ wishlist.count }}</span>
        </NuxtLink>
        <NuxtLink to="/carrito" class="ic" aria-label="Carrito">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" />
            <path d="M2.5 3h2.2l2.2 11.6a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.3L20.5 7H5.3" />
          </svg>
          <span v-if="cart.totalItems" class="cart-c" :class="{ bump: cartBump }">{{ cart.totalItems }}</span>
        </NuxtLink>
        <button class="burger" @click="drawerOpen = true" aria-label="Menú">☰</button>
      </div>
    </div>
    <!-- Aviso del modo discreto: sin él, en móvil todo queda difuminado "sin explicación"
         (QA). Vive dentro del nav sticky → siempre visible mientras el modo esté activo,
         y tocarlo también desactiva. -->
    <Transition name="dnote">
      <button v-if="discreetOn" class="discreet-note" @click="toggleDiscreet" aria-label="Desactivar modo discreto">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
          <path d="M4 4l16 16" />
        </svg>
        <span role="status">Modo discreto activado — toca el ojo o aquí para volver</span>
      </button>
    </Transition>
  </header>

  <div v-if="showDiscreta" class="discreta">
    <Transition name="drot" mode="out-in">
      <span class="discreta-rot" :key="discretaIdx">{{ discretaMsgs[discretaIdx] }}</span>
    </Transition>
    <button class="x" @click="showDiscreta = false" aria-label="Cerrar">✕</button>
  </div>

  <div class="searchrow">
    <div class="wrap">
      <div class="searchbox" :class="{ open: showResults }">
        <input v-model="q" placeholder="Búsqueda Rápida" aria-label="Buscar productos"
               @keyup.enter="goSearch" @focus="searchFocused = true" @blur="onSearchBlur" />
        <button class="sic" @click="goSearch" aria-label="Buscar">🔍</button>
        <div v-if="showResults" class="searchpop">
          <NuxtLink v-for="p in results" :key="p.slug" :to="`/tienda/${p.slug}`" class="sr-item" @click="pickResult">
            <span class="sr-th" :style="{ background: p.bg }">
              <img v-if="p.images?.length" :src="p.images[0]" :alt="p.name" loading="lazy" />
              <span v-else>{{ p.emoji }}</span>
            </span>
            <span class="sr-info">
              <span class="sr-name">{{ p.name }}</span>
              <span class="sr-cat">{{ p.brand }}</span>
            </span>
            <span class="sr-price">{{ peso(p.price) }}</span>
          </NuxtLink>
          <div v-if="!results.length" class="sr-empty">Sin resultados para “{{ q }}”. Prueba otra palabra.</div>
          <button v-else class="sr-all" @click="goSearch">Ver todos los resultados →</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Drawer móvil: acordeón para alcanzar las subcategorías (no solo los rótulos) -->
  <div class="drawer" :class="{ open: drawerOpen }">
    <div class="bg" @click="drawerOpen = false"></div>
    <nav class="panel">
      <div v-for="m in mega" :key="m.label" class="drawer-group">
        <details v-if="m.items.length">
          <summary>{{ m.label }}</summary>
          <NuxtLink :to="m.to" class="sub" @click="drawerOpen = false">Ver todo {{ m.label }}</NuxtLink>
          <NuxtLink v-for="it in m.items" :key="it" :to="itemHref(m, it)" class="sub" @click="drawerOpen = false">{{ it }}</NuxtLink>
        </details>
        <NuxtLink v-else :to="m.to" @click="drawerOpen = false">{{ m.label }}</NuxtLink>
      </div>
      <NuxtLink to="/cuenta" @click="drawerOpen = false">{{ user ? 'Mi cuenta' : 'Entrar' }}</NuxtLink>
      <NuxtLink to="/favoritos" @click="drawerOpen = false">Favoritos ({{ wishlist.count }})</NuxtLink>
      <NuxtLink to="/carrito" @click="drawerOpen = false">Carrito ({{ cart.totalItems }})</NuxtLink>
    </nav>
  </div>
</template>

<style scoped>
@media(max-width:560px){ .hide-sm{display:none} }
/* acordeón del drawer */
.drawer-group details summary{
  list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;
  padding:14px 24px;font-family:var(--fh);font-weight:600;color:var(--purple);
  border-bottom:1px solid #F9EFE7;text-transform:uppercase;font-size:.92rem;
}
.drawer-group details summary::-webkit-details-marker{display:none}
.drawer-group details summary::after{content:'+';color:var(--magenta);font-weight:700;font-size:1.2rem}
.drawer-group details[open] summary::after{content:'–'}
.drawer .panel a.sub{
  padding:11px 24px 11px 36px;font-family:var(--fb);font-weight:500;font-size:.88rem;
  text-transform:none;color:var(--purple);background:#FCF6F0;
}
</style>
