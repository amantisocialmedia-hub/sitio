<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const { getBySlug, related, peso, msi, categoryName } = useProducts()
const cart = useCartStore()

const product = computed(() => getBySlug(route.params.slug as string))
const onSale = computed(() => !!product.value?.compareAt && product.value.compareAt > product.value.price)
const pct = computed(() => onSale.value
  ? Math.round((1 - product.value!.price / product.value!.compareAt) * 100) : 0)
const rel = computed(() => product.value ? related(product.value.slug) : [])
const stars = (r: number) => '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r)

const qty = ref(1)
const activeThumb = ref(0)
const added = ref(false)
const tab = ref('desc')

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

useHead(() => ({ title: product.value ? `${product.value.name} — AMANTI` : 'Producto — AMANTI' }))
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
            <NuxtImg v-if="product.images?.length" :src="product.images[Math.min(activeThumb, product.images.length - 1)]"
                 :alt="product.name" class="gimg" format="webp" width="800" height="800"
                 sizes="(max-width:760px) 100vw, 520px" loading="eager" fetchpriority="high" preload />
            <span v-else class="big">{{ product.emoji }}</span>
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
          <div class="stars" style="margin-top:8px">{{ stars(product.rating) }}</div>
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
              <span class="pi">PayPal</span><span class="pi">MercadoPago</span><span class="pi">OXXO</span>
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
          <div v-if="tab === 'desc'">
            <p v-for="(par, i) in product.description.split('\n\n')" :key="i">{{ par }}</p>
            <b style="color:var(--purple)">Características:</b>
            <ul><li v-for="f in product.features" :key="f">{{ f }}</li></ul>
          </div>
          <div v-else-if="tab === 'pol'">
            <p>Compra 100% segura. Aceptamos tarjetas, MercadoPago, OXXO, Kueski y Aplazo. Puedes pagar a 3 meses sin intereses o a tu ritmo.</p>
            <p>Si tienes dudas antes de comprar, escríbenos por WhatsApp y te orientamos sin juicios.</p>
          </div>
          <div v-else-if="tab === 'env'">
            <p>Envío 100% discreto a todo México, en empaque neutro sin etiquetas que revelen el contenido.</p>
            <p>Envío gratis en compras mayores a $799. Tiempo de entrega estimado: 3 a 5 días hábiles.</p>
          </div>
          <div v-else>
            <p>Todos nuestros productos tienen garantía contra defectos de fábrica por 30 días.</p>
            <p>Por higiene, los productos íntimos no admiten devolución una vez abiertos, salvo defecto de fábrica.</p>
          </div>
        </div>
      </div>

      <!-- related -->
      <section class="section" style="padding-top:10px">
        <div class="sec-head"><h2>También te puede gustar</h2></div>
        <div class="rail">
          <ProductCard v-for="p in rel" :key="p.slug" :product="p" />
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
