<script setup lang="ts">
const config = useRuntimeConfig()
const phone = config.public.whatsappPhone
const wa = `https://wa.me/${phone}?text=${encodeURIComponent('¡Hola AMANTI! Tengo una pregunta 💜')}`
useHead({ title: 'Contacto — AMANTI' })

const nombre = ref('')
const correo = ref('')
const mensaje = ref('')
const error = ref('')
const enviado = ref(false)
const acepta = ref(false)
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)

function enviar() {
  error.value = ''
  if (!nombre.value.trim()) { error.value = 'Escribe tu nombre.'; return }
  if (!emailOk(correo.value)) { error.value = 'Escribe un correo válido.'; return }
  if (!mensaje.value.trim()) { error.value = 'Cuéntanos en qué te ayudamos.'; return }
  if (!acepta.value) { error.value = 'Debes aceptar los Términos y el Aviso de Privacidad.'; return }
  const text =
    `¡Hola AMANTI! Soy ${nombre.value.trim()} (${correo.value.trim()}).\n\n${mensaje.value.trim()}`
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  enviado.value = true
}
</script>
<template>
  <PageHeader title="Contáctanos" subtitle="¿Dudas antes de comprar? Te respondemos sin juicios." current="Contacto" />
  <div class="infogrid">
    <div class="infocard" v-reveal :data-reveal-index="0"><div class="e">💬</div><h3>WhatsApp</h3><p>La forma más rápida. Te orientamos para elegir.</p><a :href="wa" target="_blank" rel="noopener">Escríbenos →</a></div>
    <div class="infocard" v-reveal :data-reveal-index="1"><div class="e">✉️</div><h3>Correo</h3><p>Para pedidos, facturación y aclaraciones.</p><a href="mailto:hola@amanti.mx">hola@amanti.mx</a></div>
    <div class="infocard" v-reveal :data-reveal-index="2"><div class="e">🕑</div><h3>Horario</h3><p>Lunes a sábado<br>9:00 – 19:00 hrs</p></div>
  </div>
  <div class="cform">
    <h2 style="text-align:center;margin:14px 0 4px">Envíanos un mensaje</h2>
    <template v-if="!enviado">
      <input v-model="nombre" placeholder="Tu nombre" />
      <input v-model="correo" type="email" placeholder="Tu correo" />
      <textarea v-model="mensaje" placeholder="¿En qué te ayudamos?"></textarea>
      <label class="consent">
        <input type="checkbox" v-model="acepta" />
        <span>Acepto los <NuxtLink to="/terminos">Términos y Condiciones</NuxtLink> y el <NuxtLink to="/privacidad">Aviso de Privacidad</NuxtLink>.</span>
      </label>
      <p v-if="error" style="color:#E8503A;font-size:.9rem;margin:2px 0">{{ error }}</p>
      <button class="btn magenta block" :disabled="!acepta" @click="enviar">Enviar mensaje</button>
      <p style="font-size:.82rem;opacity:.6;text-align:center;margin-top:8px">Tu mensaje se enviará por WhatsApp para una respuesta más rápida.</p>
    </template>
    <div v-else class="note" style="text-align:center">
      <p>¡Gracias, {{ nombre.split(' ')[0] }}! Te contactaremos pronto. 💜</p>
      <p style="font-size:.85rem;opacity:.7">Si no se abrió WhatsApp, escríbenos a <a href="mailto:hola@amanti.mx">hola@amanti.mx</a>.</p>
    </div>
  </div>
</template>

<style scoped>
.consent { display: flex; gap: 9px; align-items: flex-start; font-size: .86rem; margin: 10px 0; line-height: 1.4; text-align: left; }
.consent input { accent-color: #E8503A; width: 22px; height: 22px; margin-top: 0; flex: none; cursor: pointer; }
.consent a { color: #E8503A; text-decoration: underline; }
.btn[disabled] { opacity: .5; cursor: not-allowed; }
</style>
