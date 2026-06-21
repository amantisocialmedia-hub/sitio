<script setup lang="ts">
const route = useRoute()
const cart = useCartStore()
const { bestsellers, peso } = useProducts()
const masVendido = bestsellers()

const loading = ref(false)
const errorMsg = ref('')

const status = computed(() => route.query.status as string | undefined)

onMounted(() => {
  // Tras un pago aprobado, vacía el carrito persistido para que no se re-envíe el mismo pedido.
  if (status.value === 'success') cart.clearCart()
  // Sincroniza precios con el catálogo vigente (== lo que cobra el server).
  else cart.refreshPrices()
})

async function checkout() {
  if ((window as any).fbq) {
    ;(window as any).fbq('track', 'InitiateCheckout', {
      value: cart.totalPrice,
      currency: 'MXN',
      num_items: cart.totalItems,
    })
  }
  errorMsg.value = ''
  loading.value = true
  try {
    const res = await $fetch<{ init_point: string }>('/api/checkout', {
      method: 'POST',
      body: { items: cart.items.map(i => ({ slug: i.slug, name: i.name, price: i.price, quantity: i.quantity })) },
    })
    if (res?.init_point) window.location.href = res.init_point
    else errorMsg.value = 'No se recibió el enlace de pago.'
  } catch (e: any) {
    errorMsg.value = e?.data?.message || 'No se pudo iniciar el pago. Configura MercadoPago o usa WhatsApp.'
  } finally {
    loading.value = false
  }
}
async function orderWhatsApp() {
  const url = cart.whatsappOrderUrl()
  // Abrimos la ventana dentro del gesto del clic para que no la bloquee el navegador.
  const win = window.open('about:blank', '_blank')
  try {
    // Registra el pedido ANTES de abrir WhatsApp ($fetch manda la cookie de sesión si la hay).
    await $fetch('/api/order-whatsapp', {
      method: 'POST',
      body: { items: cart.items.map(i => ({ slug: i.slug, name: i.name, price: i.price, quantity: i.quantity })) },
    })
  } catch (e) {
    // Degrada con gracia: si la escritura falla, el usuario igual manda su pedido.
    console.error('No se pudo registrar el pedido (se abre WhatsApp de todos modos):', e)
  }
  if (win && !win.closed) win.location.href = url
  else window.location.href = url
}

useHead({ title: 'Tu carrito — AMANTI' })
</script>

<template>
  <div class="wrap">
    <div class="benefits">
      <div class="b"><span class="e">🚚</span> Envíos Gratis &gt; $799</div>
      <div class="b"><span class="e">🕵️</span> 100% Discreto</div>
      <div class="b"><span class="e">💳</span> Facilidades de Pago</div>
    </div>
    <PromoBanners />

    <div class="breadcrumb"><NuxtLink to="/">AMANTI</NuxtLink><span class="sep">›</span><span>Tu Carrito</span></div>
    <h1 style="font-size:clamp(1.7rem,4vw,2.4rem);text-transform:uppercase;margin-bottom:6px">Tu Carrito</h1>

    <div v-if="status === 'success'" class="statusmsg ok">✓ ¡Pago aprobado! Gracias por tu compra 💜</div>
    <div v-else-if="status === 'failure'" class="statusmsg bad">El pago no se completó. Intenta de nuevo o escríbenos por WhatsApp.</div>
    <div v-else-if="status === 'pending'" class="statusmsg ok">Tu pago está pendiente de confirmación.</div>

    <!-- empty -->
    <div v-if="cart.isEmpty" class="emptybox" style="margin:30px 0 10px">
      <div class="e">🛒</div>
      <h3>Tu carrito está vacío</h3>
      <p style="opacity:.7;margin:8px 0 16px">Explora la tienda y encuentra algo que te encante.</p>
      <NuxtLink to="/tienda" class="btn">Ir a la tienda</NuxtLink>
    </div>

    <!-- cart -->
    <div v-else class="cartlayout">
      <div>
        <table class="carttable">
          <thead><tr><th>Producto</th><th>Precio</th><th>Cantidad</th><th>Total</th><th></th></tr></thead>
          <tbody>
            <tr v-for="i in cart.items" :key="i.slug">
              <td>
                <div class="citem">
                  <div class="th" :style="{ background: i.bg }">{{ i.emoji }}</div>
                  <div>
                    <div class="nm">{{ i.name }}</div>
                    <div class="br">AMANTI</div>
                  </div>
                </div>
              </td>
              <td data-label="Precio">{{ peso(i.price) }}</td>
              <td data-label="Cantidad">
                <div class="cqty">
                  <button @click="cart.updateQuantity(i.slug, i.quantity - 1)" aria-label="Quitar uno">−</button>
                  <span>{{ i.quantity }}</span>
                  <button @click="cart.updateQuantity(i.slug, i.quantity + 1)" aria-label="Agregar uno">+</button>
                </div>
              </td>
              <td data-label="Total">{{ peso(i.price * i.quantity) }}</td>
              <td class="crm-cell"><button class="crm" @click="cart.removeItem(i.slug)" aria-label="Quitar">✕</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- summary -->
      <aside class="summary">
        <h3>Resumen del Pedido</h3>
        <div class="sline"><span>Subtotal</span><span>{{ peso(cart.totalPrice) }}</span></div>
        <div class="sline"><span>Envío</span><span>{{ cart.totalPrice >= 799 ? 'Gratis' : 'Se calcula al pagar' }}</span></div>
        <div class="sline total"><span>Total</span><span>{{ peso(cart.totalPrice) }}</span></div>

        <div v-if="errorMsg" class="statusmsg bad" style="font-size:.86rem">{{ errorMsg }}</div>

        <button class="btn magenta block" :disabled="loading" @click="checkout">
          {{ loading ? 'Redirigiendo…' : 'Pagar con MercadoPago' }}
        </button>
        <button class="btn wa block" @click="orderWhatsApp">Ordenar por WhatsApp</button>
        <NuxtLink to="/tienda" class="btn light block">Seguir Comprando</NuxtLink>
      </aside>
    </div>

  </div>

  <!-- más vendidos -->
  <section class="section">
    <div class="wrap">
      <div class="sec-head"><h2>Más vendidos</h2></div>
      <div class="rail">
        <ProductCard v-for="p in masVendido" :key="p.slug" :product="p" />
      </div>
    </div>
  </section>
</template>
