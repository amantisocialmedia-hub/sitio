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
onMounted(() => {
  initDiscreet()
  di = setInterval(() => { discretaIdx.value = (discretaIdx.value + 1) % discretaMsgs.length }, 4500)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => { clearInterval(di); window.removeEventListener('keydown', onKey) })

function goSearch() {
  drawerOpen.value = false
  router.push({ path: '/tienda', query: q.value ? { q: q.value } : {} })
}

// Mega-menú estilo Cake. Los enlaces apuntan a /tienda (filtrable) — al crecer el
// catálogo se conectan subcolecciones reales.
const mega = [
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
  {
    label: 'Lencería', to: '/tienda',
    items: ['Disfraces', 'Femenina', 'Masculina', 'Trajes De Baño'],
  },
  {
    label: 'Blog', to: '/blog',
    items: ['Tips Sexuales', 'Salud Sexual', 'Juguetes Sexuales', 'Estilo De Vida', 'Relaciones Y Amores'],
  },
]

// Manda los sub-enlaces a la categoría real cuando existe; el blog va al blog.
const catByLabel: Record<string, string> = {
  Vibradores: 'vibradores',
  Dildos: 'dildos',
  Anales: 'anal',
  'Vibradores Anales': 'anal',
  'Dildo Anal': 'anal',
  'Juguetes BDSM': 'bdsm',
  'Vibrador Para Parejas': 'parejas',
  'Anillos Para Pene': 'hombre',
  'Fundas Para Pene': 'hombre',
  'Fundas Y Extensiones': 'hombre',
  'Anillos Retardantes': 'retardantes',
  Masturbadores: 'masturbadores',
  'Pocket Pussy': 'masturbadores',
  'Masturbador Vibrador': 'masturbadores',
  'Masturbador Con App': 'masturbadores',
  'Huevo Masturbador': 'masturbadores',
  'Muñecas Y Torsos': 'masturbadores',
  '★ Porn Stars': 'masturbadores',
  Retardantes: 'retardantes',
  Lubricantes: 'lubricantes',
  'Dildo Strap-On': 'arneses',
  'Succionador De Clítoris': 'vibradores',
  Succionadores: 'vibradores',
  'Bala Vibradora': 'vibradores',
  'Monster Dildo': 'dildos',
  'Dildo Realista': 'dildos',
  'Dildo Con Ventosa': 'dildos',
}
function itemHref(m: { label: string; to: string }, it: string) {
  if (m.label === 'Blog') return '/blog'
  if (catByLabel[it]) return `/tienda?cat=${catByLabel[it]}`
  return m.to
}
</script>

<template>
  <div class="strip0"></div>
  <header class="nav">
    <div class="nav-in">
      <NuxtLink to="/" class="logo"><span class="mark"><span>amanti</span></span></NuxtLink>

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
        <button class="ic discreet-btn" :class="{ on: discreetOn }" @click="toggleDiscreet" :aria-pressed="discreetOn" :aria-label="discreetOn ? 'Desactivar modo discreto' : 'Activar modo discreto'" title="Modo discreto (oculta lo sensible)">👁</button>
        <NuxtLink to="/favoritos" class="ic" aria-label="Favoritos">
          ♡<span v-if="wishlist.count" class="cart-c" :class="{ bump: wishBump }">{{ wishlist.count }}</span>
        </NuxtLink>
        <NuxtLink to="/carrito" class="ic" aria-label="Carrito">
          🛒<span v-if="cart.totalItems" class="cart-c" :class="{ bump: cartBump }">{{ cart.totalItems }}</span>
        </NuxtLink>
        <button class="burger" @click="drawerOpen = true" aria-label="Menú">☰</button>
      </div>
    </div>
  </header>

  <div v-if="showDiscreta" class="discreta">
    <Transition name="drot" mode="out-in">
      <span class="discreta-rot" :key="discretaIdx">{{ discretaMsgs[discretaIdx] }}</span>
    </Transition>
    <button class="x" @click="showDiscreta = false" aria-label="Cerrar">✕</button>
  </div>

  <div class="searchrow">
    <div class="wrap">
      <div class="searchbox">
        <input v-model="q" placeholder="Búsqueda Rápida" aria-label="Buscar productos" @keyup.enter="goSearch" />
        <button class="sic" @click="goSearch" aria-label="Buscar">🔍</button>
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
