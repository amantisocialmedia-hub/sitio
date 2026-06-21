<script setup lang="ts">
// Página de "fijar nueva contraseña". El correo de recuperación de Supabase redirige aquí;
// @nuxtjs/supabase consume el token y crea una sesión de recuperación, con la que
// supabase.auth.updateUser({ password }) fija la nueva contraseña.
const supabase = useSupabaseClient()
const user = useSupabaseUser()

useHead({ title: 'Nueva contraseña — AMANTI' })

const password = ref('')
const confirm = ref('')
const busy = ref(false)
const err = ref('')
const ok = ref('')
const ready = ref(false)        // el cliente montó (la sesión de recuperación ya pudo resolverse)
const hasRecovery = ref(false)  // detectamos el evento PASSWORD_RECOVERY de Supabase

let unsub: { subscription?: { unsubscribe: () => void } } | null = null
onMounted(() => {
  ready.value = true
  // onAuthStateChange dispara PASSWORD_RECOVERY cuando se entra por el enlace del correo.
  const { data } = supabase.auth.onAuthStateChange((evt) => {
    if (evt === 'PASSWORD_RECOVERY') hasRecovery.value = true
  })
  unsub = data
})
onBeforeUnmount(() => { unsub?.subscription?.unsubscribe?.() })

// Hay sesión válida para fijar contraseña si llegó el evento de recuperación o ya hay user.
const canSet = computed(() => hasRecovery.value || !!user.value)

async function submit() {
  err.value = ''; ok.value = ''
  if (password.value.length < 6) { err.value = 'La contraseña debe tener al menos 6 caracteres.'; return }
  if (password.value !== confirm.value) { err.value = 'Las contraseñas no coinciden.'; return }
  if (!canSet.value) {
    err.value = 'El enlace de recuperación no es válido o expiró. Solicita uno nuevo desde "¿Olvidaste tu contraseña?".'
    return
  }
  busy.value = true
  const { error } = await supabase.auth.updateUser({ password: password.value })
  busy.value = false
  if (error) {
    const m = (error.message || '').toLowerCase()
    if (m.includes('should be at least')) err.value = 'La contraseña debe tener al menos 6 caracteres.'
    else if (m.includes('same') || m.includes('different from the old')) err.value = 'La nueva contraseña no puede ser igual a la anterior.'
    else if (m.includes('session') || m.includes('expired') || m.includes('token')) err.value = 'Tu enlace de recuperación expiró. Solicita uno nuevo.'
    else err.value = error.message || 'No se pudo actualizar la contraseña.'
    return
  }
  ok.value = 'Contraseña actualizada ✓ Redirigiendo a tu cuenta…'
  setTimeout(() => navigateTo('/cuenta'), 1200)
}
</script>

<template>
  <PageHeader title="Nueva contraseña" subtitle="Elige una contraseña nueva para tu cuenta." current="Recuperar acceso" />

  <div class="np">
    <p v-if="!ready" class="np-loading">Cargando…</p>

    <template v-else>
      <p v-if="err" class="np-msg bad">{{ err }}</p>
      <p v-if="ok" class="np-msg ok">{{ ok }}</p>

      <p v-if="!canSet && !ok" class="np-hint">
        Abre este enlace desde el correo de recuperación. Si ya lo hiciste y ves este mensaje,
        el enlace pudo expirar — vuelve a <NuxtLink to="/cuenta">solicitar uno</NuxtLink>.
      </p>

      <form class="np-form" @submit.prevent="submit">
        <input v-model="password" type="password" placeholder="Nueva contraseña (mín. 6)" autocomplete="new-password" aria-label="Nueva contraseña" />
        <input v-model="confirm" type="password" placeholder="Repite la contraseña" autocomplete="new-password" aria-label="Repetir contraseña" />
        <button class="btn coral block" :disabled="busy" type="submit">{{ busy ? 'Guardando…' : 'Guardar contraseña' }}</button>
      </form>
      <NuxtLink to="/cuenta" class="np-back">← Volver a iniciar sesión</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.np { max-width: 420px; margin: 0 auto 80px; padding: 28px 20px 0; }
.np-loading { color: #b9a39a; text-align: center; padding: 30px 0; }
.np-form { display: grid; gap: 11px; }
.np-form input { padding: 12px 13px; border: 1px solid #E7D8CC; border-radius: 9px; font-size: .95rem; font-family: inherit; }
.np-form input:focus { outline: none; border-color: #E8503A; }
.btn.coral { background: #E8503A; color: #fff; border: none; padding: 12px; border-radius: 9px; font-weight: 700; cursor: pointer; }
.btn.coral:hover { background: #d8442f; }
.btn.coral:disabled { opacity: .5; cursor: not-allowed; }
.btn.block { width: 100%; }
.np-msg { border-radius: 9px; padding: 10px 13px; font-size: .9rem; margin: 0 0 14px; }
.np-msg.bad { background: #FDEAE6; color: #C0341B; }
.np-msg.ok { background: #E9F7EF; color: #1d7a46; }
.np-hint { font-size: .86rem; color: #8a7669; margin: 0 0 14px; line-height: 1.5; }
.np-hint a { color: #E8503A; text-decoration: underline; }
.np-back { display: inline-block; margin-top: 16px; color: #E8503A; font-size: .88rem; text-decoration: underline; }
</style>
