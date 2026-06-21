<script setup lang="ts">
// Verificación +18. SOLO cliente (tras hydration) para no dañar SSR/SEO:
// el contenido de la página se renderiza normal en SSR; este overlay lo tapa
// visualmente hasta confirmar. No envuelve el contenido de la tienda.
const ageOk = useCookie<string | null>('amanti_age_ok', {
  maxAge: 60 * 60 * 24 * 30, // ~30 días
  sameSite: 'lax',
  path: '/',
})
// Persiste el rechazo para no reiniciar el "No" en cada recarga (registra la decisión negativa).
const ageDeclined = useCookie<string | null>('amanti_age_declined', {
  maxAge: 60 * 60 * 24, // 1 día
  sameSite: 'lax',
  path: '/',
})
const mounted = ref(false)
const declined = ref(false)
// useCookie (destr) puede devolver el número 1; comparamos con String() para ser robustos.
const visible = computed(() => mounted.value && String(ageOk.value) !== '1')

onMounted(() => {
  mounted.value = true
  if (String(ageDeclined.value) === '1') declined.value = true
})

function accept() { ageOk.value = '1'; ageDeclined.value = null }
function decline() { declined.value = true; ageDeclined.value = '1' }

// Bloquea el scroll del body mientras el overlay está visible (solo cliente).
watch(visible, (v) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = v ? 'hidden' : ''
}, { immediate: true })
onBeforeUnmount(() => { if (typeof document !== 'undefined') document.body.style.overflow = '' })
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="ag" role="dialog" aria-modal="true" aria-label="Verificación de edad">
      <div class="ag-box">
        <div class="ag-logo">AMANTI</div>
        <template v-if="!declined">
          <p class="ag-q">Este sitio contiene contenido para adultos.<br>¿Eres mayor de 18 años?</p>
          <div class="ag-btns">
            <button class="ag-yes" @click="accept">Sí, soy mayor de 18</button>
            <button class="ag-no" @click="decline">No</button>
          </div>
          <p class="ag-terms">Al entrar aceptas nuestros <NuxtLink to="/terminos" class="ag-link">Términos</NuxtLink>.</p>
        </template>
        <template v-else>
          <p class="ag-q">Lo sentimos, debes ser mayor de 18 años para acceder a este sitio.</p>
          <button class="ag-no" @click="declined = false">Volver</button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ag {
  position: fixed; inset: 0; z-index: 2000;
  display: flex; align-items: center; justify-content: center; padding: 24px;
  background: rgba(46, 13, 26, .92);
  backdrop-filter: blur(4px);
}
.ag-box {
  background: #5E1B33; color: #fff; border-radius: 16px;
  padding: 40px 32px; max-width: 440px; width: 100%; text-align: center;
  box-shadow: 0 30px 80px -30px rgba(0, 0, 0, .6);
}
.ag-logo {
  font-family: var(--fh, 'Playfair Display', serif);
  font-size: 2rem; font-weight: 700; letter-spacing: 1px; margin-bottom: 18px;
}
.ag-q { font-size: 1.1rem; line-height: 1.5; margin: 0 0 24px; }
.ag-btns { display: flex; flex-direction: column; gap: 12px; }
.ag-yes, .ag-no {
  cursor: pointer; border-radius: 10px; padding: 13px 20px;
  font-weight: 700; font-size: 1rem; font-family: inherit;
}
.ag-yes { background: #E8503A; color: #fff; border: none; }
.ag-yes:hover { background: #d8442f; }
.ag-no { background: transparent; color: #fff; border: 1px solid rgba(255, 255, 255, .55); }
.ag-no:hover { border-color: #fff; }
.ag-terms { font-size: .82rem; opacity: .8; margin: 18px 0 0; }
.ag-link { color: #FFD9CF; text-decoration: underline; }
</style>
