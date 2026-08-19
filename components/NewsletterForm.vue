<script setup lang="ts">
// Formulario de suscripción al newsletter. Vive en GoHighLevel (César, 18-ago):
// los correos se recaban allá porque de ahí salen los flujos de bienvenida,
// carrito abandonado, postcompra y la newsletter de la Eroteca.
//
// Sustituye a los dos puntos de captura que teníamos:
//   · el modal de bienvenida, que guardaba en Supabase (tabla `leads`);
//   · el campo del footer, que solo abría el correo del visitante con un mailto.
// Ninguno de los dos alimentaba a GHL, así que las automatizaciones no tenían
// de dónde disparar.
//
// SOBRE EL SCRIPT DE GHL: el alto que declara el formulario (434) no alcanza
// para su propio contenido —la imagen de cabecera más nombre, correo y botón—,
// así que sin el form_embed.js el botón de enviar queda cortado y nadie puede
// suscribirse. Ese script es justo el que mide el contenido real y le manda el
// alto al iframe. Se carga una sola vez aunque el componente aparezca dos veces
// en la página (modal + footer).
const FORM_ID = '69P88igNWtvW6UeFdWGG'
const EMBED_JS = 'https://link.msgsndr.com/js/form_embed.js'

withDefaults(defineProps<{ height?: number }>(), { height: 620 })

onMounted(() => {
  if (document.querySelector(`script[src="${EMBED_JS}"]`)) return
  const s = document.createElement('script')
  s.src = EMBED_JS
  s.async = true
  document.body.appendChild(s)
})
</script>

<template>
  <iframe
    :src="`https://link.amanti.mx/widget/form/${FORM_ID}`"
    :style="{ height: `${height}px` }"
    class="nlform"
    :id="`inline-${FORM_ID}`"
    :data-layout="JSON.stringify({ id: 'INLINE' })"
    data-trigger-type="alwaysShow"
    data-activation-type="alwaysActivated"
    data-deactivation-type="neverDeactivate"
    data-form-name="Formulario newsletter"
    :data-layout-iframe-id="`inline-${FORM_ID}`"
    :data-form-id="FORM_ID"
    title="Suscríbete al newsletter de AMANTI"
    loading="lazy"
  ></iframe>
</template>

<style scoped>
.nlform { width: 100%; border: none; border-radius: 8px; display: block; }
</style>
