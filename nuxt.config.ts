// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },

  modules: ['@pinia/nuxt', '@nuxt/image'],

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
      script: [
        // Google Analytics 4
        {
          src: 'https://www.googletagmanager.com/gtag/js?id=G-HE23F0TWMG',
          async: true,
        },
        {
          innerHTML:
            "window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', 'G-HE23F0TWMG');",
        },
        // Microsoft Clarity
        {
          innerHTML:
            '(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "u8nz8w7mf3");',
        },
        // Meta Pixel
        {
          innerHTML:
            "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');\nfbq('init', '947187697884149');\nfbq('track', 'PageView');",
        },
      ],
      noscript: [
        {
          innerHTML:
            '<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=947187697884149&ev=PageView&noscript=1"/>',
        },
      ],
    },
  },

  runtimeConfig: {
    // privado (servidor) — NUXT_MP_ACCESS_TOKEN
    mpAccessToken: '',
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
