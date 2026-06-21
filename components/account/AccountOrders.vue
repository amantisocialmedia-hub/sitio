<script setup lang="ts">
// FASE D: historial de pedidos SOLO lectura. orders + order_items del usuario (RLS).
const supabase = useSupabaseClient()

interface Item { product_name: string; quantity: number; unit_price: number; line_total: number; image_url: string | null }
interface Order { id: string; status: string; total: number; created_at: string; order_items: Item[] }

const orders = ref<Order[]>([])
const loading = ref(true)
const err = ref('')
const openIds = reactive(new Set<string>())
let uid = ''

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'amber' }, pendiente: { label: 'Pendiente', cls: 'amber' },
  paid: { label: 'Pagado', cls: 'green' }, pagado: { label: 'Pagado', cls: 'green' },
  shipped: { label: 'Enviado', cls: 'blue' }, enviado: { label: 'Enviado', cls: 'blue' },
  delivered: { label: 'Entregado', cls: 'green' }, entregado: { label: 'Entregado', cls: 'green' },
  cancelled: { label: 'Cancelado', cls: 'red' }, cancelado: { label: 'Cancelado', cls: 'red' },
  refunded: { label: 'Reembolsado', cls: 'gray' }, reembolsado: { label: 'Reembolsado', cls: 'gray' },
}
const statusInfo = (s: string) => STATUS[String(s || '').toLowerCase()] || { label: s || '—', cls: 'gray' }
const folio = (id: string) => '#' + String(id).slice(0, 8).toUpperCase()
function fmtDate(s: string) {
  try { return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(s)) }
  catch { return s }
}
function toggle(id: string) { openIds.has(id) ? openIds.delete(id) : openIds.add(id) }

async function load() {
  loading.value = true; err.value = ''
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { loading.value = false; err.value = 'Tu sesión expiró. Vuelve a iniciar sesión.'; return }
  uid = user.id
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, total, created_at, order_items(product_name, quantity, unit_price, line_total, image_url)')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
  if (error) err.value = 'No se pudieron cargar tus pedidos.'
  else orders.value = (data as Order[]) || []
  loading.value = false
}
// Recarga en cuanto la sesión esté disponible (cubre el asentamiento post-redirect).
const user = useSupabaseUser()
watch(user, (u) => { if (u) load() }, { immediate: true })
</script>

<template>
  <div class="acard">
    <h3>Mis pedidos</h3>

    <p v-if="loading" class="muted">Cargando…</p>
    <p v-else-if="err" class="fmsg bad">{{ err }} <button class="lnk" @click="load">Reintentar</button></p>

    <template v-else>
      <div v-if="!orders.length" class="empty">
        <div class="empty-ic">🛍️</div>
        <p>Aún no tienes pedidos.</p>
        <NuxtLink to="/tienda" class="btn coral">Ir a la tienda</NuxtLink>
      </div>

      <ul v-else class="olist">
        <li v-for="(o, i) in orders" :key="o.id" class="oitem" v-reveal :data-reveal-index="Math.min(i, 6)">
          <button class="ohead" @click="toggle(o.id)">
            <div class="ometa">
              <span class="ofolio">{{ folio(o.id) }}</span>
              <span class="odate">{{ fmtDate(o.created_at) }}</span>
            </div>
            <div class="oright">
              <span class="chip" :class="statusInfo(o.status).cls">{{ statusInfo(o.status).label }}</span>
              <span class="ototal">{{ peso(o.total) }}</span>
              <span class="ochev" :class="{ on: openIds.has(o.id) }">›</span>
            </div>
          </button>

          <div v-if="openIds.has(o.id)" class="odetail">
            <div v-for="(it, i) in o.order_items" :key="i" class="orow">
              <img v-if="it.image_url" :src="it.image_url" :alt="it.product_name" class="othumb" width="44" height="44" />
              <span v-else class="othumb ph">🛍️</span>
              <span class="oname">{{ it.product_name }}</span>
              <span class="oqty">x{{ it.quantity }}</span>
              <span class="ouprice">{{ peso(it.unit_price) }}</span>
              <span class="oline">{{ peso(it.line_total) }}</span>
            </div>
            <p v-if="!o.order_items?.length" class="muted small">Este pedido no tiene artículos.</p>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.acard { background: #fff; border: 1px solid #F0E0D4; border-radius: 12px; padding: 22px; max-width: 640px; }
.acard h3 { color: #5E1B33; margin: 0 0 14px; }
.muted { color: #b9a39a; }
.small { font-size: .85rem; }
.fmsg.bad { background: #FDEAE6; color: #C0341B; border-radius: 9px; padding: 9px 13px; font-size: .9rem; }
.empty { text-align: center; padding: 28px 0; color: #9b8579; }
.empty-ic { font-size: 2.4rem; margin-bottom: 8px; }
.empty p { margin: 0 0 16px; }
.btn.coral { background: #E8503A; color: #fff; border: none; padding: 11px 20px; border-radius: 9px; font-weight: 700; cursor: pointer; text-decoration: none; }
.btn.coral:hover { background: #d8442f; }
.olist { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
.oitem { border: 1px solid #F0E0D4; border-radius: 10px; overflow: hidden; }
.ohead { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 16px; background: #fff; border: none; cursor: pointer; font-family: inherit; flex-wrap: wrap; }
.ometa { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
.ofolio { font-weight: 700; color: #5E1B33; letter-spacing: .3px; }
.odate { font-size: .8rem; color: #9b8579; }
.oright { display: flex; align-items: center; gap: 12px; }
.ototal { font-weight: 700; color: #2e1620; }
.ochev { transition: transform .15s; color: #b9a39a; font-size: 1.2rem; }
.ochev.on { transform: rotate(90deg); }
.chip { border-radius: 999px; padding: 2px 10px; font-size: .74rem; font-weight: 600; }
.chip.amber { background: #FFF4E0; color: #B8791A; }
.chip.green { background: #E9F7EF; color: #1d7a46; }
.chip.blue { background: #EAF1FB; color: #2a5fa8; }
.chip.red { background: #FDEAE6; color: #C0341B; }
.chip.gray { background: #F0EBE7; color: #8a7669; }
.odetail { border-top: 1px solid #F6ECE3; padding: 10px 16px 14px; background: #FCFAF8; }
.orow { display: flex; align-items: center; gap: 10px; padding: 7px 0; font-size: .88rem; border-bottom: 1px solid #F6ECE3; }
.orow:last-child { border-bottom: none; }
.othumb { width: 44px; height: 44px; border-radius: 7px; object-fit: cover; flex: none; }
.othumb.ph { display: grid; place-items: center; background: #F3ECE5; font-size: 1.1rem; }
.oname { flex: 1; color: #5b4a44; }
.oqty { color: #9b8579; }
.ouprice { color: #9b8579; min-width: 70px; text-align: right; }
.oline { font-weight: 600; color: #2e1620; min-width: 80px; text-align: right; }
.lnk { background: none; border: none; cursor: pointer; color: #5E1B33; font-size: .82rem; text-decoration: underline; padding: 2px; }
/* En teléfonos angostos el nombre toma la primera línea y qty/precios envuelven debajo. */
@media (max-width: 480px) {
  .orow { flex-wrap: wrap; row-gap: 2px; }
  .oname { flex: 1 1 100%; }
  .othumb { width: 36px; height: 36px; }
  .oqty, .ouprice, .oline { min-width: 0; }
  .oline { margin-left: auto; }
}
</style>
