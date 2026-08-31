// Lógica PURA de items de pedido (sin Supabase ni auto-imports de Nuxt) -> testeable bajo vitest.
// La FUENTE DE VERDAD de precios/imágenes es el catálogo del servidor (data/products.json),
// NUNCA el precio que mande el cliente. Esto cierra el agujero de manipulación de precios.
import { createError } from 'h3'
import productsData from '../../data/products.json'
import { aplicarCampana } from '../../utils/campana'

export interface InCartItem { slug?: string; name?: string; price?: number; quantity: number }
export interface ResolvedItem {
  slug: string
  name: string
  unitPrice: number
  quantity: number
  lineTotal: number
  imageUrl: string | null
}

// La campaña se aplica AQUÍ, en el mismo lugar del que sale el precio que se
// cobra. Si se aplicara solo en la vista, el cliente vería 40% menos y Mercado
// Pago le cobraría el precio completo.
const catalog = aplicarCampana((productsData as any).products as any[])
export const priceBySlug: Record<string, number> = Object.fromEntries(catalog.map((p) => [p.slug, p.price]))
export const nameBySlug: Record<string, string> = Object.fromEntries(catalog.map((p) => [p.slug, p.name]))
export const imgBySlug: Record<string, string | null> = Object.fromEntries(
  catalog.map((p) => [p.slug, (p.images && p.images[0]) || null]),
)
// Productos marcados como agotados en data/products.json (`"agotado": true`).
// No hay conteo de inventario: es una bandera que se prende a mano cuando Nancy
// avisa que se acabo algo.
export const agotadoBySlug: Record<string, boolean> = Object.fromEntries(
  catalog.map((p) => [p.slug, !!(p as any).agotado]),
)

// Tope por línea (anti-abuso). Ajustable según el negocio.
export const MAX_QTY = 99
// Redondeo a 2 decimales para evitar errores de coma flotante en dinero.
export const round2 = (n: number) => Math.round(n * 100) / 100

export interface Catalog {
  price: Record<string, number>
  name: Record<string, string>
  img: Record<string, string | null>
  agotado?: Record<string, boolean>
}
const DEFAULT_CATALOG: Catalog = { price: priceBySlug, name: nameBySlug, img: imgBySlug, agotado: agotadoBySlug }

/**
 * Valida y resuelve los items del carrito contra el catálogo del servidor:
 *  - coacciona quantity a entero en [1, MAX_QTY];
 *  - toma el precio AUTORITATIVO por slug (ignora i.price del cliente);
 *  - rechaza slugs desconocidos o cantidades inválidas (400).
 * Lanza createError(400) si algún item es inválido o si no queda ninguno.
 */
export function resolveItems(items: InCartItem[], catalog: Catalog = DEFAULT_CATALOG): ResolvedItem[] {
  const resolved = (items || []).map((i) => {
    const slug = i?.slug
    const qty = Math.floor(Number(i?.quantity))
    const unitPrice = slug != null ? catalog.price[slug] : undefined
    if (!slug || unitPrice == null || !Number.isFinite(qty) || qty < 1 || qty > MAX_QTY) {
      throw createError({ statusCode: 400, message: 'Artículo del carrito inválido.' })
    }
    // Lo agotado se rechaza AQUI, no solo escondiendo el boton en la ficha.
    // Alguien puede traer la pagina abierta desde antes, un carrito guardado, o
    // entrar por el enlace directo del anuncio de Google. Si el rechazo viviera
    // solo en la vista, esa persona pagaria por algo que Nancy no puede meter en
    // la caja -- y devolver un cobro cuesta mas que perder la venta.
    if (catalog.agotado?.[slug]) {
      throw createError({
        statusCode: 409,
        message: `${catalog.name[slug] || slug} se agotó. Quítalo del carrito para continuar.`,
      })
    }
    return {
      slug,
      // El nombre es cosmético (snapshot): se usa el del carrito y, si falta, el del catálogo.
      // Solo el PRECIO es autoritativo (seguridad).
      name: i?.name || catalog.name[slug] || slug,
      unitPrice: round2(unitPrice),
      quantity: qty,
      lineTotal: round2(unitPrice * qty),
      imageUrl: catalog.img[slug] ?? null,
    }
  })
  if (!resolved.length) throw createError({ statusCode: 400, message: 'El carrito está vacío.' })
  return resolved
}

/** Total del pedido a partir de items YA resueltos (precios autoritativos). */
export function computeTotal(items: ResolvedItem[]): number {
  return round2(items.reduce((s, i) => s + i.lineTotal, 0))
}

/** Filas de order_items (snapshot) a partir de items resueltos. */
export function buildOrderRows(orderId: string, items: ResolvedItem[]) {
  return items.map((i) => ({
    order_id: orderId,
    product_slug: i.slug,
    product_name: i.name,
    image_url: i.imageUrl,
    unit_price: i.unitPrice,
    quantity: i.quantity,
    line_total: i.lineTotal,
  }))
}
