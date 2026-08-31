// Carga de trackers, con Consent Mode v2 de Google.
//
// Google (GA4 + Ads) se carga SIEMPRE, pero con el consentimiento DENEGADO por default:
// no guarda cookies ni identificadores publicitarios hasta que el usuario acepta. Eso
// permite que llegue la señal agregada de quien no acepta, que antes se perdía completa.
//
// Microsoft Clarity y Meta Pixel NO se cargan sin aceptación explícita: no tienen un
// estado "denegado" equivalente al de Google, y Clarity graba la sesión entera.
//
// La decisión vive en la cookie 'amanti_cookie_consent' ('accepted' | 'rejected').
// El banner (CookieConsent.vue) llama a $loadTrackers() al Aceptar.
import { gtagPush } from '~/utils/gtag'

const GA_ID = 'G-HE23F0TWMG'
const ADS_ID = 'AW-17872915568'
const CLARITY_ID = 'u8nz8w7mf3'
const PIXEL_ID = '947187697884149'

/** gtag.js con Consent Mode v2 en 'denied'. Idempotente. */
function loadGoogle() {
  if (typeof window === 'undefined') return
  const w = window as any
  if (w.__amantiGoogleLoaded) return
  w.__amantiGoogleLoaded = true

  w.dataLayer = w.dataLayer || []
  w.gtag = gtagPush

  // OJO: el 'consent default' tiene que entrar al dataLayer ANTES de cualquier config,
  // o gtag alcanza a escribir cookies antes de enterarse del estado.
  gtagPush('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  })
  // Mientras ad_storage esté denegado: redacta los identificadores de clic y pasa el
  // gclid por la URL en lugar de por cookie.
  gtagPush('set', 'ads_data_redaction', true)
  gtagPush('set', 'url_passthrough', true)

  const ga = document.createElement('script')
  ga.async = true
  ga.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(ga)

  gtagPush('js', new Date())
  gtagPush('config', GA_ID)
  // Google Ads: misma librería gtag.js, otra cuenta. Necesario para que las conversiones
  // de compra (useAnalytics.purchase) lleguen a Ads.
  gtagPush('config', ADS_ID)
}

/** Sube el consentimiento a 'granted' y carga lo que sí requiere aceptación. */
function loadTrackers() {
  if (typeof window === 'undefined') return
  const w = window as any

  loadGoogle()
  gtagPush('consent', 'update', {
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
    analytics_storage: 'granted',
  })

  if (w.__amantiTrackingLoaded) return
  w.__amantiTrackingLoaded = true

  // Microsoft Clarity
  ;(function (c: any, l: any, a: string, r: string, i: string) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) }
    const t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i
    const y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y)
  })(w, document, 'clarity', 'script', CLARITY_ID)

  // Meta Pixel
  ;(function (f: any, b: any, e: string, v: string) {
    if (f.fbq) return
    const n: any = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }
    if (!f._fbq) f._fbq = n
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = []
    const t = b.createElement(e); t.async = true; t.src = v
    const s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s)
  })(w, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
  w.fbq('init', PIXEL_ID)
  w.fbq('track', 'PageView')
}

export default defineNuxtPlugin(() => {
  const consent = useCookie<string | null>('amanti_cookie_consent')
  // El gclid se recuerda de la URL de aterrizaje, antes de cualquier navegación interna.
  captureGclid()
  loadGoogle()
  if (consent.value === 'accepted') loadTrackers()
  return {
    provide: { loadTrackers },
  }
})
