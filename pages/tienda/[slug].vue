<script setup lang="ts">
import reviewsData from '~/data/reviews.json'
const route = useRoute()
const config = useRuntimeConfig()
const { getBySlug, related, peso, msi, categoryName } = useProducts()
const cart = useCartStore()

const product = computed(() => getBySlug(route.params.slug as string))

interface Review { name: string; rating: number; date: string; text: string; verified: boolean }
const reviews = computed<Review[]>(() => (product.value ? ((reviewsData as Record<string, Review[]>)[product.value.slug] || []) : []))
const ratingCount = computed(() => reviews.value.length)
const ratingAvg = computed(() =>
  ratingCount.value ? Math.round((reviews.value.reduce((s, r) => s + r.rating, 0) / ratingCount.value) * 10) / 10 : (product.value?.rating ?? 5),
)
function fmtReviewDate(s: string) {
  try { return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s)) } catch { return s }
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

// El componente se reutiliza al navegar entre fichas (related): reinicia el estado por slug
// para no arrastrar cantidad, miniatura, pestaña ni el banner falso de "Agregado".
watch(() => route.params.slug, () => {
  qty.value = 1
  activeThumb.value = 0
  added.value = false
  tab.value = 'desc'
})

const waUrl = computed(() => {
  const p = product.value
  if (!p) return '#'
  const msg = `¡Hola AMANTI! Me interesa el ${p.name} (${peso(p.price)}). ¿Me ayudan? 💜`
  return `https://wa.me/${config.public.whatsappPhone}?text=${encodeURIComponent(msg)}`
})

function addToCart() {
  const p = product.value
  if (!p) return
  cart.addItem({ slug: p.slug, name: p.name, price: p.price, emoji: p.emoji, bg: p.bg }, qty.value)
  added.value = true
}

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
      <PromoBanners />

      <div class="breadcrumb">
        <NuxtLink to="/">AMANTI</NuxtLink><span class="sep">›</span>
        <NuxtLink :to="`/tienda?cat=${product.category}`">{{ categoryName(product.category) }}</NuxtLink>
        <span class="sep">›</span><span>{{ product.name }}</span>
      </div>

      <div class="pdp">
        <!-- gallery -->
        <div class="gallery">
          <div class="main" :style="{ background: product.bg }">
            <Transition name="gfade" mode="out-in">
              <NuxtImg v-if="product.images?.length" :key="activeThumb" :src="product.images[Math.min(activeThumb, product.images.length - 1)]"
                   :alt="product.name" class="gimg" format="webp" width="800" height="800"
                   sizes="(max-width:760px) 100vw, 520px" loading="eager" fetchpriority="high" preload />
              <span v-else class="big">{{ product.emoji }}</span>
            </Transition>
            <span v-if="onSale" class="pbadge">rebaja</span>
          </div>
          <div class="thumbs">
            <template v-if="product.images?.length">
              <div v-for="(img, i) in product.images.slice(0, 4)" :key="img" class="t"
                   :class="{ active: activeThumb === i }" @click="activeThumb = i">
                <NuxtImg :src="img" :alt="`${product.name} ${i + 1}`" class="gimg" format="webp" width="150" height="150" loading="lazy" />
              </div>
            </template>
            <template v-else>
              <div v-for="i in 3" :key="i" class="t" :class="{ active: activeThumb === i - 1 }"
                   :style="{ background: product.bg }" @click="activeThumb = i - 1">{{ product.emoji }}</div>
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
              <span class="pi">AMEX</span><span class="pi">VISA</span><span class="pi">MC</span>
              <span class="pi">MercadoPago</span><span class="pi">OXXO</span>
              <span class="pi">Kueski</span><span class="pi">Aplazo</span>
            </div>
          </div>

          <div class="msi-note">
            <b>3 meses sin intereses</b> de {{ msi(product.price) }} · o paga a tu ritmo con Aplazo
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

          <div class="buyrow">
            <button class="btn magenta block" @click="addToCart">Añadir al carrito 🛍️</button>
            <a :href="waUrl" target="_blank" rel="noopener" class="btn wa block">Pedir por WhatsApp</a>
          </div>

          <div class="trustlist">
            <div class="ti"><span class="e">🔒</span><div><b>Compra Segura</b><p>Protegemos tus datos tanto como tu placer.</p></div></div>
            <div class="ti"><span class="e">🕵️</span><div><b>Discreción</b><p>Empaques sin marca. Nadie sabrá lo que contiene.</p></div></div>
            <div class="ti"><span class="e">🚚</span><div><b>Envío Gratis &gt; $799</b><p>Entrega de 3 a 5 días hábiles a todo México.</p></div></div>
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
              <ul><li v-for="f in product.features" :key="f">{{ f }}</li></ul>
            </div>
            <div v-else-if="tab === 'pol'" key="pol">
              <p>Compra 100% segura. Aceptamos tarjetas, MercadoPago, OXXO, Kueski y Aplazo. Puedes pagar a 3 meses sin intereses o a tu ritmo.</p>
              <p>Si tienes dudas antes de comprar, escríbenos por WhatsApp y te orientamos sin juicios.</p>
            </div>
            <div v-else-if="tab === 'env'" key="env">
              <p>Envío 100% discreto a todo México, en empaque neutro sin etiquetas que revelen el contenido.</p>
              <p>Envío gratis en compras mayores a $799. Tiempo de entrega estimado: 3 a 5 días hábiles.</p>
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
        <div v-if="ratingCount" class="rev-list">
          <article v-for="(rv, i) in reviews" :key="i" class="rev-item" v-reveal :data-reveal-index="Math.min(i, 6)">
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
