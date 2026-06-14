<script setup lang="ts">
// PÁGINA TEMPORAL DE PRUEBA (Etapa 1) — no enlazada en el sitio.
// Sirve para verificar registro / login / Google / reset. /cuenta sigue en "próximamente".
useHead({ title: 'Auth test — AMANTI' })
definePageMeta({ layout: 'default' })

const { user, signUp, signIn, signInWithGoogle, signOut, resetPassword } = useAuth()

const email = ref('')
const password = ref('')
const fullName = ref('')
const phone = ref('')
const msg = ref('')
const err = ref('')
const busy = ref(false)

function show(ok: string, e?: any) {
  busy.value = false
  if (e) { err.value = e.message || String(e); msg.value = '' }
  else { msg.value = ok; err.value = '' }
}
async function doSignUp() {
  busy.value = true; err.value = ''; msg.value = ''
  const { error } = await signUp(email.value, password.value, { full_name: fullName.value, phone: phone.value })
  error ? show('', error) : show('Registro OK. Revisa tu correo si la confirmación está activada.')
}
async function doSignIn() {
  busy.value = true; err.value = ''; msg.value = ''
  const { error } = await signIn(email.value, password.value)
  error ? show('', error) : show('Sesión iniciada.')
}
async function doGoogle() { err.value = ''; const { error } = await signInWithGoogle(); if (error) show('', error) }
async function doReset() {
  busy.value = true
  const { error } = await resetPassword(email.value)
  error ? show('', error) : show('Correo de recuperación enviado (si el email existe).')
}
async function doSignOut() { await signOut(); show('Sesión cerrada.') }
</script>

<template>
  <div class="auth-wrap">
    <h1>Auth test · Etapa 1</h1>
    <p class="hint">Página temporal para probar Supabase Auth. No está enlazada en el sitio.</p>

    <div class="auth-state" :class="{ on: !!user }">
      <strong>Usuario actual:</strong>
      <span v-if="user">{{ user.email }} · <code>{{ user.id }}</code></span>
      <span v-else>— sin sesión —</span>
    </div>

    <div v-if="msg" class="auth-msg ok">{{ msg }}</div>
    <div v-if="err" class="auth-msg bad">{{ err }}</div>

    <div class="auth-grid">
      <input v-model="fullName" placeholder="Nombre completo (registro)" />
      <input v-model="phone" placeholder="Teléfono (registro)" />
      <input v-model="email" type="email" placeholder="Correo" />
      <input v-model="password" type="password" placeholder="Contraseña" />
    </div>

    <div class="auth-btns">
      <button class="btn magenta" :disabled="busy" @click="doSignUp">Registrarme</button>
      <button class="btn" :disabled="busy" @click="doSignIn">Iniciar sesión</button>
      <button class="btn ggl" :disabled="busy" @click="doGoogle">Continuar con Google</button>
      <button class="btn outline" :disabled="busy" @click="doReset">Recuperar contraseña</button>
      <button class="btn light" :disabled="busy" @click="doSignOut">Cerrar sesión</button>
    </div>
  </div>
</template>

<style scoped>
.auth-wrap { max-width: 520px; margin: 40px auto 80px; padding: 0 20px; }
.auth-wrap h1 { color: #5E1B33; font-family: var(--fh, serif); }
.hint { opacity: .65; font-size: .9rem; margin: 4px 0 18px; }
.auth-state { background: #FCF6F0; border: 1px solid #F0E0D4; border-radius: 10px; padding: 12px 14px; font-size: .9rem; }
.auth-state.on { border-color: #E8503A; background: #FFF3EE; }
.auth-state code { font-size: .78rem; opacity: .7; }
.auth-msg { border-radius: 10px; padding: 10px 14px; margin-top: 12px; font-size: .9rem; }
.auth-msg.ok { background: #E9F7EF; color: #1d7a46; }
.auth-msg.bad { background: #FDEAE6; color: #C0341B; }
.auth-grid { display: grid; gap: 10px; margin: 18px 0; }
.auth-grid input { padding: 11px 13px; border: 1px solid #E7D8CC; border-radius: 9px; font-size: .95rem; }
.auth-grid input:focus { outline: none; border-color: #E8503A; }
.auth-btns { display: flex; flex-wrap: wrap; gap: 10px; }
.auth-btns .btn { flex: 1 1 auto; }
.btn.ggl { background: #fff; border: 1px solid #5E1B33; color: #5E1B33; }
</style>
