<script setup lang="ts">
const config = useRuntimeConfig()
const wa = `https://wa.me/${config.public.whatsappPhone}?text=${encodeURIComponent('¡Hola AMANTI! Tengo una pregunta 💜')}`
useHead({ title: 'Contacto — AMANTI' })
</script>
<template>
  <PageHeader title="Contáctanos" subtitle="¿Dudas antes de comprar? Te respondemos sin juicios." current="Contacto" />
  <div class="infogrid">
    <div class="infocard"><div class="e">💬</div><h3>WhatsApp</h3><p>La forma más rápida. Te orientamos para elegir.</p><a :href="wa" target="_blank" rel="noopener">Escríbenos →</a></div>
    <div class="infocard"><div class="e">✉️</div><h3>Correo</h3><p>Para pedidos, facturación y aclaraciones.</p><a href="mailto:hola@amanti.mx">hola@amanti.mx</a></div>
    <div class="infocard"><div class="e">🕑</div><h3>Horario</h3><p>Lunes a sábado<br>9:00 – 19:00 hrs</p></div>
  </div>
  <div class="cform">
    <h2 style="text-align:center;margin:14px 0 4px">Envíanos un mensaje</h2>
    <input placeholder="Tu nombre" />
    <input type="email" placeholder="Tu correo" />
    <textarea placeholder="¿En qué te ayudamos?"></textarea>
    <button class="btn magenta block">Enviar mensaje</button>
  </div>
</template>
