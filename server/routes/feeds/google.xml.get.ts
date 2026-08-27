// GET /feeds/google.xml — Feed de productos para Google Merchant Center (RSS 2.0 + namespace g:).
//
// Se genera DINÁMICAMENTE desde data/products.json (la misma fuente que ya usa la tienda), así el
// feed siempre refleja el catálogo publicado. Público, sin autenticación. Cache ~1 día (CDN).
//
// Mapeo de campos:
//   g:id            = slug (único y estable)      g:title       = name
//   g:description   = description                 g:link        = {origen}/tienda/{slug}
//   g:image_link    = images[0]                   g:additional_image_link = images[1..10]
//   g:price         = "0.00 MXN"                  g:availability = in_stock (catálogo estático)
//   g:condition     = new                         g:brand        = brand (si existe)
//   g:product_type  = category                    g:identifier_exists = no (sin GTIN/MPN)
//   g:adult         = yes (requisito de Google para este catálogo, en TODOS los productos)
//
// link / image_link son ABSOLUTOS y se derivan del dominio DESDE EL QUE SE SIRVE el feed, así
// funcionan igual servido en amanti-store-cake.vercel.app o en amanti.mx (fallback: siteUrl).
import { defineEventHandler, setHeader, getRequestURL } from 'h3'
import productsData from '../../../data/products.json'
import { aplicarCampana } from '../../../utils/campana'

interface FeedProduct {
  slug: string
  name: string
  brand?: string
  category?: string
  price: number
  // Precio de lista. Con la campaña encendida, aplicarCampana() deja aquí el
  // precio ANTES del descuento y baja `price` al rebajado. Es lo que permite
  // mandarle a Google el tachado (g:price + g:sale_price).
  compareAt?: number
  description?: string
  images?: string[]
  // Campos específicos del feed (no se usan en la web):
  feedId?: string           // override de g:id cuando el slug supera 50 caracteres
  feedTitle?: string        // título optimizado para Google (g:title); fallback a name
  feedDescription?: string  // descripción optimizada para Google (g:description); fallback a description
  excludeFromFeed?: boolean // saca el producto del feed sin quitarlo de la tienda
}

// Con la campaña encendida, Google tiene que ver el mismo precio que la tienda,
// o Merchant Center marca discrepancia y suspende los productos.
const products = aplicarCampana(((productsData as any).products || []) as FeedProduct[])

/**
 * Vigencia de la promocion para Google Shopping, en ISO 8601 con offset y
 * separada por diagonal, que es el unico formato que acepta.
 *
 * Se llena desde NUXT_PROMO_VIGENCIA porque la fecha de fin es una decision de
 * campana, no de codigo: cuando Cesar y Emilio la muevan, se cambia la variable
 * en Vercel sin desplegar. Vacia = no se manda la etiqueta, y el descuento se
 * ve igual pero sin fecha de corte.
 *
 * Ejemplo: 2026-08-01T00:00-06:00/2026-08-31T23:59-06:00
 */
const VIGENCIA_PROMO = (process.env.NUXT_PROMO_VIGENCIA || '').trim()

function xmlEscape(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Une base + ruta en una URL absoluta (deja intactas las que ya son absolutas).
function absUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return base.replace(/\/+$/, '') + '/' + String(path).replace(/^\/+/, '')
}

// Categoría oficial de Google Product Taxonomy: 778 = "Mature > Erotic > Sex Toys".
// Es la única hoja de la rama Mature > Erotic aplicable a este catálogo (juguetes, anal,
// BDSM, arneses, masturbadores, parejas, lubricantes y retardantes). Ayuda a que Merchant
// clasifique y apruebe los productos adultos.
const GOOGLE_PRODUCT_CATEGORY = '778'

// gender por categoría del catálogo (aproximación; unisex es el default seguro).
const GENDER_BY_CATEGORY: Record<string, string> = {
  vibradores: 'female',
  masturbadores: 'male',
  hombre: 'male',
  retardantes: 'male',
  dildos: 'unisex',
  anal: 'unisex',
  bdsm: 'unisex',
  parejas: 'unisex',
  arneses: 'unisex',
  lubricantes: 'unisex',
}

// Colores reconocidos (whitelist). Solo se emite g:color con match claro para no ensuciar el feed.
const COLOR_WORDS = [
  'Negro', 'Blanco', 'Rosa', 'Morado', 'Púrpura', 'Azul', 'Rojo', 'Verde', 'Amarillo',
  'Naranja', 'Gris', 'Nude', 'Transparente', 'Multicolor', 'Dorado', 'Plateado', 'Café', 'Turquesa',
]
function detectColor(text: string): string | null {
  for (const c of COLOR_WORDS) {
    const re = new RegExp(`(^|[\\s—,])${c}([\\s,.]|$)`, 'i')
    if (re.test(text)) return c
  }
  return null
}

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  let base = (config.public as any).siteUrl || 'https://amanti.mx'
  try {
    const origin = getRequestURL(event).origin
    if (origin) base = origin
  } catch { /* usa el fallback de config */ }

  const items = products
    .filter((p) => p && p.slug && !p.excludeFromFeed)
    .map((p) => {
      const link = absUrl(base, `/tienda/${p.slug}`)
      const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : []
      const priceStr = `${Number(p.price || 0).toFixed(2)} MXN`
      const rows: string[] = [
        `      <g:id>${xmlEscape(p.feedId || p.slug)}</g:id>`,
        `      <g:title>${xmlEscape(p.feedTitle || p.name)}</g:title>`,
        `      <g:description>${xmlEscape(p.feedDescription || p.description || p.name)}</g:description>`,
        `      <g:link>${xmlEscape(link)}</g:link>`,
      ]
      if (imgs[0]) rows.push(`      <g:image_link>${xmlEscape(absUrl(base, imgs[0]))}</g:image_link>`)
      imgs.slice(1, 11).forEach((im) =>
        rows.push(`      <g:additional_image_link>${xmlEscape(absUrl(base, im))}</g:additional_image_link>`),
      )
      rows.push(`      <g:availability>in_stock</g:availability>`)

      // Precio tachado en Shopping (lo pidio Emilio, 26-ago-2026).
      //
      // El problema que resuelve: aplicarCampana() ya deja el precio CON el 40%
      // en `price` y el de lista en `compareAt`, asi que el feed venia mandando
      // el precio rebajado como si fuera el normal. Google no tenia forma de
      // saber que habia descuento y el anuncio salia sin tachado -- se pierde
      // justo el gancho de la promocion.
      //
      // Como lo quiere Google: `price` es el precio de LISTA y `sale_price` el
      // rebajado. Va al reves de lo que hace el sitio, por eso el swap de abajo.
      // `sale_price_effective_date` es opcional; sin ella el descuento se ve
      // igual, pero con ella Google sabe cuando termina y no hay que acordarse
      // de volver a tocar el feed el dia que se apague la campana.
      if (p.compareAt && p.compareAt > p.price) {
        rows.push(`      <g:price>${xmlEscape(`${Number(p.compareAt).toFixed(2)} MXN`)}</g:price>`)
        rows.push(`      <g:sale_price>${xmlEscape(priceStr)}</g:sale_price>`)
        if (VIGENCIA_PROMO) {
          rows.push(`      <g:sale_price_effective_date>${xmlEscape(VIGENCIA_PROMO)}</g:sale_price_effective_date>`)
        }
      } else {
        rows.push(`      <g:price>${xmlEscape(priceStr)}</g:price>`)
      }
      rows.push(`      <g:condition>new</g:condition>`)
      if (p.brand) rows.push(`      <g:brand>${xmlEscape(p.brand)}</g:brand>`)
      if (p.category) rows.push(`      <g:product_type>${xmlEscape(p.category)}</g:product_type>`)
      rows.push(`      <g:google_product_category>${GOOGLE_PRODUCT_CATEGORY}</g:google_product_category>`)
      rows.push(`      <g:age_group>adult</g:age_group>`)
      const gender = p.category ? GENDER_BY_CATEGORY[p.category] : undefined
      if (gender) rows.push(`      <g:gender>${gender}</g:gender>`)
      const color = detectColor(p.feedTitle || p.name || '')
      if (color) rows.push(`      <g:color>${xmlEscape(color)}</g:color>`)
      rows.push(`      <g:identifier_exists>no</g:identifier_exists>`)
      rows.push(`      <g:adult>yes</g:adult>`)
      return `    <item>\n${rows.join('\n')}\n    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>AMANTI</title>
    <link>${xmlEscape(base)}</link>
    <description>Catálogo AMANTI — bienestar íntimo</description>
${items}
  </channel>
</rss>`

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  // Google no necesita más frescura que ~1 día; s-maxage cachea en el CDN de Vercel.
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=86400')
  return xml
})
