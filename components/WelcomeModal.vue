<script setup lang="ts">
// Modal de bienvenida (una sola vez, tras aceptar el age-gate, con delay). Ofrece el cupón
// REAL AMANTI15 a cambio del correo, que se guarda en Supabase (tabla `leads`). Si la tabla
// no existe, el cupón igual se entrega (degrada con gracia). Cierre accesible (Esc/overlay/X).
const supabase = useSupabaseClient()
const COUPON = 'AMANTI15'

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
const done = ref(false)
const email = ref('')
const err = ref('')
const busy = ref(false)
const copied = ref(false)
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)

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

async function submit() {
  err.value = ''
  if (!emailOk(email.value)) { err.value = 'Escribe un correo válido.'; return }
  busy.value = true
  try { await supabase.from('leads').insert({ email: email.value.trim(), source: 'welcome_modal' }) } catch { /* tabla puede no existir aún */ }
  busy.value = false
  markSeen()
  try { localStorage.setItem('amanti_email', email.value.trim()) } catch {}
  done.value = true
}
async function copyCoupon() {
  try { await navigator.clipboard.writeText(COUPON); copied.value = true; setTimeout(() => (copied.value = false), 1800) } catch {}
}
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

            <template v-if="!done">
              <h3>Únete al círculo AMANTI</h3>
              <p class="wm-sub">Déjanos tu correo y te damos <b>15% en tu primera orden</b> 💜<br>Tips, novedades y cero spam.</p>
              <form class="wm-form" @submit.prevent="submit">
                <input v-model="email" type="email" placeholder="Tu correo" autocomplete="email" aria-label="Correo" />
                <button class="btn magenta block" :disabled="busy" type="submit">{{ busy ? 'Un momento…' : 'Quiero mi 15%' }}</button>
              </form>
              <p v-if="err" class="wm-err">{{ err }}</p>
              <button class="wm-skip" @click="close">No gracias, seguir mirando</button>
            </template>

            <template v-else>
              <h3>¡Listo! 🎉</h3>
              <p class="wm-sub">Usa este cupón al pagar:</p>
              <button class="wm-coupon" @click="copyCoupon">{{ COUPON }} <span>{{ copied ? '✓ copiado' : 'copiar' }}</span></button>
              <NuxtLink to="/tienda" class="btn magenta block" @click="close">Empezar a comprar</NuxtLink>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
.wmodal-wrap { position: fixed; inset: 0; z-index: 1800; display: flex; align-items: center; justify-content: center; padding: 22px; }
.wmodal-bg { position: absolute; inset: 0; background: rgba(46, 13, 26, .6); backdrop-filter: blur(3px); }
.wmodal { position: relative; width: 100%; max-width: 420px; background: #fff; border-radius: 20px; padding: 34px 30px 30px; text-align: center; box-shadow: 0 40px 90px -40px rgba(0, 0, 0, .6); }
.wm-x { position: absolute; top: 12px; right: 14px; background: none; border: none; font-size: 1rem; color: #b9a39a; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; }
.wm-x:hover { background: var(--lav2); color: var(--purple); }
.wm-logo { width: 96px; height: 51px; margin: 0 auto 12px; background-color: var(--purple); -webkit-mask: url(/brand/isotipo.svg) no-repeat center/contain; mask: url(/brand/isotipo.svg) no-repeat center/contain; }
.wmodal h3 { font-size: 1.55rem; margin: 0 0 8px; }
.wm-sub { opacity: .8; font-size: .96rem; line-height: 1.5; margin: 0 0 18px; }
.wm-form { display: grid; gap: 10px; }
.wm-form input { padding: 13px 15px; border: 1px solid #E7D8CC; border-radius: 10px; font-size: 1rem; font-family: inherit; }
.wm-form input:focus { outline: none; border-color: var(--magenta); box-shadow: 0 0 0 3px rgba(232, 80, 58, .15); }
.wm-err { color: #C0341B; font-size: .86rem; margin: 8px 0 0; }
.wm-skip { background: none; border: none; color: #9b8579; font-size: .84rem; cursor: pointer; margin-top: 14px; text-decoration: underline; }
.wm-coupon { display: inline-flex; flex-wrap: wrap; justify-content: center; max-width: 100%; align-items: center; gap: 12px; background: var(--lav2); border: 2px dashed var(--magenta); border-radius: 12px; padding: 14px 22px; font-family: var(--fh); font-weight: 800; font-size: 1.4rem; letter-spacing: 2px; color: var(--purple); cursor: pointer; margin: 4px 0 18px; }
.wm-coupon span { font-family: var(--fb); font-size: .74rem; font-weight: 700; letter-spacing: 0; color: var(--magenta); text-transform: uppercase; }
.wmodal-enter-active, .wmodal-leave-active { transition: opacity .3s ease; }
.wmodal-enter-active .wmodal, .wmodal-leave-active .wmodal { transition: transform .35s var(--ease-out); }
.wmodal-enter-from, .wmodal-leave-to { opacity: 0; }
.wmodal-enter-from .wmodal, .wmodal-leave-to .wmodal { transform: translateY(20px) scale(.96); }
@media (prefers-reduced-motion: reduce) { .wmodal-enter-active .wmodal, .wmodal-leave-active .wmodal { transition: none; } }
@media (max-width: 560px) { .wm-x { width: 44px; height: 44px; top: 8px; right: 8px; } }
@media (max-width: 400px) {
  .wmodal { padding: 28px 18px 22px; }
  .wm-coupon { font-size: 1.15rem; letter-spacing: 1px; padding: 12px 16px; gap: 8px; }
}
</style>
