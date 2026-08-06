<script setup lang="ts">
// El banner de Aplazo se retiró: Raúl pidió quitarlo porque Aplazo no está
// contratado todavía y anunciarlo prometía algo que la tienda no puede cumplir.
// Se conserva la prop `show` para no romper a quien ya la pasa, y para poder
// devolver el banner en cuanto la integración exista.
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
  </div>
</template>
