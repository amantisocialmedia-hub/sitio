<script setup lang="ts">useHead({ title: 'Formas de pago — AMANTI' })</script>
<template>
  <PageHeader title="Formas de Pago" subtitle="Paga de forma fácil y segura." current="Pagos" />
  <div class="prose">
    <p class="lead">Paga de forma fácil y segura. Estas son tus opciones en AMANTI.</p>
  </div>
  <div class="infogrid infogrid-2">
    <div class="infocard" v-reveal :data-reveal-index="0"><div class="e">💳</div><h3>PayPal</h3><p>Paga con tarjeta de crédito o débito (Visa, Mastercard, American Express) o con tu saldo de PayPal. El cobro lo procesa PayPal con su protección al comprador; nosotros nunca vemos los datos de tu tarjeta.</p></div>
    <div class="infocard" v-reveal :data-reveal-index="1"><div class="e">💬</div><h3>Pedidos por WhatsApp</h3><p>¿Prefieres ordenar con asesoría y sin pena? Escríbenos por WhatsApp: agregamos tus productos, te pasamos el total y coordinamos el pago y el envío contigo, con total discreción.</p></div>
  </div>
  <div class="prose">
    <h2>Seguridad</h2>
    <p>Tus pagos se procesan a través de plataformas certificadas. AMANTI no almacena los datos completos de tu tarjeta.</p>
    <div class="note"><p>¿Dudas con tu pago? Escríbenos por WhatsApp y te ayudamos al instante.</p></div>
  </div>
</template>
