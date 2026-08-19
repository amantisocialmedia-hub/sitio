<script setup lang="ts">
// Modal de bienvenida (una sola vez, tras aceptar el age-gate, con delay).
//
// Antes ofrecía el cupón AMANTI15 a cambio del correo y lo guardaba en Supabase
// (tabla `leads`). César pidió (12-ago) dejar solo la invitación a suscribirse,
// sin promoción, y recabar los datos en GoHighLevel, que es de donde salen las
// automatizaciones de correo. El formulario vive en <NewsletterForm>.

// "Ya visto" en COOKIE además de localStorage: los navegadores in-app (WhatsApp/Instagram) y el
// modo privado suelen borrar localStorage entre visitas, por eso el modal "seguía pidiendo el
// correo" aunque ya se hubiera dado (reporte de Raúl, jul-2026). La cookie sobrevive mejor.
const welcomeSeen = useCookie<string | null>('amanti_welcome_seen', {
  maxAge: 60 * 60 * 24 * 180, // ~180 días
  sameSite: 'lax',
  path: '/',
})
// Marca el modal como visto en los dos almacenes (cookie + localStorage).
function markSeen() {
  welcomeSeen.value = '1'
  try { localStorage.setItem('amanti_welcome_seen', '1') } catch {}
}

const show = ref(false)

function close() {
  show.value = false
  markSeen()
}
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }

onMounted(() => {
  window.addEventListener('keydown', onKey)
  // Con que la cookie O localStorage marquen "visto", no se vuelve a mostrar.
  let seen = welcomeSeen.value === '1'
  try { if (localStorage.getItem('amanti_welcome_seen') === '1') seen = true } catch {}
  if (seen) return
  setTimeout(() => {
    const ageOk = document.cookie.includes('amanti_age_ok=1')
    let stillUnseen = welcomeSeen.value !== '1'
    try { if (localStorage.getItem('amanti_welcome_seen') === '1') stillUnseen = false } catch {}
    if (ageOk && stillUnseen) show.value = true
  }, 6000)
})
// Bloquea el scroll del fondo mientras el modal está abierto (igual que CartDrawer/AgeGate).
watch(show, (v) => { if (typeof document !== 'undefined') document.body.style.overflow = v ? 'hidden' : '' })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); if (typeof document !== 'undefined') document.body.style.overflow = '' })
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition name="wmodal">
        <div v-if="show" class="wmodal-wrap" role="dialog" aria-modal="true" aria-label="Bienvenida AMANTI">
          <div class="wmodal-bg" @click="close"></div>
          <div class="wmodal">
            <button class="wm-x" @click="close" aria-label="Cerrar">✕</button>
            <div class="wm-logo" role="img" aria-label="AMANTI"></div>

            <h3>Únete al círculo AMANTI</h3>
            <p class="wm-sub">Novedades, guías de la Eroteca y lo nuevo de la tienda.<br>Cero spam.</p>

            <NewsletterForm />

            <p class="wm-legal">
              Al suscribirte aceptas nuestro
              <NuxtLink to="/privacidad" @click="close">Aviso de Privacidad</NuxtLink>.
            </p>
            <button class="wm-skip" @click="close">No gracias, seguir mirando</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
.wmodal-wrap { position: fixed; inset: 0; z-index: 1800; display: flex; align-items: center; justify-content: center; padding: 22px; }
.wmodal-bg { position: absolute; inset: 0; background: rgba(46, 13, 26, .6); backdrop-filter: blur(3px); }
.wmodal { position: relative; width: 100%; max-width: 420px; max-height: calc(100dvh - 44px); overflow-y: auto; background: #fff; border-radius: 20px; padding: 34px 30px 30px; text-align: center; box-shadow: 0 40px 90px -40px rgba(0, 0, 0, .6); }
.wm-x { position: absolute; top: 12px; right: 14px; background: none; border: none; font-size: 1rem; color: #b9a39a; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; }
.wm-x:hover { background: var(--lav2); color: var(--purple); }
.wm-logo { width: 96px; height: 51px; margin: 0 auto 12px; background-color: var(--purple); -webkit-mask: url(/brand/isotipo.svg) no-repeat center/contain; mask: url(/brand/isotipo.svg) no-repeat center/contain; }
.wmodal h3 { font-size: 1.55rem; margin: 0 0 8px; }
.wm-sub { opacity: .8; font-size: .96rem; line-height: 1.5; margin: 0 0 14px; }
.wm-legal { font-size: .78rem; opacity: .72; margin: 10px 0 0; }
.wm-legal a { color: var(--purple); text-decoration: underline; }
.wm-skip { background: none; border: none; color: #9b8579; font-size: .84rem; cursor: pointer; margin-top: 12px; text-decoration: underline; }
.wmodal-enter-active, .wmodal-leave-active { transition: opacity .3s ease; }
.wmodal-enter-active .wmodal, .wmodal-leave-active .wmodal { transition: transform .35s var(--ease-out); }
.wmodal-enter-from, .wmodal-leave-to { opacity: 0; }
.wmodal-enter-from .wmodal, .wmodal-leave-to .wmodal { transform: translateY(20px) scale(.96); }
@media (prefers-reduced-motion: reduce) { .wmodal-enter-active .wmodal, .wmodal-leave-active .wmodal { transition: none; } }
@media (max-width: 560px) { .wm-x { width: 44px; height: 44px; top: 8px; right: 8px; } }
@media (max-width: 400px) { .wmodal { padding: 28px 18px 22px; } }

/* En pantallas bajas el formulario de GHL ya trae su propia imagen de cabecera
   con el mensaje, así que nuestro encabezado solo repetía lo mismo y empujaba
   el botón de suscribirse fuera de la vista. Se recorta para que el formulario
   empiece arriba. */
@media (max-height: 780px) {
  .wmodal { padding: 22px 18px 18px; }
  .wm-logo { width: 66px; height: 35px; margin-bottom: 6px; }
  .wm-sub { display: none; }
  .wmodal h3 { font-size: 1.2rem; margin-bottom: 10px; }
}
</style>
