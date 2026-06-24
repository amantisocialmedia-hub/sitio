<script setup lang="ts">
import { FREE_SHIPPING_THRESHOLD } from '~/stores/cart'
const route = useRoute()
const cart = useCartStore()
const { bestsellers, peso } = useProducts()
const masVendido = bestsellers()
const analytics = useAnalytics()

// Umbral de envío gratis (fuente única en el store): barra de progreso motivacional.
const freeLeft = computed(() => cart.freeShippingRemaining)
const freePct = computed(() => Math.min(100, Math.round((cart.totalPrice / FREE_SHIPPING_THRESHOLD) * 100)))

const loading = ref(false)
const errorMsg = ref('')

// --- Cupón de descuento ---
const couponInput = ref('')
const couponBusy = ref(false)
const couponMsg = ref('')   // mensaje de error (el éxito lo muestra el bloque del cupón aplicado)
const couponErr = ref(false)

async function applyCoupon() {
  const code = couponInput.value.trim()
  if (!code) { couponErr.value = true; couponMsg.value = 'Ingresa un código.'; return }
  couponBusy.value = true; couponErr.value = false; couponMsg.value = ''
  try {
    const res = await $fetch<{ valid: boolean; type?: 'percent' | 'fixed'; value?: number; discount: number; message: string }>(
      '/api/coupon-validate',
      { method: 'POST', body: { code, subtotal: cart.totalPrice } },
    )
    if (res.valid && res.type) {
      cart.applyCoupon({ code: code.toUpperCase(), type: res.type, value: res.value || 0, discount: res.discount })
      couponInput.value = ''
      couponMsg.value = ''
    } else {
      couponErr.value = true
      couponMsg.value = res.message || 'Cupón inválido.'
    }
  } catch (e: any) {
    couponErr.value = true
    couponMsg.value = e?.data?.message || 'No se pudo validar el cupón. Intenta más tarde.'
  } finally {
    couponBusy.value = false
  }
}

function removeCoupon() {
  cart.removeCoupon()
  couponMsg.value = ''
  couponErr.value = false
}

// Pulse del total cuando cambia.
const totalPulse = ref(false)
let tp: ReturnType<typeof setTimeout>
watch(() => cart.totalPrice, () => { totalPulse.value = true; clearTimeout(tp); tp = setTimeout(() => (totalPulse.value = false), 420) })

const status = computed(() => route.query.status as string | undefined)

onMounted(() => {
  // Tras un pago aprobado: registra la compra (analítica) y vacía el carrito persistido.
  if (status.value === 'success') {
    if (cart.items.length) analytics.purchase((route.query.order as string) || '', cart.totalPrice, cart.items)
    cart.clearCart()
  }
  // Sincroniza precios con el catálogo vigente (== lo que cobra el server).
  else cart.refreshPrices()
})

async function checkout() {
  analytics.beginCheckout(cart.totalWithDiscount, cart.items)
  errorMsg.value = ''
  loading.value = true
  try {
    const res = await $fetch<{ init_point: string }>('/api/checkout', {
      method: 'POST',
      body: { items: cart.items.map(i => ({ slug: i.slug, name: i.name, price: i.price, quantity: i.quantity })), gift: cart.gift, coupon: cart.coupon?.code },
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
      body: { items: cart.items.map(i => ({ slug: i.slug, name: i.name, price: i.price, quantity: i.quantity })), gift: cart.gift, coupon: cart.coupon?.code },
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
      <div class="b"><span class="e">🚚</span> Envíos Gratis desde $1,000</div>
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
    <div v-if="cart.isEmpty" class="emptybox beat" style="margin:30px 0 10px">
      <div class="e">🛒</div>
      <h3>Tu carrito está vacío</h3>
      <p style="opacity:.7;margin:8px 0 16px">Explora la tienda y encuentra algo que te encante.</p>
      <NuxtLink to="/tienda" class="btn">Ir a la tienda</NuxtLink>
      <p style="opacity:.7;margin:14px 0 0;font-size:.9rem">¿Ya tienes cuenta? <NuxtLink to="/cuenta" style="color:var(--magenta);font-weight:700;text-decoration:underline">Inicia sesión</NuxtLink> para un checkout más rápido.</p>
    </div>

    <!-- cart -->
    <div v-else class="cartlayout">
      <div>
        <table class="carttable">
          <thead><tr><th>Producto</th><th>Precio</th><th>Cantidad</th><th>Total</th><th></th></tr></thead>
          <TransitionGroup name="cartrow" tag="tbody">
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
          </TransitionGroup>
        </table>
      </div>

      <!-- summary -->
      <aside class="summary">
        <h3>Resumen del Pedido</h3>

        <!-- Barra de envío gratis con faltante exacto -->
        <div class="freeship" :class="{ done: freeLeft === 0 }">
          <p class="fs-msg" v-if="freeLeft > 0">Te faltan <b>{{ peso(freeLeft) }}</b> para <b>envío GRATIS</b> 🚚</p>
          <p class="fs-msg" v-else>🎉 ¡Ya tienes <b>envío GRATIS</b>!</p>
          <div class="cd-track"><div class="cd-fill" :style="{ width: freePct + '%' }"></div></div>
        </div>

        <!-- Cupón de descuento -->
        <div class="couponbox">
          <div v-if="cart.coupon" class="coupon-applied">
            <span class="ca-info">✓ Cupón <b>{{ cart.coupon.code }}</b> aplicado</span>
            <button type="button" class="ca-remove" @click="removeCoupon">Quitar</button>
          </div>
          <template v-else>
            <label class="coupon-label" for="coupon">Código de descuento</label>
            <div class="coupon-row">
              <input id="coupon" v-model="couponInput" type="text" placeholder="Ej. AMANTI15"
                     autocapitalize="characters" autocomplete="off" :disabled="couponBusy"
                     @keyup.enter="applyCoupon" aria-label="Código de descuento" />
              <button type="button" class="btn coupon-apply" :disabled="couponBusy || !couponInput.trim()" @click="applyCoupon">
                {{ couponBusy ? '…' : 'Aplicar' }}
              </button>
            </div>
            <p v-if="couponMsg" class="coupon-msg" :class="{ bad: couponErr }">{{ couponMsg }}</p>
          </template>
        </div>

        <div class="sline"><span>Subtotal</span><span>{{ peso(cart.totalPrice) }}</span></div>
        <div v-if="cart.discount > 0" class="sline discount">
          <span>Descuento <b class="cpill">{{ cart.coupon?.code }}</b></span>
          <span class="disc-val">−{{ peso(cart.discount) }}</span>
        </div>
        <div class="sline"><span>Envío</span><span>{{ cart.freeShipping ? 'Gratis' : 'Se calcula al pagar' }}</span></div>
        <div class="sline total"><span>Total</span><span class="totalval" :class="{ pulse: totalPulse }">{{ peso(cart.totalWithDiscount) }}</span></div>

        <!-- Modo regalo -->
        <div class="giftbox">
          <label class="gift-toggle">
            <input type="checkbox" v-model="cart.gift.isGift" />
            <span>🎁 ¿Es un regalo?</span>
          </label>
          <div v-if="cart.gift.isGift" class="gift-fields">
            <p class="gift-note">Llega en caja neutra y sin precios — perfecto para regalar 💜</p>
            <input v-model="cart.gift.recipient" type="text" maxlength="80" placeholder="Para (nombre, opcional)" aria-label="Para" />
            <input v-model="cart.gift.sender" type="text" maxlength="80" placeholder="De (tu nombre, opcional)" aria-label="De" />
            <textarea v-model="cart.gift.message" rows="2" maxlength="280" placeholder="Mensaje de regalo (opcional)" aria-label="Mensaje de regalo"></textarea>
          </div>
        </div>

        <div v-if="errorMsg" class="statusmsg bad" style="font-size:.86rem">{{ errorMsg }}</div>

        <!-- Vence la última objeción: discreción + métodos de pago, pegado al botón -->
        <div class="paytrust">
          <span class="pt-disc">🕵️ Entrega 100% discreta · caja sin logo</span>
          <div class="pay-icons">
            <span class="pi">Visa</span><span class="pi">MC</span><span class="pi">Amex</span>
            <span class="pi">MercadoPago</span><span class="pi">OXXO</span><span class="pi">MSI</span>
          </div>
        </div>

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
