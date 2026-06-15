<script setup lang="ts">
// FASE C: CRUD sobre public.addresses (RLS aísla por user_id). El id sale de getUser().
const supabase = useSupabaseClient()

interface Address {
  id?: string; label: string; recipient: string; phone: string
  line1: string; line2: string; city: string; state: string
  postal_code: string; country: string; is_default: boolean
}
const empty = (): Address => ({
  label: '', recipient: '', phone: '', line1: '', line2: '',
  city: '', state: '', postal_code: '', country: 'MX', is_default: false,
})

const list = ref<Address[]>([])
const loading = ref(true)
const listErr = ref('')
const showForm = ref(false)
const editingId = ref<string | null>(null)
const form = ref<Address>(empty())
const saving = ref(false)
const err = ref('')
const msg = ref('')
let uid = ''

async function load() {
  loading.value = true; listErr.value = ''
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { loading.value = false; listErr.value = 'Tu sesión expiró. Vuelve a iniciar sesión.'; return }
  uid = user.id
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', uid)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
  if (error) listErr.value = 'No se pudieron cargar tus direcciones.'
  else list.value = (data as Address[]) || []
  loading.value = false
}
onMounted(load)

function openAdd() { form.value = empty(); editingId.value = null; err.value = ''; msg.value = ''; showForm.value = true }
function openEdit(a: Address) {
  // Coacciona null→'' (los campos opcionales vienen null del DB) para no romper .trim().
  form.value = {
    label: a.label ?? '', recipient: a.recipient ?? '', phone: a.phone ?? '',
    line1: a.line1 ?? '', line2: a.line2 ?? '', city: a.city ?? '', state: a.state ?? '',
    postal_code: a.postal_code ?? '', country: a.country ?? 'MX', is_default: !!a.is_default,
  }
  editingId.value = a.id || null; err.value = ''; msg.value = ''; showForm.value = true
}
function cancel() { showForm.value = false; err.value = '' }

function validate(): string {
  const f = form.value
  if (!f.line1.trim()) return 'La calle y número (línea 1) es obligatoria.'
  if (!f.city.trim()) return 'La ciudad es obligatoria.'
  if (!f.state.trim()) return 'El estado es obligatorio.'
  if (!/^\d{5}$/.test(f.postal_code.trim())) return 'El código postal debe tener 5 dígitos.'
  if (f.phone.trim() && !isMxPhone10(f.phone)) return 'El teléfono debe tener 10 dígitos.'
  return ''
}

async function save() {
  err.value = ''; msg.value = ''
  const v = validate()
  if (v) { err.value = v; return }
  if (!uid) return
  saving.value = true
  const f = form.value
  const payload = {
    user_id: uid,
    label: f.label.trim() || 'Dirección',
    recipient: f.recipient.trim() || null,
    phone: f.phone.trim() ? cleanMxPhone(f.phone) : null,
    line1: f.line1.trim(),
    line2: f.line2.trim() || null,
    city: f.city.trim(),
    state: f.state.trim(),
    postal_code: f.postal_code.trim(),
    country: (f.country.trim() || 'MX').toUpperCase(),
    is_default: !!f.is_default,
  }
  // Una sola predeterminada: si esta queda como default, apaga las demás.
  if (payload.is_default) {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', uid)
  }
  let error
  if (editingId.value) {
    ({ error } = await supabase.from('addresses').update(payload).eq('id', editingId.value))
  } else {
    ({ error } = await supabase.from('addresses').insert(payload))
  }
  saving.value = false
  if (error) { err.value = 'No se pudo guardar la dirección. Inténtalo de nuevo.'; return }
  showForm.value = false
  await load()
  msg.value = editingId.value ? 'Dirección actualizada ✓' : 'Dirección agregada ✓'
}

async function remove(a: Address) {
  if (!a.id) return
  if (!confirm(`¿Borrar la dirección "${a.label || 'sin nombre'}"? Esta acción no se puede deshacer.`)) return
  const { error } = await supabase.from('addresses').delete().eq('id', a.id)
  if (error) { err.value = 'No se pudo borrar la dirección.'; return }
  await load()
  msg.value = 'Dirección eliminada.'
}

async function makeDefault(a: Address) {
  if (!a.id || !uid) return
  await supabase.from('addresses').update({ is_default: false }).eq('user_id', uid)
  const { error } = await supabase.from('addresses').update({ is_default: true }).eq('id', a.id)
  if (error) { err.value = 'No se pudo marcar como predeterminada.'; return }
  await load()
  msg.value = 'Dirección predeterminada actualizada ✓'
}
</script>

<template>
  <div class="acard">
    <div class="ahead">
      <h3>Mis direcciones</h3>
      <button v-if="!showForm" class="btn coral sm" @click="openAdd">+ Agregar</button>
    </div>

    <p v-if="msg" class="fmsg ok">{{ msg }}</p>
    <p v-if="listErr" class="fmsg bad">{{ listErr }}</p>

    <p v-if="loading" class="muted">Cargando…</p>

    <!-- Formulario -->
    <form v-if="showForm" class="aform" @submit.prevent="save">
      <p v-if="err" class="fmsg bad">{{ err }}</p>
      <div class="grid2">
        <label>Etiqueta<input v-model="form.label" placeholder="Casa, Oficina…" /></label>
        <label>Quién recibe<input v-model="form.recipient" placeholder="Nombre" /></label>
      </div>
      <label>Teléfono<input v-model="form.phone" type="tel" placeholder="10 dígitos" /></label>
      <label>Calle y número *<input v-model="form.line1" placeholder="Av. Siempre Viva 742" /></label>
      <label>Interior / referencias<input v-model="form.line2" placeholder="Depto, colonia, referencias (opcional)" /></label>
      <div class="grid2">
        <label>Ciudad *<input v-model="form.city" placeholder="Ciudad" /></label>
        <label>Estado *<input v-model="form.state" placeholder="Estado" /></label>
      </div>
      <div class="grid2">
        <label>Código postal *<input v-model="form.postal_code" inputmode="numeric" maxlength="5" placeholder="00000" /></label>
        <label>País<input v-model="form.country" maxlength="2" /></label>
      </div>
      <label class="chk"><input type="checkbox" v-model="form.is_default" /> Usar como dirección predeterminada</label>
      <div class="frow">
        <button class="btn coral" :disabled="saving" type="submit">{{ saving ? 'Guardando…' : 'Guardar dirección' }}</button>
        <button class="btn ghost" type="button" @click="cancel">Cancelar</button>
      </div>
    </form>

    <!-- Lista -->
    <template v-else-if="!loading">
      <div v-if="!list.length" class="empty">
        <div class="empty-ic">📦</div>
        <p>Aún no tienes direcciones guardadas.</p>
        <button class="btn coral" @click="openAdd">Agregar mi primera dirección</button>
      </div>

      <ul v-else class="alist">
        <li v-for="a in list" :key="a.id" class="aitem">
          <div class="ainfo">
            <div class="atop">
              <span class="alabel">{{ a.label || 'Dirección' }}</span>
              <span v-if="a.is_default" class="adef">Predeterminada</span>
            </div>
            <p class="aline">{{ a.recipient ? a.recipient + ' · ' : '' }}{{ a.phone || '' }}</p>
            <p class="aline">{{ a.line1 }}<template v-if="a.line2">, {{ a.line2 }}</template></p>
            <p class="aline">{{ a.city }}, {{ a.state }} {{ a.postal_code }} · {{ a.country }}</p>
          </div>
          <div class="aacts">
            <button v-if="!a.is_default" class="lnk" @click="makeDefault(a)">Hacer predeterminada</button>
            <button class="lnk" @click="openEdit(a)">Editar</button>
            <button class="lnk del" @click="remove(a)">Borrar</button>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.acard { background: #fff; border: 1px solid #F0E0D4; border-radius: 12px; padding: 22px; max-width: 620px; }
.ahead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.ahead h3 { color: #5E1B33; margin: 0; }
.muted { color: #b9a39a; }
.btn.coral { background: #E8503A; color: #fff; border: none; padding: 11px 20px; border-radius: 9px; font-weight: 700; cursor: pointer; }
.btn.coral:hover { background: #d8442f; }
.btn.coral:disabled { opacity: .5; cursor: not-allowed; }
.btn.coral.sm { padding: 8px 14px; font-size: .88rem; }
.btn.ghost { background: transparent; border: 1px solid #C9A9B4; color: #5E1B33; padding: 11px 18px; border-radius: 9px; cursor: pointer; font-weight: 600; }
.aform { display: grid; gap: 11px; }
.aform label { display: grid; gap: 5px; font-size: .82rem; color: #9b8579; }
.aform input { padding: 10px 12px; border: 1px solid #E7D8CC; border-radius: 9px; font-size: .95rem; font-family: inherit; color: #2e1620; }
.aform input:focus { outline: none; border-color: #E8503A; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
.chk { flex-direction: row !important; align-items: center; gap: 8px; color: #5E1B33 !important; font-size: .9rem !important; }
.chk input { accent-color: #E8503A; width: 17px; height: 17px; }
.frow { display: flex; gap: 10px; margin-top: 4px; }
.fmsg { border-radius: 9px; padding: 9px 13px; font-size: .9rem; margin: 0 0 12px; }
.fmsg.ok { background: #E9F7EF; color: #1d7a46; }
.fmsg.bad { background: #FDEAE6; color: #C0341B; }
.empty { text-align: center; padding: 28px 0; color: #9b8579; }
.empty-ic { font-size: 2.4rem; margin-bottom: 8px; }
.empty p { margin: 0 0 16px; }
.alist { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
.aitem { border: 1px solid #F0E0D4; border-radius: 10px; padding: 14px 16px; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.atop { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.alabel { font-weight: 700; color: #5E1B33; }
.adef { background: #FFF3EE; color: #E8503A; border: 1px solid #F3C9BE; border-radius: 999px; padding: 1px 9px; font-size: .72rem; font-weight: 600; }
.aline { margin: 1px 0; font-size: .88rem; color: #5b4a44; }
.aacts { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
.lnk { background: none; border: none; cursor: pointer; color: #5E1B33; font-size: .82rem; text-decoration: underline; padding: 2px; }
.lnk.del { color: #C0341B; }
@media (max-width: 480px) { .grid2 { grid-template-columns: 1fr; } .aacts { flex-direction: row; align-items: center; } }
</style>
