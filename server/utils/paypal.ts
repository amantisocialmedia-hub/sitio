// Cliente mínimo de la API REST de PayPal (Checkout Orders v2), sin SDK.
//
// POR QUÉ PAYPAL: Raúl y Nancy lo pidieron el 02-oct-2026 («cambiar la pasarela
// de pago a paypal») y el equipo nuevo de AMANTI mandó su cuenta el 21-oct-2026.
// Mercado Pago se queda en el código, apagado con NUXT_PUBLIC_PASARELA, para
// poder regresar sin tocar código si hiciera falta.
//
// POR QUÉ SIN SDK: son cuatro llamadas HTTP y el SDK oficial de PayPal para
// Node está deprecado. Menos dependencias, menos sorpresas en Vercel.
//
// La parte PURA (armar montos, mapear estados, leer respuestas) vive aquí y se
// prueba con vitest. Lo que toca Supabase está en paypalPedido.ts.
import { createError } from 'h3'
import type { EnvioInfo } from './envio'

export type AmbientePaypal = 'live' | 'sandbox'

const API: Record<AmbientePaypal, string> = {
  live: 'https://api-m.paypal.com',
  sandbox: 'https://api-m.sandbox.paypal.com',
}

/**
 * Qué ambiente usar. NUXT_PAYPAL_ENV manda: 'live' o 'sandbox'.
 *
 * Sin valor, en el deploy de PRODUCCIÓN de Vercel se asume live: un sandbox ahí
 * mandaría a los clientes a una pantalla de pruebas donde su dinero no vale, y
 * nadie se enteraría hasta que alguien se queje. En local y en previews,
 * sandbox: así nadie cobra de verdad por accidente mientras prueba.
 */
export function ambientePaypal(valor: unknown, env: Record<string, string | undefined> = process.env): AmbientePaypal {
  const v = String(valor ?? '').trim().toLowerCase()
  if (v === 'live' || v === 'production' || v === 'prod') return 'live'
  if (v === 'sandbox' || v === 'test') return 'sandbox'
  return env.VERCEL_ENV === 'production' ? 'live' : 'sandbox'
}

export function baseApiPaypal(ambiente: AmbientePaypal): string {
  return API[ambiente]
}

export interface ConfigPaypal {
  clientId: string
  clientSecret: string
  ambiente: AmbientePaypal
  /** Id del webhook registrado en el panel de PayPal. Sin él no se valida la firma. */
  webhookId: string
}

/** Lee la configuración del runtimeConfig de Nuxt. Lanza 400 si falta lo esencial. */
export function leerConfigPaypal(config: any): ConfigPaypal {
  const clientId = String(config?.paypalClientId || '').trim()
  const clientSecret = String(config?.paypalClientSecret || '').trim()
  if (!clientId || !clientSecret) {
    throw createError({
      statusCode: 400,
      statusMessage: 'PayPal config missing',
      message: 'Falta configurar PayPal (NUXT_PAYPAL_CLIENT_ID y NUXT_PAYPAL_CLIENT_SECRET).',
    })
  }
  return {
    clientId,
    clientSecret,
    ambiente: ambientePaypal(config?.paypalEnv),
    webhookId: String(config?.paypalWebhookId || '').trim(),
  }
}

// ---------------------------------------------------------------------------
// Token de acceso (client credentials). Se cachea en memoria del proceso: en
// Vercel una misma instancia atiende varias peticiones y el token dura ~9 h.
// ---------------------------------------------------------------------------
let cacheToken: { llave: string; token: string; expira: number } | null = null

export async function tokenPaypal(cfg: ConfigPaypal): Promise<string> {
  const llave = `${cfg.ambiente}:${cfg.clientId}`
  if (cacheToken && cacheToken.llave === llave && cacheToken.expira > Date.now() + 60_000) return cacheToken.token
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')
  const r = await $fetch<{ access_token: string; expires_in: number }>(`${baseApiPaypal(cfg.ambiente)}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  cacheToken = { llave, token: r.access_token, expira: Date.now() + (Number(r.expires_in) || 300) * 1000 }
  return r.access_token
}

function cabeceras(token: string, requestId?: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
  }
}

// ---------------------------------------------------------------------------
// Montos. Todo en CENTAVOS enteros: PayPal rechaza la orden entera si la suma
// del desglose no cuadra al centavo con el total, y los floats no cuadran.
// ---------------------------------------------------------------------------
export const centavos = (n: number) => Math.round((Number(n) || 0) * 100)
export const montoTexto = (c: number) => (c / 100).toFixed(2)
const MXN = (c: number) => ({ currency_code: 'MXN', value: montoTexto(c) })
const recorta = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

/** Lo que PayPal necesita saber de un pedido ya creado en Supabase. */
export interface PedidoParaPaypal {
  id: string
  total: number
  items: { name: string; unitPrice: number; quantity: number }[]
  discount: number
  shippingCost: number
  shippingAddress: EnvioInfo | null
}

/** La dirección del carrito en el formato de PayPal, o undefined si no está completa. */
export function direccionPaypal(e: EnvioInfo | null | undefined) {
  if (!e?.line1 || !e.postal_code) return undefined
  const extra = [e.colonia, e.line2].filter(Boolean).join(', ')
  const pais = /^[A-Z]{2}$/.test(String(e.country || '')) ? String(e.country) : 'MX'
  return {
    ...(e.recipient ? { name: { full_name: recorta(e.recipient, 300) } } : {}),
    address: {
      address_line_1: recorta(e.line1, 300),
      ...(extra ? { address_line_2: recorta(extra, 300) } : {}),
      ...(e.city ? { admin_area_2: recorta(e.city, 120) } : {}),
      ...(e.state ? { admin_area_1: recorta(e.state, 300) } : {}),
      postal_code: recorta(e.postal_code, 60),
      country_code: pais,
    },
  }
}

/**
 * La purchase_unit de la orden de PayPal.
 *
 * Igual que con Mercado Pago, los precios son los AUTORITATIVOS que ya resolvió
 * el servidor, y la suma de lo que se manda DEBE dar exactamente order.total:
 * si no, se cobra distinto de lo que dice el pedido.
 *
 * Con desglose (renglón por producto + envío + descuento) el cliente ve en
 * PayPal qué está pagando. Si por un redondeo raro el desglose no cuadra al
 * centavo, se manda solo el total: PayPal rechazaría la orden entera y el
 * cliente se quedaría sin poder pagar. El detalle por producto vive de todos
 * modos en order_items, ligado por custom_id = order.id.
 */
export function armarPurchaseUnit(order: PedidoParaPaypal, opts: { conDireccion?: boolean } = {}) {
  const totalC = centavos(order.total)
  const envioC = centavos(order.shippingCost)
  const descC = centavos(order.discount)
  const itemsC = order.items.reduce((s, i) => s + centavos(i.unitPrice) * i.quantity, 0)
  const cuadra = itemsC + envioC - descC === totalC && totalC > 0

  const folio = String(order.id).slice(0, 8).toUpperCase()
  const unit: any = {
    reference_id: order.id,
    // custom_id regresa en cada captura, reembolso y webhook: es el hilo que
    // une lo que pasa en PayPal con el pedido de Supabase.
    custom_id: order.id,
    description: recorta(`Pedido AMANTI #${folio}`, 127),
    // Lo que sale en el estado de cuenta de la tarjeta (máx. 22).
    soft_descriptor: 'AMANTI',
    amount: cuadra
      ? {
          ...MXN(totalC),
          breakdown: {
            item_total: MXN(itemsC),
            ...(envioC > 0 ? { shipping: MXN(envioC) } : {}),
            ...(descC > 0 ? { discount: MXN(descC) } : {}),
          },
        }
      : MXN(totalC),
  }
  if (cuadra) {
    unit.items = order.items.map((i) => ({
      name: recorta(i.name, 127) || 'Producto',
      quantity: String(i.quantity),
      unit_amount: MXN(centavos(i.unitPrice)),
      category: 'PHYSICAL_GOODS',
    }))
  }
  if (opts.conDireccion !== false) {
    const shipping = direccionPaypal(order.shippingAddress)
    if (shipping) unit.shipping = shipping
  }
  return unit
}

export interface CompradorPaypal { email?: string; nombre?: string; apellido?: string }

/** El cuerpo completo de POST /v2/checkout/orders. Puro, para poder probarlo. */
export function armarOrdenPaypal(params: {
  order: PedidoParaPaypal
  comprador?: CompradorPaypal
  returnUrl: string
  cancelUrl: string
  conDireccion?: boolean
}) {
  const unit = armarPurchaseUnit(params.order, { conDireccion: params.conDireccion })
  const c = params.comprador
  return {
    intent: 'CAPTURE',
    purchase_units: [unit],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: 'AMANTI',
          locale: 'es-MX',
          // Abre directo el formulario de tarjeta, sin pedir iniciar sesión en
          // PayPal (AMANTI lo pidió el 27/10). Quien tenga cuenta puede entrar
          // desde ahí. Requiere «Pago como usuario no registrado» activado en
          // su cuenta de PayPal; si se apaga, PayPal vuelve a pedir el login.
          landing_page: 'GUEST_CHECKOUT',
          // Con dirección: PayPal la muestra tal cual y no deja cambiarla (es la
          // que el cliente acaba de escribir en el carrito y la que se guarda).
          shipping_preference: unit.shipping ? 'SET_PROVIDED_ADDRESS' : 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          // Solo métodos que se cobran al momento: así una captura nunca se
          // queda «pendiente» días (cheques electrónicos y similares).
          payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
        },
        ...(c?.email ? { email_address: c.email } : {}),
        ...(c?.nombre
          ? { name: { given_name: recorta(c.nombre, 140), ...(c.apellido ? { surname: recorta(c.apellido, 140) } : {}) } }
          : {}),
      },
    },
  }
}

/** El enlace al que hay que mandar al cliente para que apruebe el pago. */
export function urlAprobacion(orden: any): string | null {
  const links: any[] = Array.isArray(orden?.links) ? orden.links : []
  const l = links.find((x) => x?.rel === 'payer-action') || links.find((x) => x?.rel === 'approve')
  return l?.href ? String(l.href) : null
}

/** Lo que trae un error de la API de PayPal, aplanado para loguear y decidir. */
export function detalleErrorPaypal(e: any): { status: number; name: string; issues: string[]; message: string } {
  const data = e?.data || e?.response?._data || {}
  const issues: string[] = Array.isArray(data?.details)
    ? data.details.map((d: any) => String(d?.issue || d?.field || '')).filter(Boolean)
    : []
  return {
    status: Number(e?.response?.status || e?.statusCode || 0),
    name: String(data?.name || ''),
    issues,
    message: String(data?.details?.[0]?.description || data?.message || e?.message || ''),
  }
}

/**
 * ¿El rechazo fue por la dirección de envío? Entonces vale reintentar sin ella:
 * la dirección ya está guardada en el pedido, y perder la venta por un campo
 * que a PayPal no le gustó es peor que no mostrársela.
 */
export function errorPorDireccion(e: any): boolean {
  const d = detalleErrorPaypal(e)
  if (d.status !== 400 && d.status !== 422) return false
  const txt = [d.name, ...d.issues, d.message].join(' ').toUpperCase()
  return /SHIPPING|ADDRESS|POSTAL|COUNTRY|ADMIN_AREA/.test(txt)
}

export async function crearOrdenPaypal(
  cfg: ConfigPaypal,
  token: string,
  params: { order: PedidoParaPaypal; comprador?: CompradorPaypal; returnUrl: string; cancelUrl: string },
): Promise<{ id: string; status: string; url: string | null }> {
  const url = `${baseApiPaypal(cfg.ambiente)}/v2/checkout/orders`
  const pedir = (conDireccion: boolean) =>
    $fetch<any>(url, {
      method: 'POST',
      headers: cabeceras(token, `${params.order.id}${conDireccion ? '' : ':sin-direccion'}`),
      body: armarOrdenPaypal({ ...params, conDireccion }),
    })
  let orden: any
  try {
    orden = await pedir(true)
  } catch (e: any) {
    if (!errorPorDireccion(e)) throw e
    console.warn('[paypal] PayPal rechazó la dirección, se reintenta sin ella:', detalleErrorPaypal(e))
    orden = await pedir(false)
  }
  return { id: String(orden?.id || ''), status: String(orden?.status || ''), url: urlAprobacion(orden) }
}

// ---------------------------------------------------------------------------
// Captura y lectura de resultados.
// ---------------------------------------------------------------------------
export type EstadoCaptura = 'COMPLETED' | 'PENDING' | 'DECLINED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'NO_APROBADA' | 'OTRO'

export interface ResumenOrdenPaypal {
  paypalOrderId: string
  /** Estado de la orden de PayPal (CREATED, APPROVED, COMPLETED, ...). */
  status: string
  /** Nuestro order.id, tal como viajó en custom_id. */
  orderId: string | null
  captureId: string | null
  estado: EstadoCaptura
}

/** Lee de una orden de PayPal (creada, aprobada o capturada) lo que nos importa. */
export function resumirOrdenPaypal(orden: any): ResumenOrdenPaypal {
  const unit = Array.isArray(orden?.purchase_units) ? orden.purchase_units[0] : undefined
  const captures: any[] = Array.isArray(unit?.payments?.captures) ? unit.payments.captures : []
  // Si hubo varios intentos, manda la captura completada; si no, la última.
  const cap = captures.find((c) => c?.status === 'COMPLETED') || captures[captures.length - 1]
  const orderId = String(cap?.custom_id || unit?.custom_id || unit?.reference_id || '') || null
  let estado: EstadoCaptura = 'OTRO'
  if (cap) estado = estadoDeCaptura(cap.status)
  else if (orden?.status === 'COMPLETED') estado = 'COMPLETED'
  return {
    paypalOrderId: String(orden?.id || ''),
    status: String(orden?.status || ''),
    orderId,
    captureId: cap?.id ? String(cap.id) : null,
    estado,
  }
}

export function estadoDeCaptura(status: unknown): EstadoCaptura {
  switch (String(status || '').toUpperCase()) {
    case 'COMPLETED': return 'COMPLETED'
    case 'PENDING': return 'PENDING'
    case 'DECLINED':
    case 'FAILED': return 'DECLINED'
    case 'REFUNDED': return 'REFUNDED'
    case 'PARTIALLY_REFUNDED': return 'PARTIALLY_REFUNDED'
    default: return 'OTRO'
  }
}

/** El estado del pedido en Supabase que corresponde a una captura. null = no cambia nada. */
export function estadoPedidoDesdeCaptura(estado: EstadoCaptura): 'paid' | 'cancelled' | 'refunded' | null {
  switch (estado) {
    case 'COMPLETED': return 'paid'
    case 'DECLINED': return 'cancelled'
    case 'REFUNDED': return 'refunded'
    // Un reembolso parcial no cambia el estado: el pedido sigue pagado y
    // enviado; lo que se devolvió se ve en PayPal.
    default: return null
  }
}

export async function obtenerOrdenPaypal(cfg: ConfigPaypal, token: string, paypalOrderId: string): Promise<ResumenOrdenPaypal> {
  const orden = await $fetch<any>(`${baseApiPaypal(cfg.ambiente)}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, {
    headers: cabeceras(token),
  })
  return resumirOrdenPaypal(orden)
}

/**
 * Captura (cobra) una orden que el cliente ya aprobó.
 *
 * Idempotente: PayPal-Request-Id fijo por orden, y si PayPal contesta que ya
 * estaba capturada se lee la orden y se devuelve lo que hay. Dos llamadas
 * concurrentes (el regreso del cliente y el webhook) terminan igual.
 */
export async function capturarOrdenPaypal(cfg: ConfigPaypal, token: string, paypalOrderId: string): Promise<ResumenOrdenPaypal> {
  const base = baseApiPaypal(cfg.ambiente)
  try {
    const orden = await $fetch<any>(`${base}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
      method: 'POST',
      headers: cabeceras(token, `cap-${paypalOrderId}`),
      body: {},
    })
    return resumirOrdenPaypal(orden)
  } catch (e: any) {
    const d = detalleErrorPaypal(e)
    if (d.issues.includes('ORDER_ALREADY_CAPTURED')) return obtenerOrdenPaypal(cfg, token, paypalOrderId)
    if (d.issues.includes('ORDER_NOT_APPROVED') || d.issues.includes('ORDER_EXPIRED')) {
      return { paypalOrderId, status: d.issues[0], orderId: null, captureId: null, estado: 'NO_APROBADA' }
    }
    if (d.issues.includes('INSTRUMENT_DECLINED') || d.issues.includes('PAYER_CANNOT_PAY') || d.issues.includes('TRANSACTION_REFUSED')) {
      return { paypalOrderId, status: d.issues[0], orderId: null, captureId: null, estado: 'DECLINED' }
    }
    throw e
  }
}

export interface ResumenCapturaPaypal {
  captureId: string
  estado: EstadoCaptura
  orderId: string | null
  paypalOrderId: string | null
}

/** Lee una captura (GET /v2/payments/captures/{id}): la fuente de verdad para el webhook. */
export function resumirCapturaPaypal(cap: any): ResumenCapturaPaypal {
  return {
    captureId: String(cap?.id || ''),
    estado: estadoDeCaptura(cap?.status),
    orderId: String(cap?.custom_id || '') || null,
    paypalOrderId: String(cap?.supplementary_data?.related_ids?.order_id || '') || null,
  }
}

export async function obtenerCapturaPaypal(cfg: ConfigPaypal, token: string, captureId: string): Promise<ResumenCapturaPaypal> {
  const cap = await $fetch<any>(`${baseApiPaypal(cfg.ambiente)}/v2/payments/captures/${encodeURIComponent(captureId)}`, {
    headers: cabeceras(token),
  })
  return resumirCapturaPaypal(cap)
}

// ---------------------------------------------------------------------------
// Webhook.
// ---------------------------------------------------------------------------

/** Qué hacer con cada evento. 'capturar' = el cliente aprobó y falta cobrar. */
export type AccionWebhook = 'capturar' | 'captura' | 'reembolso' | null

export function accionDeEvento(tipo: unknown): AccionWebhook {
  switch (String(tipo || '').toUpperCase()) {
    case 'CHECKOUT.ORDER.APPROVED': return 'capturar'
    case 'PAYMENT.CAPTURE.COMPLETED':
    case 'PAYMENT.CAPTURE.DENIED':
    case 'PAYMENT.CAPTURE.PENDING':
    case 'PAYMENT.CAPTURE.REVERSED': return 'captura'
    case 'PAYMENT.CAPTURE.REFUNDED': return 'reembolso'
    default: return null
  }
}

/** El id de la captura a la que se refiere un reembolso (viene en el enlace "up"). */
export function capturaDeReembolso(recurso: any): string | null {
  const links: any[] = Array.isArray(recurso?.links) ? recurso.links : []
  const up = links.find((l) => l?.rel === 'up')?.href
  const m = String(up || '').match(/\/captures\/([^/?#]+)/)
  return m ? m[1] : null
}

/** Las cabeceras que PayPal manda con cada webhook, en minúsculas. */
export interface CabecerasWebhookPaypal {
  'paypal-transmission-id'?: string
  'paypal-transmission-time'?: string
  'paypal-transmission-sig'?: string
  'paypal-cert-url'?: string
  'paypal-auth-algo'?: string
}

/**
 * Pide a PayPal que confirme la firma del webhook. true = legítimo.
 *
 * Es defensa en profundidad: aun con firma buena, el webhook no confía en el
 * cuerpo. Toma el id del recurso y vuelve a consultar la captura en la API.
 */
export async function verificarFirmaWebhook(
  cfg: ConfigPaypal,
  token: string,
  cab: CabecerasWebhookPaypal,
  evento: any,
): Promise<boolean> {
  if (!cfg.webhookId) return false
  const faltan = ['paypal-transmission-id', 'paypal-transmission-time', 'paypal-transmission-sig', 'paypal-cert-url', 'paypal-auth-algo']
    .some((k) => !(cab as any)[k])
  if (faltan) return false
  try {
    const r = await $fetch<{ verification_status: string }>(`${baseApiPaypal(cfg.ambiente)}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: cabeceras(token),
      body: {
        auth_algo: cab['paypal-auth-algo'],
        cert_url: cab['paypal-cert-url'],
        transmission_id: cab['paypal-transmission-id'],
        transmission_sig: cab['paypal-transmission-sig'],
        transmission_time: cab['paypal-transmission-time'],
        webhook_id: cfg.webhookId,
        webhook_event: evento,
      },
    })
    return r?.verification_status === 'SUCCESS'
  } catch (e: any) {
    console.warn('[paypal] no se pudo verificar la firma del webhook:', e?.message || e)
    return false
  }
}
