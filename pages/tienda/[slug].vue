<script setup lang="ts">
import reviewsData from '~/data/reviews.json'
const route = useRoute()
const config = useRuntimeConfig()
const { getBySlug, related, peso, msi, categoryName } = useProducts()
const cart = useCartStore()
const wishlist = useWishlistStore()
const { openCart } = useCartUI()

const product = computed(() => getBySlug(route.params.slug as string))

interface Review { name: string; rating: number; date: string; text: string; verified: boolean }
const reviews = computed<Review[]>(() => (product.value ? ((reviewsData as Record<string, Review[]>)[product.value.slug] || []) : []))
// Reseñas reales de clientes (Supabase). Se cargan en cliente y se anteponen a las curadas.
const realReviews = ref<Review[]>([])
const allReviews = computed<Review[]>(() => [...realReviews.value, ...reviews.value])
const ratingCount = computed(() => allReviews.value.length)
const ratingAvg = computed(() =>
  ratingCount.value ? Math.round((allReviews.value.reduce((s, r) => s + r.rating, 0) / ratingCount.value) * 10) / 10 : (product.value?.rating ?? 5),
)

// Carga + envío de reseñas reales (degrada con gracia si la tabla no existe).
const supabaseRev = useSupabaseClient()
const reviewUser = useSupabaseUser()
const myRating = ref(0)
const myText = ref('')
const reviewBusy = ref(false)
const reviewMsg = ref('')
const reviewErr = ref(false)

async function loadRealReviews() {
  realReviews.value = []
  const slug = product.value?.slug
  if (!slug) return
  const { data, error } = await supabaseRev
    .from('reviews')
    .select('author_name, rating, text, created_at')
    .eq('product_slug', slug)
    .order('created_at', { ascending: false })
  if (error) return // tabla puede no existir aún → solo curadas
  realReviews.value = (data || []).map((r: any) => ({ name: r.author_name, rating: r.rating, date: r.created_at, text: r.text, verified: true }))
}

async function submitReview() {
  reviewErr.value = false; reviewMsg.value = ''
  if (!reviewUser.value) { reviewErr.value = true; reviewMsg.value = 'Inicia sesión para dejar tu reseña.'; return }
  if (!myRating.value) { reviewErr.value = true; reviewMsg.value = 'Elige una calificación.'; return }
  if (myText.value.trim().length < 4) { reviewErr.value = true; reviewMsg.value = 'Cuéntanos un poco más.'; return }
  reviewBusy.value = true
  const meta = (reviewUser.value.user_metadata || {}) as Record<string, string>
  const name = meta.full_name || (reviewUser.value.email ? reviewUser.value.email.split('@')[0] : 'Cliente AMANTI')
  const { error } = await supabaseRev.from('reviews').insert({
    user_id: reviewUser.value.id, product_slug: product.value!.slug, author_name: name, rating: myRating.value, text: myText.value.trim(),
  })
  reviewBusy.value = false
  if (error) {
    reviewErr.value = true
    reviewMsg.value = (error as any).code === '23505' ? 'Ya dejaste una reseña de este producto.' : 'No se pudo guardar tu reseña. Intenta más tarde.'
    return
  }
  reviewMsg.value = '¡Gracias por tu reseña! 💜'
  myText.value = ''; myRating.value = 0
  await loadRealReviews()
}
const analytics = useAnalytics()
const { addRecent } = usePersonalization()
function trackView() {
  const p = product.value
  if (!p) return
  analytics.viewItem({ slug: p.slug, name: p.name, price: p.price, category: p.category })
  addRecent(p.slug)
}
onMounted(() => { loadRealReviews(); trackView() })
function fmtReviewDate(s: string) {
  try {
    // "2026-03-29" (sin hora) lo interpreta el motor como medianoche UTC, que en
    // México cae el día anterior: el servidor imprimía "29 de marzo" y el navegador
    // "28". Además de mostrar mal la fecha, rompía la hidratación de la ficha.
    // Anclamos esas fechas a mediodía UTC y fijamos la zona para que servidor y
    // navegador escriban siempre lo mismo.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
    const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)) : new Date(s)
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City',
    }).format(d)
  } catch { return s }
}
const onSale = computed(() => !!product.value?.compareAt && product.value.compareAt > product.value.price)
const pct = computed(() => onSale.value
  ? Math.round((1 - product.value!.price / product.value!.compareAt) * 100) : 0)
const rel = computed(() => product.value ? related(product.value.slug) : [])
const stars = (r: number) => '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r)

const qty = ref(1)
const activeThumb = ref(0)
const added = ref(false)
const tab = ref('desc')
const lightbox = ref(false)

// Lightbox: navega TODAS las imágenes (no solo las 4 miniaturas).
function lbStep(d: number) {
  const imgs = product.value?.images
  if (!imgs?.length) return
  activeThumb.value = (activeThumb.value + d + imgs.length) % imgs.length
}

// Swipe táctil en la galería (móvil): navega entre fotos sin robar el scroll vertical
// (touch-action:pan-y en CSS). Umbral y dominancia horizontal viven en utils/swipe.
const swipeDir = ref(0) // dirección del último paso: 1 →, -1 ←, 0 = tap en miniatura (fundido)
let swStart: { x: number; y: number } | null = null
let swipedAt = 0

function galStep(d: number) {
  const imgs = product.value?.images
  if (!imgs?.length) return
  const next = stepIndex(activeThumb.value, d, imgs.length)
  if (next === null) return // sin loop: en el extremo el gesto no navega
  swipeDir.value = d
  activeThumb.value = next
}
function onGalDown(e: PointerEvent) {
  if (e.pointerType === 'mouse' || (product.value?.images?.length ?? 0) < 2) return
  swStart = { x: e.clientX, y: e.clientY }
  // Captura: el gesto termina en nuestro handler aunque el dedo salga de la imagen.
  ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
}
function onGalUp(e: PointerEvent) {
  if (!swStart) return
  const d = swipeStep(e.clientX - swStart.x, e.clientY - swStart.y)
  swStart = null
  if (!d) return
  swipedAt = Date.now()
  galStep(d)
}
function onGalCancel() { swStart = null } // el navegador tomó el gesto (scroll vertical)
function openLightbox() {
  if (!product.value?.images?.length) return
  if (Date.now() - swipedAt < 350) return // el click fantasma tras un swipe no abre el lightbox
  lightbox.value = true
}
function pickThumb(i: number) {
  swipeDir.value = 0
  activeThumb.value = i
}
// Specs como chips: icono por palabra clave.
const specIcon = (f: string) => {
  const t = f.toLowerCase()
  if (/sumergible|agua|waterproof|impermeable/.test(t)) return '💧'
  if (/recargable|usb|carga|bater[íi]a/.test(t)) return '🔌'
  if (/silencio|discret/.test(t)) return '🤫'
  if (/silic[oó]n|body.?safe|hipoalerg|m[ée]dico/.test(t)) return '🧴'
  if (/control|app|remoto|distancia/.test(t)) return '📲'
  if (/velocidad|modo|vibrac|funci[oó]n|intensidad|patr[oó]n/.test(t)) return '🎚️'
  if (/tama[ñn]|cm|largo|medida|long|diámetro|diametro/.test(t)) return '📏'
  if (/textur|realista|piel|suave/.test(t)) return '✨'
  return '•'
}

// El componente se reutiliza al navegar entre fichas (related): reinicia el estado por slug
// para no arrastrar cantidad, miniatura, pestaña ni el banner falso de "Agregado".
watch(() => route.params.slug, () => {
  qty.value = 1
  activeThumb.value = 0
  swipeDir.value = 0
  swStart = null
  added.value = false
  tab.value = 'desc'
  lightbox.value = false
  myRating.value = 0; myText.value = ''; reviewMsg.value = ''; reviewErr.value = false
  loadRealReviews()
  trackView()
})

// Lightbox: bloquea scroll y habilita teclado (Esc cerrar, ← → navegar).
function onLbKey(e: KeyboardEvent) {
  if (e.key === 'Escape') lightbox.value = false
  else if (e.key === 'ArrowLeft') lbStep(-1)
  else if (e.key === 'ArrowRight') lbStep(1)
}
watch(lightbox, (v) => {
  if (!import.meta.client) return
  document.body.style.overflow = v ? 'hidden' : ''
  if (v) window.addEventListener('keydown', onLbKey)
  else window.removeEventListener('keydown', onLbKey)
})

const waUrl = computed(() => {
  const p = product.value
  if (!p) return '#'
  const msg = `¡Hola AMANTI! Me interesa el ${p.name} (${peso(p.price)}). ¿Me ayudan? 💜${waRef()}`
  return `https://wa.me/${config.public.whatsappPhone}?text=${encodeURIComponent(msg)}`
})

function addToCart() {
  const p = product.value
  if (!p) return
  cart.addItem({ slug: p.slug, name: p.name, price: p.price, emoji: p.emoji, bg: p.bg }, qty.value)
  added.value = true
  if (import.meta.client) window.dispatchEvent(new CustomEvent('cart:add'))
  openCart()
}

// Favoritos del producto principal (mismo store que el ProductCard del grid).
const wishPopped = ref(false)
function toggleWish() {
  const p = product.value
  if (!p) return
  wishlist.toggle(p.slug)
  wishPopped.value = true
  setTimeout(() => (wishPopped.value = false), 350)
}

// Barra de compra fija: aparece cuando el .buyrow se va del viewport (hacia arriba).
const buyrowEl = ref<HTMLElement | null>(null)
const showSticky = ref(false)
let sio: IntersectionObserver | null = null
onMounted(() => {
  if (!import.meta.client || !buyrowEl.value) return
  sio = new IntersectionObserver(([e]) => {
    showSticky.value = !e.isIntersecting && e.boundingClientRect.top < 0
  }, { threshold: 0 })
  sio.observe(buyrowEl.value)
})
onBeforeUnmount(() => {
  sio?.disconnect()
  if (import.meta.client) {
    document.body.classList.remove('sticky-on')
    document.body.style.overflow = ''
    window.removeEventListener('keydown', onLbKey)
  }
})
watch(showSticky, (v) => { if (import.meta.client) document.body.classList.toggle('sticky-on', v) })

// SEO: título + meta description + Open Graph + JSON-LD de Producto (rich results).
// El canonical lo pone app.vue globalmente vía route.path (no se duplica aquí).
const seo = computed(() => {
  const p = product.value
  if (!p) return null
  const base = config.public.siteUrl
  return { p, url: `${base}/tienda/${p.slug}`, img: p.images?.length ? base + p.images[0] : undefined }
})

useHead(() => ({
  title: seo.value ? `${seo.value.p.name} — AMANTI` : 'Producto — AMANTI',
  script: seo.value
    ? [{
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: seo.value.p.name,
          image: seo.value.img ? [seo.value.img] : undefined,
          description: seo.value.p.description || seo.value.p.subtitle,
          brand: { '@type': 'Brand', name: seo.value.p.brand },
          offers: {
            '@type': 'Offer',
            price: seo.value.p.price,
            priceCurrency: 'MXN',
            availability: 'https://schema.org/InStock',
            url: seo.value.url,
          },
          aggregateRating: ratingCount.value
            ? { '@type': 'AggregateRating', ratingValue: ratingAvg.value, reviewCount: ratingCount.value, bestRating: 5, worstRating: 1 }
            : undefined,
          review: reviews.value.slice(0, 5).map((r) => ({
            '@type': 'Review',
            author: { '@type': 'Person', name: r.name },
            datePublished: r.date,
            reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
            reviewBody: r.text,
          })),
        }),
      }]
    : [],
}))

useSeoMeta({
  description: () => seo.value?.p.subtitle || seo.value?.p.description,
  ogTitle: () => (seo.value ? `${seo.value.p.name} — AMANTI` : undefined),
  ogDescription: () => seo.value?.p.subtitle || seo.value?.p.description,
  ogType: 'product',
  ogUrl: () => seo.value?.url,
  ogImage: () => seo.value?.img,
})
</script>

<template>
  <div class="wrap">
    <template v-if="product">
      <!-- Solo la banda delgada de Mercado Pago, para que el producto se vea
           sin hacer scroll. -->
      <PromoBanners v-if="MOSTRAR_CUPONES" show="mp" />

      <div class="breadcrumb">
        <NuxtLink to="/">AMANTI</NuxtLink><span class="sep">›</span>
        <NuxtLink :to="`/tienda?cat=${product.category}`">{{ categoryName(product.category) }}</NuxtLink>
        <span class="sep">›</span><span>{{ product.name }}</span>
      </div>

      <div class="pdp">
        <!-- gallery -->
        <div class="gallery">
          <div class="main" :class="{ zoomable: product.images?.length }" :style="{ background: product.bg }"
               @click="openLightbox" @pointerdown="onGalDown" @pointerup="onGalUp" @pointercancel="onGalCancel">
            <Transition :name="swipeDir ? (swipeDir > 0 ? 'gslide-l' : 'gslide-r') : 'gfade'" mode="out-in">
              <NuxtImg v-if="product.images?.length" :key="activeThumb" :src="product.images[Math.min(activeThumb, product.images.length - 1)]"
                   :alt="product.name" class="gimg" format="webp" width="800" height="800"
                   sizes="(max-width:760px) 100vw, 520px" loading="eager" fetchpriority="high" preload />
              <span v-else class="big">{{ product.emoji }}</span>
            </Transition>
            <span v-if="onSale" class="pbadge">rebaja</span>
            <span v-if="product.images?.length" class="zoom-hint" aria-hidden="true">🔍 Ampliar</span>
            <!-- Dots: indicador de foto activa, sincronizado con swipe/miniaturas/lightbox -->
            <div v-if="(product.images?.length || 0) > 1" class="gdots" aria-hidden="true">
              <span v-for="(img, i) in product.images" :key="img" class="gd"
                    :class="{ on: i === Math.min(activeThumb, product.images.length - 1) }" />
            </div>
          </div>
          <div class="thumbs">
            <template v-if="product.images?.length">
              <div v-for="(img, i) in product.images.slice(0, 4)" :key="img" class="t"
                   :class="{ active: activeThumb === i }" @click="pickThumb(i)">
                <NuxtImg :src="img" :alt="`${product.name} ${i + 1}`" class="gimg" format="webp" width="150" height="150" loading="lazy" />
              </div>
            </template>
            <template v-else>
              <div v-for="i in 3" :key="i" class="t" :class="{ active: activeThumb === i - 1 }"
                   :style="{ background: product.bg }" @click="pickThumb(i - 1)">{{ product.emoji }}</div>
            </template>
          </div>
        </div>

        <!-- info -->
        <div class="pdp-info">
          <h1>{{ product.name }}</h1>
          <a href="#resenas" class="rating-line" v-if="ratingCount">
            <span class="stars">{{ stars(Math.round(ratingAvg)) }}</span>
            <b>{{ ratingAvg.toFixed(1) }}</b>
            <span class="rcount">{{ ratingCount }} reseña{{ ratingCount === 1 ? '' : 's' }}</span>
          </a>
          <div v-else class="stars" style="margin-top:8px">{{ stars(product.rating) }}</div>
          <div class="sub">{{ product.subtitle }}</div>
          <div class="brand">MARCA: <b>{{ product.brand }}</b></div>

          <div class="badges-circ">
            <div v-for="b in product.badges" :key="b" class="bcirc">
              <div class="ring">{{ b.includes('Bestseller') ? '🏆' : b.includes('App') ? '📲' : b.includes('Recargable') || b.includes('Carga') ? '🔌' : b.includes('agua') ? '💧' : b.includes('Express') ? '🚚' : b.includes('Empaque') || b.includes('discreto') ? '📦' : b.includes('Vegano') ? '🌱' : b.includes('principiantes') ? '🔰' : '✨' }}</div>
              <span>{{ b }}</span>
            </div>
          </div>

          <div class="pdp-price">
            <span class="now" :class="{ red: onSale }">{{ peso(product.price) }}</span>
            <span v-if="onSale" class="was">{{ peso(product.compareAt) }}</span>
            <span v-if="onSale" class="pct">-{{ pct }}%</span>
          </div>

          <div class="payblock">
            <div class="lbl">Formas de Pago:</div>
            <div class="pay-icons">
              <span class="pi pi-amex">AMEX</span><span class="pi pi-visa">VISA</span><span class="pi pi-mc">MC</span>
              <span class="pi pi-mp">MercadoPago</span><span class="pi pi-oxxo">OXXO</span>
              <span class="pi pi-spei">SPEI</span><span class="pi pi-msi">Meses sin intereses</span>
            </div>
            <!-- Aclaración: los logos son informativos, no botones. Raúl reportó que
                 les daba clic esperando que abrieran algo. -->
            <p class="paynote">Eliges cuál al pagar, dentro de Mercado Pago.</p>
          </div>

          <div class="msi-note" v-if="product.price >= 300">
            <b>3 meses sin intereses</b> de {{ msi(product.price) }} con tarjetas participantes
          </div>
          <div class="msi-note" v-else>
            Pago 100% seguro con MercadoPago · tarjetas, OXXO y transferencia
          </div>

          <div class="qtybox">
            <div class="q">
              <button @click="qty = Math.max(1, qty - 1)">−</button>
              <span>{{ qty }}</span>
              <button @click="qty++">+</button>
            </div>
            <span style="opacity:.7;font-size:.9rem">Cantidad</span>
          </div>

          <div v-if="added" class="addconfirm">✓ Agregado al carrito.
            <NuxtLink to="/carrito" style="text-decoration:underline">Ver carrito →</NuxtLink>
          </div>

          <div class="buyrow" ref="buyrowEl">
            <button class="btn magenta block" @click="addToCart">Añadir al carrito 🛍️</button>
            <a :href="waUrl" target="_blank" rel="noopener" class="btn wa block">Pedir por WhatsApp</a>
            <!-- Favoritos del producto principal. ClientOnly: la wishlist vive en localStorage
                 (igual que en ProductCard); evita el desajuste de hidratación ♡→♥. -->
            <ClientOnly>
              <button class="btn outline block pdp-wish" :class="{ liked: wishlist.has(product.slug), pop: wishPopped }"
                      @click="toggleWish" :aria-pressed="wishlist.has(product.slug)"
                      :aria-label="wishlist.has(product.slug) ? 'Quitar de favoritos' : 'Agregar a favoritos'">
                {{ wishlist.has(product.slug) ? '♥ En favoritos' : '♡ Agregar a favoritos' }}
              </button>
              <template #fallback>
                <button class="btn outline block pdp-wish" aria-label="Agregar a favoritos">♡ Agregar a favoritos</button>
              </template>
            </ClientOnly>
          </div>

          <div class="trustlist">
            <div class="ti"><span class="e">🔒</span><div><b>Compra Segura</b><p>Pago cifrado y cargo neutral en tu estado de cuenta.</p></div></div>
            <div class="ti"><span class="e">🕵️</span><div><b>100% Discreto</b><p>Caja sin marca y remitente genérico. Nadie sabrá qué contiene.</p></div></div>
            <div class="ti"><span class="e">🚚</span><div><b>Envío Gratis desde $1,000</b><p>Entrega de 3 a 5 días hábiles a todo México.</p></div></div>
            <div class="ti"><span class="e">✅</span><div><b>Body-safe</b><p>Materiales hipoalergénicos, aptos para tu cuerpo.</p></div></div>
            <div class="ti"><span class="e">🛡️</span><div><b>Garantía</b><p>Contra defectos de fábrica por 30 días.</p></div></div>
          </div>
        </div>
      </div>

      <!-- tabs -->
      <div class="tabs">
        <div class="tabnav">
          <button :class="{ active: tab === 'desc' }" @click="tab = 'desc'">Descripción</button>
          <button :class="{ active: tab === 'pol' }" @click="tab = 'pol'">Políticas de Compra</button>
          <button :class="{ active: tab === 'env' }" @click="tab = 'env'">Info de Envíos</button>
          <button :class="{ active: tab === 'gar' }" @click="tab = 'gar'">Garantía</button>
        </div>
        <div class="tabbody">
          <Transition name="tabf" mode="out-in">
            <div v-if="tab === 'desc'" key="desc">
              <p v-for="(par, i) in product.description.split('\n\n')" :key="i">{{ par }}</p>
              <b style="color:var(--purple)">Características:</b>
              <div class="spec-chips">
                <span v-for="f in product.features" :key="f" class="spec-chip"><span class="sc-i">{{ specIcon(f) }}</span>{{ f }}</span>
              </div>
            </div>
            <div v-else-if="tab === 'pol'" key="pol">
              <p>Compra 100% segura. Aceptamos tarjetas, MercadoPago y pago en OXXO. Puedes pagar a 3 meses sin intereses con tarjetas participantes.</p>
              <p>Si tienes dudas antes de comprar, escríbenos por WhatsApp y te orientamos sin juicios.</p>
            </div>
            <div v-else-if="tab === 'env'" key="env">
              <p>Envío 100% discreto a todo México, en empaque neutro sin etiquetas que revelen el contenido.</p>
              <p>Envío gratis en compras desde $1,000. Tiempo de entrega estimado: 3 a 5 días hábiles.</p>
            </div>
            <div v-else key="gar">
              <p>Todos nuestros productos tienen garantía contra defectos de fábrica por 30 días.</p>
              <p>Por higiene, los productos íntimos no admiten devolución una vez abiertos, salvo defecto de fábrica.</p>
            </div>
          </Transition>
        </div>
      </div>

      <!-- reseñas -->
      <section class="reviews-sec" id="resenas">
        <div class="rev-head">
          <h2 v-reveal>Reseñas{{ ratingCount ? ` (${ratingCount})` : '' }}</h2>
          <div v-if="ratingCount" class="rev-avg" v-reveal="{ i: 1 }">
            <span class="stars">{{ stars(Math.round(ratingAvg)) }}</span>
            <b>{{ ratingAvg.toFixed(1) }}</b> <span>de 5</span>
          </div>
        </div>
        <!-- formulario de reseña real -->
        <div class="rev-form">
          <template v-if="reviewUser">
            <b>Deja tu reseña</b>
            <div class="rev-stars-input" role="radiogroup" aria-label="Calificación">
              <button v-for="n in 5" :key="n" type="button" class="rsi" :class="{ on: n <= myRating }" @click="myRating = n" :aria-label="`${n} estrella${n === 1 ? '' : 's'}`">★</button>
            </div>
            <textarea v-model="myText" rows="3" maxlength="600" placeholder="¿Qué te pareció? Ayuda a otrxs a decidir, sin pena."></textarea>
            <button class="btn magenta" :disabled="reviewBusy" @click="submitReview">{{ reviewBusy ? 'Enviando…' : 'Publicar reseña' }}</button>
            <p v-if="reviewMsg" class="rev-msg" :class="{ bad: reviewErr }">{{ reviewMsg }}</p>
          </template>
          <p v-else class="rev-login">¿Compraste este producto? <NuxtLink to="/cuenta">Inicia sesión</NuxtLink> para dejar tu reseña.</p>
        </div>

        <div v-if="ratingCount" class="rev-list">
          <article v-for="(rv, i) in allReviews" :key="i" class="rev-item" v-reveal :data-reveal-index="Math.min(i, 6)">
            <div class="rev-top">
              <span class="rev-who">{{ rv.name }}<span v-if="rv.verified" class="verif">Verificado</span></span>
              <span class="rev-date">{{ fmtReviewDate(rv.date) }}</span>
            </div>
            <div class="stars">{{ stars(rv.rating) }}</div>
            <p>{{ rv.text }}</p>
          </article>
        </div>
        <p v-else class="rev-empty">Aún no hay reseñas de este producto. ¡Sé el primero!</p>
      </section>

      <!-- related -->
      <section class="section" style="padding-top:10px">
        <div class="sec-head" v-reveal><h2>También te puede gustar</h2></div>
        <div class="rail">
          <ProductCard v-for="(p, i) in rel" :key="p.slug" :product="p" v-reveal :data-reveal-index="i" />
        </div>
      </section>

      <!-- barra de compra fija -->
      <ClientOnly>
        <Transition name="sticky">
          <div v-if="showSticky" class="stickybuy">
            <div class="sb-prod">
              <div class="sb-th" :style="{ background: product.bg }">
                <img v-if="product.images?.length" :src="product.images[0]" :alt="product.name">
                <span v-else>{{ product.emoji }}</span>
              </div>
              <div class="sb-info">
                <span class="sb-name">{{ product.name }}</span>
                <span class="sb-meta"><span class="stars">{{ stars(Math.round(ratingAvg)) }}</span> · {{ peso(product.price) }}</span>
              </div>
            </div>
            <button class="btn magenta sb-btn" @click="addToCart">Añadir 🛍️</button>
          </div>
        </Transition>
      </ClientOnly>

      <!-- lightbox de la galería -->
      <ClientOnly>
        <Teleport to="body">
          <Transition name="lb">
            <div v-if="lightbox && product.images?.length" class="lightbox" @click="lightbox = false" role="dialog" aria-modal="true" aria-label="Foto ampliada">
              <button class="lb-x" @click="lightbox = false" aria-label="Cerrar">✕</button>
              <button v-if="product.images.length > 1" class="lb-nav lb-prev" @click.stop="lbStep(-1)" aria-label="Anterior">‹</button>
              <img :src="product.images[Math.min(activeThumb, product.images.length - 1)]" :alt="product.name" class="lb-img" @click.stop>
              <button v-if="product.images.length > 1" class="lb-nav lb-next" @click.stop="lbStep(1)" aria-label="Siguiente">›</button>
              <span v-if="product.images.length > 1" class="lb-count">{{ Math.min(activeThumb, product.images.length - 1) + 1 }} / {{ product.images.length }}</span>
            </div>
          </Transition>
        </Teleport>
      </ClientOnly>
    </template>

    <!-- not found -->
    <div v-else class="emptybox" style="margin:60px 0">
      <div class="e">🤔</div>
      <h3>Producto no encontrado</h3>
      <p style="opacity:.7;margin:8px 0 16px">Puede que ya no esté disponible.</p>
      <NuxtLink to="/tienda" class="btn">Volver a la tienda</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
/* Botón de favoritos del producto principal: estado "en favoritos" en magenta. */
.pdp-wish{gap:8px}
.pdp-wish.liked{background:var(--magenta);color:#fff;box-shadow:inset 0 0 0 2px var(--magenta)}
.pdp-wish.liked:hover{background:var(--magenta);color:#fff}
.pdp-wish.pop{animation:heartpop .32s var(--ease-out)}
</style>
