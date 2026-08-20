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
// para su propio contenido, así que sin el form_embed.js el botón de enviar
// queda cortado y nadie puede suscribirse. Ese script es justo el que mide el
// contenido real y le manda el alto al iframe. Se carga una sola vez aunque el
// componente aparezca dos veces en la página (modal + footer).
//
// El iframe que manda GHL trae display:none y un trigger "showAfter", pensado
// para un pop-up que ellos mismos disparan. Aquí el iframe ya vive dentro de
// nuestro modal y del pie, así que se deja visible desde el principio: si no,
// dependeríamos de que su script lo revele y el hueco se quedaría en blanco.
// Formulario SIN descuento. El primero que mandó César ofrecía 10% en la
// primera compra —justo lo que él había pedido bajar—, y ese 10% no existía
// como cupón en la tienda: quien se suscribiera esperaba algo que no le
// podíamos cobrar. Lo cambió él mismo (19-ago) por este.
const FORM_ID = 'lrTrIoVrF3bo7kjIUMK8'
// El script del propio dominio de Amanti en GHL, que es el que César usa.
const EMBED_JS = 'https://link.amanti.mx/js/form_embed.js'

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
