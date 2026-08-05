<script setup lang="ts">
// `show` permite pedir solo una de las dos bandas. En la ficha de producto el
// banner grande de Aplazo empujaba el producto fuera de la primera pantalla
// (había que hacer scroll para verlo), así que ahí arriba va solo la banda
// delgada de Mercado Pago y el de Aplazo se muestra después de la ficha.
withDefaults(defineProps<{ show?: 'all' | 'mp' | 'aplazo' }>(), { show: 'all' })
</script>

<template>
  <div>
    <div v-if="show !== 'aplazo'" class="mpband">
      <span class="mp">Mercado Pago</span>
      <span class="off">Hasta 15% OFF</span>
      <span>al pagar con Mercado Pago</span>
      <span class="banks">BBVA · HSBC · Amex · Afirme · Inbursa · y más</span>
      <span class="cup">Cupón AMANTI15</span>
    </div>

    <div v-if="show !== 'mp'" class="apband">
      <div class="l">
        <span class="ap">aplazo</span>
        <h2>La mejor temporada<br>para pagar <b>a tu ritmo</b></h2>
        <NuxtLink to="/tienda" class="btn" style="margin-top:10px;background:#fff;color:#111">Comprar</NuxtLink>
      </div>
      <div class="r">
        <div class="big">25% OFF</div>
        <div>en tu primera compra</div>
        <div class="q" style="margin-top:8px">3 quincenas sin intereses</div>
        <div style="font-size:.85rem;opacity:.8">compra mínima $2,000</div>
      </div>
      <span class="code">CÓDIGO: AMANTI25</span>
    </div>
  </div>
</template>
