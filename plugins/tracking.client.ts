// Carga GA4 + Microsoft Clarity + Meta Pixel SOLO cuando el usuario aceptó cookies.
// La decisión vive en la cookie 'amanti_cookie_consent' ('accepted' | 'rejected').
// El banner (CookieConsent.vue) llama a $loadTrackers() al Aceptar.
const GA_ID = 'G-HE23F0TWMG'
const CLARITY_ID = 'u8nz8w7mf3'
const PIXEL_ID = '947187697884149'

function loadTrackers() {
  if (typeof window === 'undefined') return
  const w = window as any
  if (w.__amantiTrackingLoaded) return
  w.__amantiTrackingLoaded = true

  // Google Analytics 4
  const ga = document.createElement('script')
  ga.async = true
  ga.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(ga)
  w.dataLayer = w.dataLayer || []
  function gtag(...args: any[]) { w.dataLayer.push(args) }
  w.gtag = gtag
  gtag('js', new Date())
  gtag('config', GA_ID)

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
  if (consent.value === 'accepted') loadTrackers()
  return {
    provide: { loadTrackers },
  }
})
