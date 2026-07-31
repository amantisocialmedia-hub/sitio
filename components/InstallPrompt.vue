<script setup lang="ts">
// Banner discreto de "Instalar app". Aparece solo cuando el navegador lo permite
// (Chrome/Edge/Android disparan beforeinstallprompt) y no fue descartado antes.
const { deferred, canInstall } = useInstallPrompt()
const dismissed = ref(false)
const show = computed(() => canInstall.value && !dismissed.value)

onMounted(() => {
  try { dismissed.value = localStorage.getItem('amanti_pwa_dismissed') === '1' } catch {}
})

async function install() {
  const e = deferred.value
  if (!e) return
  e.prompt()
  try { await e.userChoice } catch {}
  deferred.value = null
  canInstall.value = false
}
function dismiss() {
  dismissed.value = true
  try { localStorage.setItem('amanti_pwa_dismissed', '1') } catch {}
}
</script>

<template>
  <ClientOnly>
    <Transition name="pwa">
      <div v-if="show" class="pwa-bar" role="dialog" aria-label="Instalar la app de AMANTI">
        <span class="pwa-ic" aria-hidden="true"></span>
        <div class="pwa-txt">
          <b>Instala AMANTI</b>
          <span>Acceso directo, como una app 💜</span>
        </div>
        <button class="pwa-install" @click="install">Instalar</button>
        <button class="pwa-x" @click="dismiss" aria-label="Cerrar">✕</button>
      </div>
    </Transition>
  </ClientOnly>
</template>

<style scoped>
.pwa-bar {
  position: fixed; left: 12px; right: 12px; z-index: 96; max-width: 440px; margin: 0 auto;
  bottom: calc(204px + env(safe-area-inset-bottom, 0px));
  background: #fff; border: 1px solid #F0E0D4; border-radius: 14px;
  box-shadow: 0 22px 46px -20px rgba(91, 27, 51, .5);
  display: flex; align-items: center; gap: 12px; padding: 11px 12px 11px 16px;
}
.pwa-ic { width: 46px; height: 25px; flex: none; background-color: var(--purple); -webkit-mask: url(/brand/isotipo.svg) no-repeat center/contain; mask: url(/brand/isotipo.svg) no-repeat center/contain; }
.pwa-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
.pwa-txt b { color: var(--purple); font-family: var(--fh); }
.pwa-txt span { font-size: .78rem; color: #9b8579; }
.pwa-install { background: var(--magenta); color: #fff; border: none; border-radius: 9px; padding: 10px 16px; font-weight: 700; font-family: var(--fb); cursor: pointer; flex: none; }
.pwa-x { background: none; border: none; color: #b9a39a; font-size: 1rem; cursor: pointer; width: 36px; height: 36px; flex: none; border-radius: 50%; }
.pwa-x:hover { background: var(--lav2); }
@media (min-width: 1081px) {
  .pwa-bar { right: auto; left: 18px; bottom: 18px; max-width: 360px; margin: 0; }
}
.pwa-enter-active, .pwa-leave-active { transition: opacity .3s ease, transform .3s var(--ease-out); }
.pwa-enter-from, .pwa-leave-to { opacity: 0; transform: translateY(14px); }
@media (prefers-reduced-motion: reduce) { .pwa-enter-active, .pwa-leave-active { transition: opacity .15s; } .pwa-enter-from, .pwa-leave-to { transform: none; } }
</style>
