<script setup lang="ts">
// FASE B: perfil editable contra public.profiles (RLS: el usuario solo ve/edita su fila).
// Obtenemos el id del usuario vía supabase.auth.getUser() (fiable tras login, sin
// depender del timing del ref reactivo).
const supabase = useSupabaseClient()

const emailRO = ref('')
const fullName = ref('')
const phone = ref('')
const loading = ref(true)
const saving = ref(false)
const msg = ref('')
const err = ref('')
let uid = ''

async function load() {
  loading.value = true; err.value = ''
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { loading.value = false; err.value = 'Tu sesión expiró. Vuelve a iniciar sesión.'; return }
  uid = user.id
  emailRO.value = user.email || ''
  const { data, error } = await supabase
    .from('profiles')
    .select('email, full_name, phone')
    .eq('id', uid)
    .maybeSingle()
  if (error) {
    err.value = 'No se pudo cargar tu perfil.'
  } else if (data) {
    emailRO.value = (data.email as string) || emailRO.value
    fullName.value = (data.full_name as string) || ''
    phone.value = (data.phone as string) || ''
  }
  loading.value = false
}
onMounted(load)

async function save() {
  msg.value = ''; err.value = ''
  if (!fullName.value.trim()) { err.value = 'Escribe tu nombre.'; return }
  if (phone.value.trim() && !isMxPhone10(phone.value)) { err.value = 'El teléfono debe tener 10 dígitos.'; return }
  if (!uid) return
  saving.value = true
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName.value.trim(),
      phone: phone.value.trim() ? cleanMxPhone(phone.value) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', uid)
  saving.value = false
  if (error) err.value = 'No se pudo guardar. Inténtalo de nuevo.'
  else msg.value = 'Perfil actualizado ✓'
}
</script>

<template>
  <div class="acard">
    <h3>Mi perfil</h3>

    <p v-if="loading" class="muted">Cargando…</p>

    <template v-else>
      <p v-if="msg" class="fmsg ok">{{ msg }}</p>
      <p v-if="err" class="fmsg bad">{{ err }}</p>

      <label class="field">
        <span class="lab">Correo</span>
        <input :value="emailRO" type="email" disabled />
      </label>
      <label class="field">
        <span class="lab">Nombre completo</span>
        <input v-model="fullName" placeholder="Tu nombre" @input="msg = ''" />
      </label>
      <label class="field">
        <span class="lab">Teléfono</span>
        <input v-model="phone" type="tel" placeholder="Tu teléfono (opcional)" @input="msg = ''" />
      </label>

      <button class="btn coral" :disabled="saving" @click="save">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button>
    </template>
  </div>
</template>

<style scoped>
.acard { background: #fff; border: 1px solid #F0E0D4; border-radius: 12px; padding: 22px; max-width: 460px; }
.acard h3 { color: #5E1B33; margin: 0 0 16px; }
.muted { color: #b9a39a; }
.field { display: block; margin-bottom: 14px; }
.field .lab { display: block; font-size: .82rem; color: #9b8579; margin-bottom: 5px; }
.field input { width: 100%; padding: 11px 13px; border: 1px solid #E7D8CC; border-radius: 9px; font-size: .95rem; font-family: inherit; }
.field input:focus { outline: none; border-color: #E8503A; }
.field input:disabled { background: #FAF3EE; color: #8a7669; cursor: not-allowed; }
.btn.coral { background: #E8503A; color: #fff; border: none; padding: 12px 22px; border-radius: 9px; font-weight: 700; cursor: pointer; }
.btn.coral:hover { background: #d8442f; }
.btn.coral:disabled { opacity: .5; cursor: not-allowed; }
.fmsg { border-radius: 9px; padding: 9px 13px; font-size: .9rem; margin: 0 0 14px; }
.fmsg.ok { background: #E9F7EF; color: #1d7a46; }
.fmsg.bad { background: #FDEAE6; color: #C0341B; }
</style>
