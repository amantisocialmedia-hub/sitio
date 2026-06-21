<script setup lang="ts">
const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth()

type Tab = 'login' | 'register'
const tab = ref<Tab>('login')
const email = ref('')
const password = ref('')
const fullName = ref('')
const phone = ref('')
const acceptedTerms = ref(false)
const busy = ref(false)
const err = ref('')
const ok = ref('')

function mapError(msg?: string) {
  const m = (msg || '').toLowerCase()
  if (m.includes('invalid login')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Tu correo aún no está confirmado. Revisa tu bandeja de entrada (y spam).'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Ese correo ya está registrado. Inicia sesión.'
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('unable to validate email') || m.includes('invalid format')) return 'El correo no tiene un formato válido.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'
  return msg || 'Ocurrió un error. Inténtalo de nuevo.'
}
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)

async function doLogin() {
  err.value = ''; ok.value = ''
  if (!emailOk(email.value)) { err.value = 'Escribe un correo válido.'; return }
  if (!password.value) { err.value = 'Escribe tu contraseña.'; return }
  busy.value = true
  const { error } = await signIn(email.value.trim(), password.value)
  busy.value = false
  if (error) err.value = mapError(error.message)
  // si OK, useSupabaseUser se actualiza y el padre muestra el dashboard
}
async function doRegister() {
  err.value = ''; ok.value = ''
  if (!fullName.value.trim()) { err.value = 'Escribe tu nombre.'; return }
  if (!emailOk(email.value)) { err.value = 'Escribe un correo válido.'; return }
  if (password.value.length < 6) { err.value = 'La contraseña debe tener al menos 6 caracteres.'; return }
  if (!acceptedTerms.value) { err.value = 'Debes aceptar los Términos y el Aviso de Privacidad.'; return }
  busy.value = true
  const { data, error } = await signUp(email.value.trim(), password.value, { full_name: fullName.value.trim(), phone: phone.value.trim() })
  busy.value = false
  if (error) { err.value = mapError(error.message); return }
  if (data?.session) ok.value = '¡Cuenta creada! Ya tienes sesión iniciada.'
  else ok.value = 'Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego inicia sesión.'
}
async function doGoogle() {
  err.value = ''
  busy.value = true
  const { error } = await signInWithGoogle()
  // En éxito la página redirige a Google: dejamos busy=true para no permitir doble clic.
  if (error) { busy.value = false; err.value = mapError(error.message) }
}
async function doReset() {
  err.value = ''; ok.value = ''
  if (!emailOk(email.value)) { err.value = 'Escribe tu correo arriba para enviarte el enlace de recuperación.'; return }
  busy.value = true
  const { error } = await resetPassword(email.value.trim())
  busy.value = false
  if (error) err.value = mapError(error.message)
  else ok.value = 'Si el correo existe, te enviamos un enlace para restablecer tu contraseña.'
}
</script>

<template>
  <div class="auth">
    <div class="auth-tabs">
      <button :class="{ on: tab === 'login' }" @click="tab = 'login'; err = ''; ok = ''">Entrar</button>
      <button :class="{ on: tab === 'register' }" @click="tab = 'register'; err = ''; ok = ''">Crear cuenta</button>
    </div>

    <p v-if="err" class="auth-msg bad">{{ err }}</p>
    <p v-if="ok" class="auth-msg ok">{{ ok }}</p>

    <form v-if="tab === 'login'" class="auth-form" @submit.prevent="doLogin">
      <input v-model="email" type="email" placeholder="Correo" autocomplete="email" />
      <input v-model="password" type="password" placeholder="Contraseña" autocomplete="current-password" />
      <button class="btn coral block" :disabled="busy" type="submit">{{ busy ? 'Entrando…' : 'Iniciar sesión' }}</button>
      <button class="btn link" type="button" @click="doReset">¿Olvidaste tu contraseña?</button>
    </form>

    <form v-else class="auth-form" @submit.prevent="doRegister">
      <input v-model="fullName" placeholder="Nombre completo" autocomplete="name" />
      <input v-model="phone" type="tel" placeholder="Teléfono (opcional)" autocomplete="tel" />
      <input v-model="email" type="email" placeholder="Correo" autocomplete="email" />
      <input v-model="password" type="password" placeholder="Contraseña (mín. 6)" autocomplete="new-password" />
      <label class="consent">
        <input type="checkbox" v-model="acceptedTerms" />
        <span>Acepto los <NuxtLink to="/terminos">Términos y Condiciones</NuxtLink> y el <NuxtLink to="/privacidad">Aviso de Privacidad</NuxtLink>.</span>
      </label>
      <button class="btn coral block" :disabled="busy || !acceptedTerms" type="submit">{{ busy ? 'Creando…' : 'Registrarme' }}</button>
    </form>

    <div class="auth-sep"><span>o</span></div>
    <button class="btn ggl block" :disabled="busy" @click="doGoogle">{{ busy ? 'Conectando…' : 'Continuar con Google' }}</button>
  </div>
</template>

<style scoped>
.auth { max-width: 420px; margin: 0 auto; }
.auth-tabs { display: flex; gap: 0; border: 1px solid #E7D8CC; border-radius: 10px; overflow: hidden; margin-bottom: 18px; }
.auth-tabs button { flex: 1; padding: 12px; background: #fff; border: none; cursor: pointer; font-weight: 600; font-family: inherit; color: #5E1B33; }
.auth-tabs button.on { background: #5E1B33; color: #fff; }
.auth-form { display: grid; gap: 11px; }
.auth-form input[type="email"], .auth-form input[type="password"], .auth-form input[type="tel"], .auth-form input:not([type]) {
  padding: 12px 13px; border: 1px solid #E7D8CC; border-radius: 9px; font-size: .95rem;
}
.auth-form input:focus { outline: none; border-color: #E8503A; }
.btn.block { width: 100%; }
.btn.coral { background: #E8503A; color: #fff; border: none; padding: 12px; border-radius: 9px; font-weight: 700; cursor: pointer; }
.btn.coral:hover { background: #d8442f; }
.btn.coral:disabled { opacity: .5; cursor: not-allowed; }
.btn.ggl { background: #fff; border: 1px solid #5E1B33; color: #5E1B33; padding: 12px; border-radius: 9px; font-weight: 600; cursor: pointer; }
.btn.link { background: none; border: none; color: #E8503A; cursor: pointer; font-size: .85rem; text-decoration: underline; padding: 4px; }
.consent { display: flex; gap: 9px; align-items: flex-start; font-size: .86rem; line-height: 1.4; }
.consent input { accent-color: #E8503A; width: 17px; height: 17px; margin-top: 1px; flex: none; }
.consent a { color: #E8503A; text-decoration: underline; }
.auth-msg { border-radius: 9px; padding: 10px 13px; font-size: .9rem; margin: 0 0 14px; }
.auth-msg.bad { background: #FDEAE6; color: #C0341B; }
.auth-msg.ok { background: #E9F7EF; color: #1d7a46; }
.auth-sep { text-align: center; margin: 16px 0; position: relative; color: #b9a39a; font-size: .85rem; }
.auth-sep::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; border-top: 1px solid #EFE0D4; }
.auth-sep span { background: #fff; padding: 0 12px; position: relative; }
</style>
