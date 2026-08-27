<script setup lang="ts">
// Pantalla de pedidos para surtir. La usa Nancy, casi siempre desde el teléfono,
// así que está pensada para leerse de un vistazo y copiar la dirección de un
// toque — no para verse bonita en escritorio.
//
// El PIN se guarda en el navegador para no teclearlo cada vez. Es acceso
// compartido, no una cuenta: si se filtra, se cambia la variable en Vercel.
const pin = ref('')
const entrado = ref(false)
const cargando = ref(false)
const error = ref('')
const pedidos = ref<any[]>([])
const soloPendientes = ref(true)

const peso = (n: number) => `$${Number(n || 0).toLocaleString('es-MX')}`

function fecha(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const r = await $fetch<{ pedidos: any[] }>('/api/pedidos', { query: { pin: pin.value } })
    pedidos.value = r.pedidos
    entrado.value = true
    try { localStorage.setItem('amanti_pedidos_pin', pin.value) } catch { /* modo privado */ }
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo entrar.'
    entrado.value = false
  } finally {
    cargando.value = false
  }
}

onMounted(() => {
  try {
    const g = localStorage.getItem('amanti_pedidos_pin')
    if (g) { pin.value = g; cargar() }
  } catch { /* modo privado */ }
})

const visibles = computed(() =>
  soloPendientes.value ? pedidos.value.filter(p => !p.shipped_at) : pedidos.value,
)
const porSurtir = computed(() => pedidos.value.filter(p => !p.shipped_at).length)

/** La dirección en una sola línea, lista para pegar en la guía. */
function direccionTexto(p: any) {
  const d = p.shipping_address
  if (!d?.line1) return ''
  return [
    d.recipient, d.phone, d.line1, d.colonia, d.line2,
    [d.city, d.state].filter(Boolean).join(', '), `C.P. ${d.postal_code}`,
  ].filter(Boolean).join('\n')
}

const copiado = ref('')
async function copiar(p: any) {
  try {
    await navigator.clipboard.writeText(direccionTexto(p))
    copiado.value = p.id
    setTimeout(() => { if (copiado.value === p.id) copiado.value = '' }, 1800)
  } catch { /* sin permiso de portapapeles */ }
}

const guias = ref<Record<string, string>>({})
async function marcar(p: any, deshacer = false) {
  try {
    await $fetch('/api/pedido-enviado', {
      method: 'POST',
      body: { pin: pin.value, orderId: p.id, guia: guias.value[p.id], deshacer },
    })
    await cargar()
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo marcar.'
  }
}

// Fuera de buscadores: esta pantalla lleva nombres, telefonos y domicilios de
// clientes. El robots.txt tambien la excluye, pero el meta es lo que de verdad
// impide que se indexe si alguien llega por un enlace.
useHead({
  title: 'Pedidos — AMANTI',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
definePageMeta({ layout: 'default' })
</script>

<template>
  <section class="wrap ped">
    <h1>Pedidos por surtir</h1>

    <!-- Entrada -->
    <div v-if="!entrado" class="acceso">
      <p>Escribe el PIN para ver los pedidos.</p>
      <input v-model="pin" type="password" inputmode="numeric" placeholder="PIN" @keyup.enter="cargar" />
      <button class="btn magenta" :disabled="cargando || !pin" @click="cargar">
        {{ cargando ? 'Entrando…' : 'Entrar' }}
      </button>
      <p v-if="error" class="err">{{ error }}</p>
    </div>

    <template v-else>
      <div class="barra">
        <span class="cuenta"><b>{{ porSurtir }}</b> por surtir</span>
        <label class="filtro">
          <input v-model="soloPendientes" type="checkbox" />
          <span>Ocultar los ya enviados</span>
        </label>
        <button class="btn mini" :disabled="cargando" @click="cargar">
          {{ cargando ? '…' : 'Actualizar' }}
        </button>
      </div>

      <p v-if="error" class="err">{{ error }}</p>
      <p v-if="!visibles.length" class="vacio">
        {{ soloPendientes ? 'Todo surtido. No hay pedidos pendientes.' : 'Todavía no hay pedidos pagados.' }}
      </p>

      <article v-for="p in visibles" :key="p.id" class="card" :class="{ enviado: p.shipped_at, alerta: p.sinDireccion }">
        <header class="cab">
          <div>
            <span class="fecha">{{ fecha(p.created_at) }}</span>
            <span class="folio">#{{ p.id.slice(0, 8) }}</span>
          </div>
          <span class="monto">{{ peso(p.total) }}</span>
        </header>

        <ul class="arts">
          <li v-for="(it, i) in p.items" :key="i">
            <b>{{ it.quantity }}×</b> {{ it.product_name }}
          </li>
        </ul>

        <!-- Un pedido sin dirección no se puede surtir. Se avisa fuerte para que
             no se descubra hasta el momento de empacar. -->
        <div v-if="p.sinDireccion" class="sin-dir">
          ⚠️ <b>Sin dirección de envío.</b> Hay que pedírsela al cliente antes de mandar nada.
        </div>

        <div v-else class="dir">
          <pre>{{ direccionTexto(p) }}</pre>
          <button class="btn mini" @click="copiar(p)">
            {{ copiado === p.id ? '¡Copiada!' : 'Copiar dirección' }}
          </button>
        </div>

        <!-- El correo va FUERA del bloque que se copia: eso se pega en una guia
             de envio y ahi no pinta nada. Aparte sirve para avisarle al cliente
             si el paquete rebota o falta un dato. -->
        <p v-if="p.shipping_address?.email" class="correo">
          ✉️ <a :href="`mailto:${p.shipping_address.email}`">{{ p.shipping_address.email }}</a>
        </p>

        <div v-if="p.gift?.isGift" class="regalo">
          🎁 <b>Es regalo.</b>
          <span v-if="p.gift.recipient">Para {{ p.gift.recipient }}. </span>
          <span v-if="p.gift.sender">De {{ p.gift.sender }}. </span>
          <em v-if="p.gift.message">“{{ p.gift.message }}”</em>
        </div>

        <footer class="pie">
          <template v-if="!p.shipped_at">
            <input v-model="guias[p.id]" type="text" placeholder="Número de guía (opcional)" maxlength="120" />
            <button class="btn magenta mini" @click="marcar(p)">Marcar enviado</button>
          </template>
          <template v-else>
            <span class="ok">✅ Enviado {{ fecha(p.shipped_at) }}<template v-if="p.tracking"> · guía {{ p.tracking }}</template></span>
            <button class="btn mini" @click="marcar(p, true)">Deshacer</button>
          </template>
        </footer>
      </article>
    </template>
  </section>
</template>

<style scoped>
.ped { padding: 24px 0 60px; max-width: 780px; }
h1 { margin: 0 0 18px; }
.acceso { display: flex; flex-direction: column; gap: 10px; max-width: 280px; }
.acceso input, .pie input { padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; font: inherit; }
.err { color: #B3261E; font-size: .9rem; }
.vacio { opacity: .65; padding: 20px 0; }

.barra { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
.cuenta b { font-size: 1.3rem; }
.filtro { display: flex; align-items: center; gap: 6px; font-size: .88rem; opacity: .8; }

.card { border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; }
.card.enviado { opacity: .55; }
.card.alerta { border-color: #E8A33D; }
.cab { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 8px; }
.fecha { font-size: .84rem; opacity: .7; }
.folio { font-size: .78rem; opacity: .5; margin-left: 8px; }
.monto { font-weight: 600; font-size: 1.05rem; }

.arts { margin: 0 0 10px; padding-left: 18px; font-size: .94rem; }
.sin-dir { background: #FDF3E3; border-radius: 6px; padding: 9px 11px; font-size: .88rem; margin-bottom: 10px; }
.dir { display: flex; align-items: flex-start; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.dir pre { margin: 0; font: inherit; font-size: .9rem; white-space: pre-wrap; background: var(--bg-soft, #F7F3F0); padding: 9px 11px; border-radius: 6px; flex: 1; min-width: 200px; }
.correo { font-size: .86rem; margin: -4px 0 10px; opacity: .8; }
.correo a { color: inherit; }
.regalo { font-size: .88rem; background: #F6EEF6; border-radius: 6px; padding: 8px 11px; margin-bottom: 10px; }

.pie { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 10px; border-top: 1px solid var(--line); }
.pie input { flex: 1; min-width: 160px; font-size: .88rem; }
.btn.mini { padding: 7px 13px; font-size: .84rem; }
.ok { font-size: .88rem; color: #1E7A46; flex: 1; }

@media (max-width: 560px) {
  .dir { flex-direction: column; }
  .dir pre { width: 100%; }
}
</style>
