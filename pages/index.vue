<script setup lang="ts">
const { products, categories, featured, bestsellers, onSale, peso, categoryName } = useProducts()
const novedades = featured().slice(0, 8) // rail curado, no los 55 destacados
const masVendido = bestsellers()
// Más populares: mejor calificados (con desempate por hot/featured) para el carrusel de fotos.
const populares = [...products]
  .sort((a, b) => (b.rating - a.rating) || ((b.hot ? 1 : 0) - (a.hot ? 1 : 0)) || ((b.featured ? 1 : 0) - (a.featured ? 1 : 0)))
  .slice(0, 12)
const special = onSale()[0]
const circleCats = categories
const catImgErr = reactive(new Set<string>())

// Colecciones "por sensación" (puntos de entrada emocionales, no taxonomía).
const moods = [
  { label: 'Primera vez', sub: 'sin nervios', emoji: '🌱', to: '/quiz', grad: 'linear-gradient(150deg,#FF8A5C,#E8503A)' },
  { label: 'Noche de dos', sub: 'para parejas', emoji: '💞', to: '/tienda?cat=parejas', grad: 'linear-gradient(150deg,#8E5BD6,#5E1B33)' },
  { label: 'Modo silencio', sub: 'discreto y mini', emoji: '🤫', to: '/tienda?q=bala', grad: 'linear-gradient(150deg,#0FA38B,#0F94C2)' },
  { label: 'Los que ya saben', sub: 'sin límites', emoji: '🖤', to: '/tienda?cat=bdsm', grad: 'linear-gradient(150deg,#3A2228,#5E1B33)' },
]

// SEO de la home: og/twitter + reafirma título/descripción. El canonical lo pone app.vue.
const config = useRuntimeConfig()
const siteUrl = config.public.siteUrl
useSeoMeta({
  title: 'AMANTI — Sex Shop en línea | Juguetes sexuales discretos en México',
  description:
    'Sex shop en línea en México con entrega 100% discreta. Vibradores, juguetes para parejas, lubricantes y más.',
  ogTitle: 'AMANTI — Sex Shop en línea en México',
  ogDescription:
    'Entrega 100% discreta en todo México. Vibradores, juguetes para parejas, lubricantes y wellness.',
  ogType: 'website',
  ogUrl: `${siteUrl}/`,
  ogImage: `${siteUrl}/og-cover.png`,
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <div class="wrap">
    <HeroEditorial :product="populares[0]" />

    <!-- benefit pills -->
    <div class="benefits">
      <div class="b"><span class="e">🚚</span> Envíos Gratis &gt; $799</div>
      <div class="b"><span class="e">🕵️</span> 100% Discreto</div>
      <div class="b"><span class="e">💳</span> Facilidades de Pago</div>
    </div>

    <!-- Promo de cupones (los descuentos viven en los cupones, no por producto) -->
    <div class="salehero">
      <div class="flame">CUPÓN</div>
      <div class="mid">
        <div class="gd">DESCUENTOS CON CUPÓN</div>
        <div class="pct">HASTA 25% OFF</div>
        <div class="emo">🌙 💞 🌿 🚀 💧</div>
        <div class="valid">Con tus cupones AMANTI15 y AMANTI25 al pagar · solo en línea</div>
      </div>
    </div>

    <PromoBanners />
  </div>

  <!-- welcome -->
  <div class="welcome">
    <h2>Bienvenidx a AMANTI 💜</h2>
    <p>Tu sex shop en línea con entrega 100% discreta en todo México. Juguetes, lubricantes, wellness y más — para mujeres, hombres y parejas.</p>
  </div>

  <!-- mosaic -->
  <section class="section" style="padding-top:40px">
    <div class="wrap">
      <div class="sec-head" v-reveal><h2>Sex toys más populares</h2><NuxtLink to="/tienda" class="link-all">Ver todos</NuxtLink></div>
      <div class="poprail">
        <NuxtLink v-for="(p, i) in populares" :key="p.slug" :to="`/tienda/${p.slug}`" class="popcard" :style="{ background: p.bg }" v-reveal :data-reveal-index="i % 8">
          <NuxtImg v-if="p.images?.length" :src="p.images[0]" :alt="p.name" class="popcard-img" format="webp" width="420" height="540" sizes="(max-width:560px) 78vw, 270px" loading="lazy" />
          <span v-else class="popcard-emo">{{ p.emoji }}</span>
          <div class="popcard-ov">
            <span class="popcard-cat">{{ categoryName(p.category) }}</span>
            <h3>{{ p.name }}</h3>
            <div class="popcard-foot"><span class="popcard-price">{{ peso(p.price) }}</span><span class="popcard-cta">Ver →</span></div>
          </div>
        </NuxtLink>
      </div>
    </div>
  </section>

  <!-- feature -->
  <section class="section" style="padding-top:0">
    <div class="wrap">
      <div class="feature" v-reveal>
        <div>
          <h2>Juguetes de calidad y diseño</h2>
          <NuxtLink to="/tienda" class="btn" style="margin-top:16px;background:#fff;color:var(--purple)">Comprar →</NuxtLink>
        </div>
        <span class="fe">✨</span>
      </div>
    </div>
  </section>

  <!-- circles -->
  <section class="section" style="padding-top:0">
    <div class="wrap">
      <div class="sec-head" v-reveal><h2>Navega nuestra sex shop</h2></div>
      <div class="circles">
        <NuxtLink v-for="(c, i) in circleCats" :key="c.slug" :to="`/tienda?cat=${c.slug}`" class="circle" v-reveal :data-reveal-index="i">
          <div class="c" :class="`cc${i}`"><img v-if="c.image && !catImgErr.has(c.slug)" :src="c.image" :alt="c.name" class="cat-img" @error="catImgErr.add(c.slug)"><template v-else>{{ c.emoji }}</template></div><span>{{ c.name }}</span>
        </NuxtLink>
      </div>
    </div>
  </section>

  <!-- compra por sensación -->
  <section class="section" style="padding-top:0">
    <div class="wrap">
      <div class="sec-head" v-reveal><h2>Compra por lo que buscas</h2></div>
      <div class="moodrow">
        <NuxtLink v-for="(m, i) in moods" :key="m.label" :to="m.to" class="moodcard" :style="{ background: m.grad }" v-reveal :data-reveal-index="i">
          <span class="mc-emo">{{ m.emoji }}</span>
          <span class="mc-label">{{ m.label }}</span>
          <span class="mc-sub">{{ m.sub }}</span>
        </NuxtLink>
      </div>
    </div>
  </section>

  <!-- novedades -->
  <section class="section" style="padding-top:0">
    <div class="wrap">
      <div class="sec-head" v-reveal><h2>Novedades</h2><NuxtLink to="/tienda" class="link-all">Ver todos</NuxtLink></div>
      <div class="rail">
        <ProductCard v-for="(p, i) in novedades" :key="p.slug" :product="p" :is-new="true" v-reveal :data-reveal-index="i" />
      </div>
    </div>
  </section>

  <!-- app banner -->
  <section class="section" style="padding-top:0">
    <div class="wrap">
      <div class="appb" v-reveal>
        <div>
          <h2>Juguetes con App</h2>
          <p style="opacity:.72;margin-top:6px">Contrólalos desde tu celular, estén donde estén.</p>
          <NuxtLink to="/tienda?q=con app" class="btn magenta" style="margin-top:16px">Ver juguetes con app →</NuxtLink>
        </div>
        <span class="ae">📱</span>
      </div>
    </div>
  </section>

  <!-- lo más vendido -->
  <section class="section" style="padding-top:0">
    <div class="wrap">
      <div class="sec-head" v-reveal><h2>Lo más vendido</h2><NuxtLink to="/tienda" class="link-all">Ver todos</NuxtLink></div>
      <div class="rail">
        <ProductCard v-for="(p, i) in masVendido" :key="p.slug" :product="p" v-reveal :data-reveal-index="i" />
      </div>
    </div>
  </section>

  <!-- quiz CTA -->
  <section class="section" style="padding-top:0">
    <div class="wrap">
      <NuxtLink to="/quiz" class="quizband" v-reveal>
        <div class="qb-text">
          <span class="qb-eyebrow">¿No sabes por dónde empezar?</span>
          <h2>Encuentra tu match en 4 preguntas</h2>
          <p>Sin pena, sin tabúes. Te recomendamos tu juguete ideal según lo que buscas.</p>
          <span class="qb-btn">Empezar el quiz ✨</span>
        </div>
        <span class="qb-emo">🔮</span>
      </NuxtLink>
    </div>
  </section>

  <!-- special -->
  <section class="section special" v-if="special">
    <div class="wrap">
      <div class="box" v-reveal>
        <span class="ws">amanti</span>
        <h2>Especial de la semana</h2>
        <span class="se">{{ special.emoji }}</span>
        <p style="opacity:.78;font-weight:600">
          {{ special.name }} —
          <span style="text-decoration:line-through;opacity:.6">{{ peso(special.compareAt) }}</span>
          <span style="color:var(--red);font-weight:800"> {{ peso(special.price) }}</span>
        </p>
        <div style="margin-top:16px"><NuxtLink :to="`/tienda/${special.slug}`" class="btn">Aprovechar →</NuxtLink></div>
      </div>
    </div>
  </section>

  <!-- faq -->
  <section class="section">
    <div class="wrap">
      <div class="sec-head" v-reveal><h2>Preguntas frecuentes</h2></div>
      <div class="faq">
        <details open><summary>¿Hacen entregas discretas en todo México?</summary><p>Sí. Tu pedido llega en empaque neutro, sin marcas ni nada que revele el contenido.</p></details>
        <details><summary>¿Es seguro comprar aquí?</summary><p>Totalmente. Pago seguro con MercadoPago, y también puedes ordenar por WhatsApp con cero juicios.</p></details>
        <details><summary>¿Tienen opciones para principiantes?</summary><p>¡Claro! Revisa el Kit Ritual Completo o escríbenos por WhatsApp y te orientamos sin pena.</p></details>
        <details><summary>¿Puedo regalar un juguete sin que se note qué es?</summary><p>Sí, el empaque es 100% discreto — perfecto para regalar(te).</p></details>
      </div>
    </div>
  </section>


  <!-- reviews -->
  <section class="section reviews">
    <div class="wrap">
      <div class="rev-badge" v-reveal><b>235</b> reseñas verificadas ★★★★★</div>
      <div class="sec-head" style="margin-bottom:24px" v-reveal><h2>Nuestros clientes opinan</h2></div>
      <div class="rev-grid">
        <div class="rev" v-reveal :data-reveal-index="0"><div class="stars">★★★★★</div><p>"La primera vez que compré fue con AMANTI. Calidad excelente y muchas opciones de pago. Llegó súper discreto."</p><span class="who">Sara L.<span class="verif">Verificado</span></span></div>
        <div class="rev" v-reveal :data-reveal-index="1"><div class="stars">★★★★★</div><p>"Pregunté todo por WhatsApp sin pena y me orientaron increíble. 10/10."</p><span class="who">Pau &amp; Dani<span class="verif">Verificado</span></span></div>
        <div class="rev" v-reveal :data-reveal-index="2"><div class="stars">★★★★☆</div><p>"El kit me encantó para empezar. Compré a meses sin intereses, facilísimo."</p><span class="who">Mariana<span class="verif">Verificado</span></span></div>
      </div>
    </div>
  </section>

  <!-- why + manifesto -->
  <section class="section why">
    <div class="wrap">
      <h2 v-reveal>¿Por qué AMANTI?</h2>
      <div class="why-grid">
        <div class="why-i" v-reveal :data-reveal-index="0"><span class="e">🛍️</span><b>Variedad</b><span>Productos para todas las preferencias.</span></div>
        <div class="why-i" v-reveal :data-reveal-index="1"><span class="e">📦</span><b>Discreto</b><span>Llega sin etiquetas que revelen nada.</span></div>
        <div class="why-i" v-reveal :data-reveal-index="2"><span class="e">💬</span><b>Sin juicios</b><span>Te orientamos por WhatsApp.</span></div>
        <div class="why-i" v-reveal :data-reveal-index="3"><span class="e">📚</span><b>Educativo</b><span>Guías y tips para disfrutar mejor.</span></div>
        <div class="why-i" v-reveal :data-reveal-index="4"><span class="e">🇲🇽</span><b>Mexicana</b><span>Hecha por quienes te entienden.</span></div>
      </div>
      <div class="manifesto" v-reveal>
        <h3>Celebramos el placer, sin tabúes.</h3>
        <p>Creemos en explorar con libertad y responsabilidad, en romper la idea de que el placer es algo de qué avergonzarse, y en una sexualidad más libre, sana y feliz — para todxs. Bienvenidx. 💜</p>
      </div>
    </div>
  </section>
</template>
