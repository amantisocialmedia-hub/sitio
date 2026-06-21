<script setup lang="ts">
const consent = useCookie<string | null>('amanti_cookie_consent', {
  maxAge: 60 * 60 * 24 * 180, // ~180 días
  sameSite: 'lax',
  path: '/',
})
const show = ref(false)
// Solo cliente (tras hydration) para no romper SSR ni el SEO.
onMounted(() => { if (!consent.value) show.value = true })

function accept() {
  consent.value = 'accepted'
  show.value = false
  const { $loadTrackers } = useNuxtApp() as any
  if (typeof $loadTrackers === 'function') $loadTrackers()
}
function reject() {
  consent.value = 'rejected'
  show.value = false
}
</script>

<template>
  <div v-if="show" class="cc" role="dialog" aria-label="Consentimiento de cookies">
    <p class="cc-txt">
      Usamos cookies para mejorar tu experiencia y medir el uso del sitio.
      <NuxtLink to="/privacidad" class="cc-link">Más info</NuxtLink>.
    </p>
    <div class="cc-btns">
      <button class="cc-reject" @click="reject">Rechazar</button>
      <button class="cc-accept" @click="accept">Aceptar</button>
    </div>
  </div>
</template>

<style scoped>
.cc {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center; flex-wrap: wrap;
  gap: 14px 22px; padding: 16px 22px;
  background: #FCF6F0; color: #5E1B33;
  border-top: 1px solid #EFE0D4;
  box-shadow: 0 -8px 24px -16px rgba(91, 27, 51, .45);
  font-size: .92rem;
}
.cc-txt { margin: 0; max-width: 640px; line-height: 1.4; }
.cc-link { color: #E8503A; text-decoration: underline; }
.cc-btns { display: flex; gap: 10px; flex: none; }
.cc-accept, .cc-reject {
  cursor: pointer; border-radius: 9px; padding: 10px 20px;
  font-weight: 600; font-size: .9rem; font-family: inherit;
}
.cc-accept { background: #E8503A; color: #fff; border: 1px solid #E8503A; }
.cc-accept:hover { background: #d8442f; }
.cc-reject { background: transparent; color: #5E1B33; border: 1px solid #C9A9B4; }
.cc-reject:hover { border-color: #5E1B33; }
/* En móvil/tablet el BottomNav fijo (62px) está presente: el banner se sienta encima de él
   (y respeta el área segura de iOS). En desktop el BottomNav se oculta (ver main.css), así que
   el banner queda al fondo. */
@media (max-width: 1080px) {
  .cc { bottom: calc(62px + env(safe-area-inset-bottom, 0px)); }
}
@media (max-width: 560px) {
  .cc { flex-direction: column; text-align: center; gap: 12px; }
  .cc-btns { width: 100%; }
  .cc-accept, .cc-reject { flex: 1; }
}
</style>
