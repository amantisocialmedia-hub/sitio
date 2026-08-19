// GET /api/catalog — catálogo público para el agente EROS (n8n) y cualquier integración.
// Devuelve los productos vigentes (mismos que la tienda) con su URL en amanti.mx, así el
// agente siempre recomienda productos reales y actuales sin depender de Wix.
import { defineEventHandler } from 'h3'
import productsData from '../../data/products.json'
import { aplicarCampana } from '../../utils/campana'

const catalog = aplicarCampana((productsData as any).products as any[])
const categories: Record<string, string> = Object.fromEntries(
  ((productsData as any).categories as any[]).map((c) => [c.slug, c.name]),
)

export default defineEventHandler(() => {
  const base = (useRuntimeConfig().public.siteUrl as string) || 'https://amanti.mx'
  const products = catalog.map((p) => ({
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    category: categories[p.category] || p.category,
    categorySlug: p.category,
    price: p.price,
    priceMXN: `$${Math.round(p.price).toLocaleString('es-MX')} MXN`,
    subtitle: p.subtitle,
    inStock: true,
    url: `${base}/tienda/${p.slug}`,
  }))
  return { store: 'AMANTI', count: products.length, currency: 'MXN', products }
})
