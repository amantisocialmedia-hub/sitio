// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },

  modules: ['@pinia/nuxt', '@nuxt/image', '@nuxtjs/supabase'],

  supabase: {
    // redirect:false a propósito: login/registro viven en la misma página (/cuenta) sin redirect global.
    // No hay middleware de ruta; /cuenta NO renderiza datos privados en SSR (se cargan en cliente).
    // Si en el futuro una subruta renderiza datos privados en servidor, añadir middleware que
    // redirija a no autenticados. URL y key se leen de SUPABASE_URL / SUPABASE_KEY.
    redirect: false,
  },

  image: {
    // ipx en local (node); en Vercel se usa la optimización nativa (/_vercel/image)
    provider: process.env.VERCEL ? 'vercel' : 'ipx',
    format: ['webp'],
    quality: 72,
    densities: [1, 2],
  },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      title: 'AMANTI — Sex Shop en línea | Juguetes sexuales discretos en México',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#5E1B33' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'AMANTI' },
        {
          name: 'description',
          content:
            'Sex shop en línea en México con entrega 100% discreta. Vibradores, juguetes para parejas, lubricantes y más para mujeres, hombres y parejas.',
        },
        // Open Graph / Twitter a nivel sitio (las páginas de producto/colección los enriquecen vía useSeoMeta).
        // og:image usa URL ABSOLUTA porque las redes la exigen; ajusta el dominio si cambia.
        { property: 'og:site_name', content: 'AMANTI' },
        { property: 'og:type', content: 'website' },
        { property: 'og:locale', content: 'es_MX' },
        { property: 'og:title', content: 'AMANTI — Sex Shop en línea | Juguetes sexuales discretos en México' },
        {
          property: 'og:description',
          content:
            'Sex shop en línea en México con entrega 100% discreta. Vibradores, juguetes para parejas, lubricantes y más.',
        },
        // og:image / twitter:image se ponen en app.vue derivados de NUXT_PUBLIC_SITE_URL (URL absoluta).
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'AMANTI — Sex Shop en línea en México' },
        {
          name: 'twitter:description',
          content: 'Entrega 100% discreta en todo México. Vibradores, juguetes para parejas, lubricantes y wellness.',
        },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'icon', type: 'image/svg+xml', href: '/brand/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/brand/favicon-32.png' },
        {
          // Carga no bloqueante: se baja con prioridad baja y se aplica al cargar
          // (display=swap evita FOIT; el fallback serif cubre el instante previo).
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700;800&family=Lora:wght@400;500;600;700&family=Dancing+Script:wght@600;700&display=swap',
          media: 'print',
          onload: "this.media='all'",
        },
      ],
      noscript: [
        {
          innerHTML: '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700;800&family=Lora:wght@400;500;600;700&family=Dancing+Script:wght@600;700&display=swap">',
        },
      ],
      // Los rastreadores (GA4, Clarity, Meta Pixel) se cargan SOLO con consentimiento
      // aceptado, desde plugins/tracking.client.ts (banner CookieConsent.vue).
    },
  },

  runtimeConfig: {
    // privado (servidor) — NUXT_MP_ACCESS_TOKEN
    mpAccessToken: '',
    // privado (servidor) — NUXT_MP_WEBHOOK_SECRET (panel MP → Webhooks → secreto). Valida la firma HMAC.
    mpWebhookSecret: '',
    // privado (servidor) — NUXT_STRIPE_SECRET_KEY (Stripe → Developers → API keys). sk_test_… (pruebas) o sk_live_… (real).
    stripeSecretKey: '',
    // privado (servidor) — NUXT_STRIPE_WEBHOOK_SECRET (Stripe → Developers → Webhooks → Signing secret, whsec_…). Valida la firma.
    stripeWebhookSecret: '',
    // privado (servidor) — webhook del agente EROS en n8n. /api/chat hace de proxy (evita CORS,
    // oculta la URL al cliente). Sobreescribible por NUXT_N8N_CHAT_WEBHOOK.
    n8nChatWebhook: 'https://madebyhumano.app.n8n.cloud/webhook/amanti-chat',
    public: {
      brandName: 'AMANTI',
      // NUXT_PUBLIC_WHATSAPP_PHONE (número real de AMANTI; se puede sobreescribir por env)
      whatsappPhone: '5214437270349',
      // NUXT_PUBLIC_SITE_URL
      siteUrl: 'https://amanti.mx',
      // NUXT_PUBLIC_PUBLIC_BASE_URL
      publicBaseUrl: 'http://localhost:3000',
      // NUXT_PUBLIC_STRIPE_ENABLED — "1" para mostrar el botón "Pagar con tarjeta" (Stripe); vacío = oculto.
      stripeEnabled: '',
      // NUXT_PUBLIC_ENVIO_COSTO — lo que se cobra de envío bajo los $1,000.
      // Vacío o "0" = envío gratis para todos, que es como estaba el sitio.
      // El servidor lee NUXT_ENVIO_COSTO (sin PUBLIC) y ESE es el autoritativo:
      // este solo pinta. Los dos deben tener el mismo valor.
      envioCosto: '',
    },
  },
})
