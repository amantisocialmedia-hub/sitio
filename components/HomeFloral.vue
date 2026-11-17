<script setup lang="ts">
const collections = [
  { title: 'Novedades', to: '#novedades', image: 'collection-0.jpg', alt: 'Rosa Loving Joy sobre un fondo floral rosa' },
  { title: 'Más por descubrir', to: '#categorias', image: 'collection-1.jpg', alt: 'Bolas Kegel moradas con detalles de lavanda' },
  { title: 'Toda la colección', to: '/tienda', image: 'collection-2.jpg', alt: 'Lubricante Sunny Side Up junto a una rosa' },
]
</script>

<template>
  <div class="floral-home">
    <section class="floral-hero" aria-labelledby="floral-title">
      <div class="floral-copy">
        <p class="floral-eyebrow">UN MOMENTO SOLO PARA TI</p>
        <h1 id="floral-title">El arte de<br>consentirte.</h1>
        <p class="floral-intro">Un poco de curiosidad. Mucho por descubrir.</p>
        <NuxtLink to="/tienda" class="floral-cta">Explorar la tienda <span aria-hidden="true">→</span></NuxtLink>
      </div>
      <div class="floral-scene">
        <img class="floral-product-image" src="/home/floral/hero-floral.jpg" alt="Rosa Loving Joy, Pulso Turquesa y OVO S2 entre flores y listones color vino" width="708" height="542" fetchpriority="high">
        <span class="floral-seal">Date<br>un gusto</span>
      </div>
    </section>
    <div class="floral-benefits" aria-label="Beneficios de compra">
      <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="m3 6 9-4 9 4v12l-9 4-9-4zM3 6l9 4 9-4M12 10v12M7 4l10 4v5" /></svg>Envío discreto</span>
      <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M2 5h12v13H2zM14 10h4l4 4v4h-8M4 9h6" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="19" r="2" /></svg>Envío gratis desde $1,000</span>
      <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6zM7 12l3 3 7-7" /></svg>Pago seguro</span>
    </div>
    <section class="floral-collections" aria-labelledby="floral-collections-title">
      <h2 id="floral-collections-title">Encuentra tu próximo favorito</h2>
      <div class="floral-cards">
        <NuxtLink v-for="card in collections" :key="card.title" :to="card.to" class="floral-card">
          <img class="floral-product-image" :src="`/home/floral/${card.image}`" :alt="card.alt" width="718" height="691" loading="lazy">
          <span class="floral-card-title">{{ card.title }}<span aria-hidden="true">→</span></span>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.floral-home{--wine:#710b2a;background:#fff8f0;color:var(--wine)}
.floral-hero{display:grid;grid-template-columns:1fr 1fr;max-width:1600px;margin:auto;background:#f7d0c3;overflow:hidden}
.floral-copy{align-self:center;padding:48px clamp(24px,4vw,68px);position:relative;z-index:1}
.floral-eyebrow{font-size:clamp(10px,1vw,15px);letter-spacing:.24em;margin:0 0 24px}
.floral-copy h1{font-family:Georgia,'Times New Roman',serif;font-size:clamp(44px,6.3vw,100px);font-weight:400;letter-spacing:-.045em;line-height:1.03;margin:0;text-transform:none;color:var(--wine)}
.floral-intro{font-size:clamp(15px,1.6vw,23px);font-style:italic;line-height:1.5;margin:24px 0 32px;max-width:30em}
.floral-cta{display:inline-flex;align-items:center;gap:26px;background:var(--wine);color:#fff8f0;padding:16px 28px;border-radius:50px;font-size:clamp(16px,1.5vw,22px);text-decoration:none}
.floral-cta:hover{background:#511026}
.floral-scene{position:relative;min-width:0;align-self:stretch}
.floral-scene>img{width:100%;height:100%;object-fit:cover;object-position:center;display:block}
.floral-seal{position:absolute;top:22px;left:16px;display:grid;place-content:center;text-align:center;width:90px;height:90px;border-radius:50%;background:#ed6c59;color:white;font:21px/1.15 Georgia,serif;transform:rotate(-9deg)}
.floral-benefits{display:flex;justify-content:center;gap:0;max-width:1400px;margin:auto;padding:24px 18px}
.floral-benefits>span{display:flex;align-items:center;justify-content:center;gap:16px;padding:0 34px;font-size:clamp(14px,1.5vw,20px)}
.floral-benefits>span+span{border-left:1px solid #dfb9aa}
.floral-benefits svg{width:32px;height:32px;flex:none}
.floral-collections{max-width:1500px;padding:16px 28px 40px;margin:auto}
.floral-collections h2{font:400 clamp(27px,3vw,43px)/1.2 Georgia,serif;text-align:center;margin:0 0 28px;color:var(--wine);text-transform:none}
.floral-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.floral-card{position:relative;display:block;overflow:hidden;color:var(--wine);text-decoration:none;background:#f5dcd4}
.floral-card img{display:block;width:100%;height:auto;transition:transform .3s ease}
.floral-card-title{position:absolute;top:22px;left:22px;right:22px;display:flex;justify-content:space-between;gap:8px;font:400 clamp(16px,1.8vw,27px)/1.3 Georgia,serif}
.floral-card:hover img{transform:scale(1.025)}
.floral-card:focus-visible,.floral-cta:focus-visible{outline:3px solid #710b2a;outline-offset:5px}
:global(html.discreet) .floral-product-image{filter:blur(12px)}
@media(max-width:900px){.floral-benefits>span{padding:0 18px;gap:8px}.floral-seal{width:68px;height:68px;font-size:17px;top:12px;left:10px}.floral-copy{padding:34px 24px}.floral-card-title{top:16px;left:14px;right:14px}}
@media(max-width:640px){
 .floral-hero{grid-template-columns:1fr}.floral-copy{padding:32px 24px 30px;text-align:center}.floral-copy h1{font-size:clamp(48px,12vw,72px)}
 .floral-eyebrow{font-size:10px;margin-bottom:16px}.floral-intro{margin:18px auto 22px;font-size:16px}.floral-cta{padding:14px 24px}
 .floral-scene{aspect-ratio:708/542}.floral-scene>img{object-fit:contain}.floral-seal{width:76px;height:76px;font-size:19px;left:20px;top:18px}
 .floral-benefits{padding:18px 12px;gap:12px;flex-wrap:wrap}.floral-benefits>span{font-size:12px;padding:0;gap:5px}.floral-benefits>span+span{border:0}.floral-benefits svg{width:23px;height:23px}
 .floral-collections{padding:20px 16px 28px}.floral-collections h2{font-size:29px;margin-bottom:22px}.floral-cards{grid-template-columns:1fr;gap:16px}
 .floral-card{max-width:460px;width:100%;margin:auto}.floral-card-title{font-size:25px;top:22px;left:22px;right:22px}
}
@media(prefers-reduced-motion:reduce){.floral-card img{transition:none}.floral-card:hover img{transform:none}}
</style>

