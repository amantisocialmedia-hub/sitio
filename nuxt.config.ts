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
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#5E1B33' },
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
        { property: 'og:image', content: 'https://amanti.mx/og-cover.png' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'AMANTI — Sex Shop en línea en México' },
        {
          name: 'twitter:description',
          content: 'Entrega 100% discreta en todo México. Vibradores, juguetes para parejas, lubricantes y wellness.',
        },
        { name: 'twitter:image', content: 'https://amanti.mx/og-cover.png' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='31' fill='%235E1B33'/><text x='32' y='46' font-family='Georgia,serif' font-size='40' fill='white' text-anchor='middle'>a</text></svg>",
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700;800&family=Lora:wght@400;500;600;700&family=Dancing+Script:wght@600;700&display=swap',
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
    public: {
      brandName: 'AMANTI',
      // NUXT_PUBLIC_WHATSAPP_PHONE
      whatsappPhone: '5214430000000',
      // NUXT_PUBLIC_SITE_URL
      siteUrl: 'https://amanti.mx',
      // NUXT_PUBLIC_PUBLIC_BASE_URL
      publicBaseUrl: 'http://localhost:3000',
    },
  },
})
