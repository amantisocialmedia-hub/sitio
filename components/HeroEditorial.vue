<script setup lang="ts">
import type { Product } from '~/composables/useProducts'
const props = defineProps<{ products?: Product[] }>()
const { peso } = useProducts()
const stars = (r: number) => '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r)
// Tres productos con foto real para las teselas del mosaico.
const show = computed(() => (props.products || []).filter(p => p.images?.length).slice(0, 3))
const tall = computed(() => show.value[0]) // tesela alta derecha · "lo más deseado"
const aProd = computed(() => show.value[1])
const bProd = computed(() => show.value[2])
</script>

<template>
  <section class="hmos-wrap">
    <div class="hmos">
      <!-- Panel titular -->
      <div class="hm-tile hm-head">
        <span class="hm-eyebrow">Sex shop premium · Envío 100% discreto</span>
        <h1 class="hm-title">El placer<br>es <em>tuyo</em>.</h1>
        <span class="hm-script">explóralo sin pena</span>
        <NuxtLink to="/tienda" class="hm-cta">Quiero descubrir →</NuxtLink>
      </div>

      <!-- Panel de cupón -->
      <NuxtLink to="/tienda" class="hm-tile hm-coupon">
        <span class="hm-cup-top">Aquí decimos</span>
        <span class="hm-cup-code">AMANTI15</span>
        <span class="hm-cup-off">tu código para <b>-15%</b> en tu primera compra</span>
        <span class="hm-cup-btn">Aprovechar</span>
      </NuxtLink>

      <!-- Producto A -->
      <NuxtLink v-if="aProd" :to="`/tienda/${aProd.slug}`" class="hm-tile hm-prod hm-a" :style="{ '--spot': aProd.bg }">
        <NuxtImg :src="aProd.images?.[0]" :alt="aProd.name" class="hm-img" format="webp" width="380" height="380" sizes="(max-width:760px) 46vw, 300px" loading="eager" />
        <div class="hm-pinfo"><span class="hm-pname">{{ aProd.name }}</span><span class="hm-pprice">{{ peso(aProd.price) }}</span></div>
      </NuxtLink>

      <!-- Producto B -->
      <NuxtLink v-if="bProd" :to="`/tienda/${bProd.slug}`" class="hm-tile hm-prod hm-b" :style="{ '--spot': bProd.bg }">
        <NuxtImg :src="bProd.images?.[0]" :alt="bProd.name" class="hm-img" format="webp" width="380" height="300" sizes="(max-width:760px) 92vw, 300px" loading="lazy" />
        <div class="hm-pinfo"><span class="hm-pname">{{ bProd.name }}</span><span class="hm-pprice">{{ peso(bProd.price) }}</span></div>
      </NuxtLink>

      <!-- Producto C (alto) -->
      <NuxtLink v-if="tall" :to="`/tienda/${tall.slug}`" class="hm-tile hm-prod hm-c" :style="{ '--spot': tall.bg }">
        <span class="hm-tag">★ Lo más deseado</span>
        <NuxtImg :src="tall.images?.[0]" :alt="tall.name" class="hm-img" format="webp" width="440" height="760" sizes="(max-width:760px) 46vw, 340px" loading="eager" fetchpriority="high" />
        <div class="hm-pinfo">
          <span class="stars">{{ stars(tall.rating) }}</span>
          <span class="hm-pname">{{ tall.name }}</span>
          <span class="hm-pprice">{{ peso(tall.price) }}</span>
        </div>
      </NuxtLink>
    </div>

    <ul class="hm-trust">
      <li>🔒 Pago seguro</li>
      <li>🕵️ Caja sin logo</li>
      <li>⭐ 4.8 · +500 reseñas</li>
      <li>🚚 Gratis desde $799</li>
      <li>↩️ Garantía 3 meses</li>
    </ul>
  </section>
</template>

<style scoped>
.hmos-wrap { max-width: 1240px; margin: 0 auto; padding: 14px 22px 0; }
.hmos {
  display: grid; gap: 14px;
  grid-template-columns: 1.22fr 1fr 1.05fr;
  grid-template-rows: 1.25fr 1fr;
  grid-template-areas:
    "head a tall"
    "coupon b tall";
  height: clamp(440px, 46vw, 560px);
}
.hm-tile { position: relative; border-radius: 20px; overflow: hidden; }

/* Panel titular */
.hm-head {
  grid-area: head; color: #fff; display: flex; flex-direction: column; justify-content: center;
  padding: clamp(22px, 2.4vw, 36px); isolation: isolate;
  background:
    radial-gradient(120% 130% at 85% 12%, rgba(255, 138, 92, .42), transparent 55%),
    linear-gradient(140deg, #44101F 0%, #5E1B33 52%, #8E2B4A 100%);
}
.hm-eyebrow { font-family: var(--fb); font-weight: 700; font-size: .72rem; letter-spacing: .12em; text-transform: uppercase; color: #FFD9CF; }
.hm-title { font-family: var(--fh); font-weight: 800; color: #fff; font-size: clamp(2.1rem, 4vw, 3.7rem); line-height: .98; margin: 12px 0 4px; }
.hm-title em { font-style: italic; color: #FF8A5C; }
.hm-script { font-family: var(--fs); font-size: clamp(1.5rem, 2.4vw, 2.1rem); color: #FF8A5C; line-height: 1; display: block; margin: 0 0 18px; }
.hm-cta {
  align-self: flex-start; background: #fff; color: var(--purple); font-family: var(--fb); font-weight: 700;
  font-size: .95rem; padding: 12px 22px; border-radius: 999px; transition: transform .18s var(--ease-out), box-shadow .18s;
}
.hm-cta:hover { transform: translateY(-3px); box-shadow: 0 16px 30px -16px rgba(0, 0, 0, .5); }

/* Panel de cupón */
.hm-coupon {
  grid-area: coupon; display: flex; flex-direction: column; justify-content: center; color: #fff;
  padding: clamp(20px, 2.2vw, 30px); text-align: left;
  background: linear-gradient(140deg, #FF6A4D, #E8503A 70%, #C0341B);
}
.hm-cup-top { font-family: var(--fs); font-size: 1.4rem; color: #FFE7DF; line-height: 1; }
.hm-cup-code { font-family: var(--fh); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.5rem); letter-spacing: 1px; line-height: 1.05; margin: 2px 0 4px; }
.hm-cup-off { font-size: .92rem; opacity: .95; max-width: 22ch; }
.hm-cup-off b { font-size: 1.05rem; }
.hm-cup-btn { align-self: flex-start; margin-top: 14px; background: #fff; color: var(--magenta); font-family: var(--fb); font-weight: 800; font-size: .9rem; padding: 9px 20px; border-radius: 999px; }

/* Teselas de producto */
.hm-prod { display: block; background: var(--spot, #2a0e18); }
.hm-a { grid-area: a; }
.hm-b { grid-area: b; }
.hm-c { grid-area: tall; }
.hm-img { width: 100%; height: 100%; object-fit: cover; transition: transform .5s var(--ease-out); }
.hm-prod:hover .hm-img { transform: scale(1.06); }
.hm-tag { position: absolute; top: 12px; left: 12px; z-index: 2; background: rgba(255, 255, 255, .92); color: var(--purple); font-family: var(--fb); font-weight: 700; font-size: .72rem; padding: 5px 12px; border-radius: 999px; }
.hm-pinfo {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; padding: 14px;
  display: flex; flex-direction: column; gap: 1px; color: #fff;
  background: linear-gradient(to top, rgba(46, 13, 26, .92), rgba(46, 13, 26, .15) 70%, transparent);
}
.hm-pinfo .stars { color: var(--gold); font-size: .82rem; letter-spacing: 1px; }
.hm-pname { font-family: var(--fh); font-weight: 700; font-size: .98rem; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hm-pprice { font-family: var(--fh); font-weight: 700; font-size: .94rem; }

/* Tira de confianza */
.hm-trust {
  list-style: none; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 26px;
  margin: 16px 0 0; padding: 14px 6px 0; border-top: 1px solid #F0E2D6;
  font-size: .9rem; font-weight: 600; color: var(--purple);
}

/* Modo discreto: difumina las fotos del banner */
:global(html.discreet) .hm-img { filter: blur(12px); transition: filter .25s; }
:global(html.discreet) .hm-pname { filter: blur(6px); transition: filter .25s; }

@media (max-width: 760px) {
  .hmos {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto;
    grid-template-areas:
      "head head"
      "tall a"
      "coupon coupon"
      "b b";
    height: auto;
  }
  .hm-head { padding: 22px 20px 24px; }
  .hm-title { font-size: clamp(1.9rem, 8vw, 2.7rem); margin: 10px 0 4px; }
  .hm-script { font-size: 1.5rem; margin: 0 0 14px; }
  .hm-c, .hm-a { aspect-ratio: 3/4; }
  .hm-b { aspect-ratio: 16/10; }
  .hm-trust { gap: 8px 16px; font-size: .82rem; }
}
@media (max-width: 380px) {
  .hm-title { font-size: 1.6rem; }
}
</style>
