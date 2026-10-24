<script setup lang="ts">
// El banner de Aplazo se retiró: Raúl pidió quitarlo porque Aplazo no está
// contratado todavía y anunciarlo prometía algo que la tienda no puede cumplir.
// Se conserva la prop `show` para no romper a quien ya la pasa, y para poder
// devolver el banner en cuanto la integración exista.
withDefaults(defineProps<{ show?: 'all' | 'mp' | 'aplazo' }>(), { show: 'all' })
</script>

<template>
  <div>
    <!-- Hasta el 24-oct-2026 esta banda anunciaba el «hasta 15% OFF» de los
         bancos de Mercado Pago. Con PayPal esa promoción no existe: queda el
         cupón, que sí es nuestro. -->
    <div v-if="show !== 'aplazo'" class="mpband">
      <span class="mp">PayPal</span>
      <span class="off">15% OFF</span>
      <span class="sub">con el cupón al pagar</span>
      <span class="banks">Tarjeta de crédito, débito o saldo PayPal</span>
      <span class="cup">Cupón AMANTI15</span>
    </div>
  </div>
</template>
