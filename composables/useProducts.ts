import data from '~/data/products.json'

export interface Product {
  slug: string
  name: string
  brand: string
  category: string
  price: number
  compareAt: number
  rating: number
  emoji: string
  bg: string
  subtitle: string
  badge: string
  hot: boolean
  featured: boolean
  badges: string[]
  description: string
  features: string[]
  images?: string[]
}
export interface Category {
  slug: string
  name: string
  emoji: string
  blurb: string
  image?: string
}
/** Campos opcionales de un artículo del blog para sus productos relacionados. */
export interface ArticleRelated {
  relatedProducts?: string[]
  relatedCategory?: string
}

const products = data.products as Product[]
const categories = data.categories as Category[]

/** Subcategoría del mega-menú. Se resuelve contra el catálogo:
 *  - `keywords` ausente/vacío → la categoría COMPLETA.
 *  - `keywords` presente → filtra DENTRO de `category` los productos que mencionen
 *    alguna palabra clave (en nombre / subtítulo / características).
 *  Las subcategorías sin productos no se muestran en el menú (menú dinámico). */
export interface SubCategory {
  slug: string        // id estable para la URL (?sub=)
  label: string       // texto visible en el menú
  category: string    // categoría (product.category) a la que pertenece
  keywords?: string[]
}

// Normaliza para comparar sin acentos ni mayúsculas.
const normTxt = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
const haystack = (p: Product) => normTxt(`${p.name} ${p.subtitle || ''} ${(p.features || []).join(' ')}`)

/** ¿El producto pertenece a la subcategoría? (misma categoría + palabra clave si la hay). */
export function matchesSub(p: Product, sub: SubCategory): boolean {
  if (p.category !== sub.category) return false
  if (!sub.keywords || sub.keywords.length === 0) return true
  const h = haystack(p)
  return sub.keywords.some(k => h.includes(normTxt(k)))
}

// Taxonomía de subcategorías. El `label` coincide con el rótulo del mega-menú.
export const subcategories: SubCategory[] = [
  // "Juguetes Sexuales" → categorías completas + algunos tipos.
  { slug: 'jt-vibradores', label: 'Vibradores', category: 'vibradores' },
  { slug: 'jt-masturbadores', label: 'Masturbadores', category: 'masturbadores' },
  { slug: 'jt-dildos', label: 'Dildos', category: 'dildos' },
  { slug: 'jt-anal', label: 'Anales', category: 'anal' },
  { slug: 'jt-lubricantes', label: 'Lubricantes', category: 'lubricantes' },
  { slug: 'jt-bdsm', label: 'Juguetes BDSM', category: 'bdsm' },
  { slug: 'succionadores', label: 'Succionadores', category: 'vibradores', keywords: ['succion'] },
  { slug: 'anillos-pene', label: 'Anillos Para Pene', category: 'parejas', keywords: ['anillo'] },
  { slug: 'fundas-pene', label: 'Fundas Para Pene', category: 'hombre', keywords: ['funda', 'extension'] },

  // Tipos dentro de "Vibradores".
  { slug: 'vibrador-conejo', label: 'Vibrador Conejo', category: 'vibradores', keywords: ['conejo'] },
  { slug: 'bala-vibradora', label: 'Bala Vibradora', category: 'vibradores', keywords: ['bala'] },
  { slug: 'vibrador-butterfly', label: 'Vibrador Butterfly', category: 'vibradores', keywords: ['mariposa', 'butterfly', 'aleteo'] },
  { slug: 'calzon-vibrador', label: 'Calzón Vibrador', category: 'vibradores', keywords: ['calzon', 'panty'] },
  { slug: 'vibrador-punto-g', label: 'Vibrador Punto G', category: 'vibradores', keywords: ['punto g'] },
  { slug: 'vibrador-app', label: 'Vibrador Con App', category: 'vibradores', keywords: ['app'] },
  { slug: 'vibrador-control-remoto', label: 'Vibrador Control Remoto', category: 'vibradores', keywords: ['control remoto', 'remoto'] },
  { slug: 'dedal-vibrador', label: 'Dedal Vibrador', category: 'vibradores', keywords: ['dedo', 'dedal', 'dedito'] },
  { slug: 'vibrador-empuje', label: 'Vibrador Con Empuje', category: 'vibradores', keywords: ['empuje'] },
  { slug: 'huevo-vibrador', label: 'Huevo Vibrador', category: 'vibradores', keywords: ['huevo'] },
  { slug: 'vibrador-masajeador', label: 'Vibrador Masajeador', category: 'vibradores', keywords: ['masajeador'] },
  { slug: 'vibrador-parejas', label: 'Vibrador Para Parejas', category: 'parejas' },
  { slug: 'vibrador-succionador', label: 'Vibrador Con Succionador', category: 'vibradores', keywords: ['succion'] },
  // 'succionador' (no 'clitoris'): la palabra "clítoris" aparece en features de vibradores
  // normales (p.ej. Salvajita Rosa) y los colaba en este submenú (QA jul-2026).
  { slug: 'succionador-clitoris', label: 'Succionador De Clítoris', category: 'vibradores', keywords: ['succionador'] },
  { slug: 'vibradores-anales', label: 'Vibradores Anales', category: 'anal', keywords: ['vibra'] },

  // Tipos dentro de "Masturbadores".
  { slug: 'pocket-pussy', label: 'Pocket Pussy', category: 'masturbadores', keywords: ['vagina', 'pussy', 'pocket'] },
  { slug: 'masturbador-vibrador', label: 'Masturbador Vibrador', category: 'masturbadores', keywords: ['vibra', 'bala'] },
  { slug: 'masturbador-app', label: 'Masturbador Con App', category: 'masturbadores', keywords: ['app'] },
  { slug: 'huevo-masturbador', label: 'Huevo Masturbador', category: 'masturbadores', keywords: ['huevo'] },
  { slug: 'bombas-vacio', label: 'Bombas De Vacío', category: 'masturbadores', keywords: ['bomba', 'vacio'] },
  { slug: 'munecas-torsos', label: 'Muñecas Y Torsos', category: 'masturbadores', keywords: ['torso', 'muneca'] },
  { slug: 'masajeador-prostata', label: 'Masajeador De Próstata', category: 'masturbadores', keywords: ['prostata'] },
  { slug: 'anillos-retardantes', label: 'Anillos Retardantes', category: 'retardantes' },
  { slug: 'fundas-extensiones', label: 'Fundas Y Extensiones', category: 'hombre', keywords: ['funda', 'extension'] },
  { slug: 'porn-stars', label: '★ Porn Stars', category: 'masturbadores', keywords: ['realista', 'porn'] },

  // Tipos dentro de "Dildos".
  { slug: 'dildo-realista', label: 'Dildo Realista', category: 'dildos', keywords: ['realista'] },
  { slug: 'dildo-vibrador', label: 'Dildo Vibrador', category: 'dildos', keywords: ['vibra'] },
  { slug: 'dildo-ventosa', label: 'Dildo Con Ventosa', category: 'dildos', keywords: ['ventosa'] },
  { slug: 'dildo-strap-on', label: 'Dildo Strap-On', category: 'arneses' },
  { slug: 'dildo-strapless', label: 'Dildo Strapless', category: 'dildos', keywords: ['strapless'] },
  { slug: 'dildo-control-remoto', label: 'Dildo Control Remoto', category: 'dildos', keywords: ['control remoto', 'remoto'] },
  { slug: 'dildo-anal', label: 'Dildo Anal', category: 'anal' },
  { slug: 'dildo-doble', label: 'Dildo Doble Penetración', category: 'dildos', keywords: ['doble'] },
  { slug: 'dildo-eyaculador', label: 'Dildo Eyaculador', category: 'dildos', keywords: ['eyacula'] },
  { slug: 'dildo-hueco', label: 'Dildo Hueco', category: 'dildos', keywords: ['hueco'] },
  { slug: 'dildo-cristal', label: 'Dildo De Cristal', category: 'dildos', keywords: ['cristal', 'vidrio'] },
  { slug: 'monster-dildo', label: 'Monster Dildo', category: 'dildos', keywords: ['monster', 'gigante', 'xl'] },
]

/** Formato de precio en pesos mexicanos. */
export const peso = (n: number) => '$ ' + Math.round(n).toLocaleString('es-MX')

/** Pago a 3 meses sin intereses (mensualidad). */
export const msi = (n: number, months = 3) => peso(n / months)

export function useProducts() {
  const getBySlug = (slug: string) => products.find(p => p.slug === slug)
  const byCategory = (cat: string) => products.filter(p => p.category === cat)
  const categoryName = (slug: string) => categories.find(c => c.slug === slug)?.name ?? slug
  const onSale = () => products.filter(p => p.compareAt && p.compareAt > p.price)
  const bestsellers = () => products.filter(p => p.hot)
  const featured = () => products.filter(p => p.featured)
  const related = (slug: string, n = 4) => {
    const p = getBySlug(slug)
    if (!p) return products.slice(0, n)
    const same = products.filter(x => x.slug !== slug && x.category === p.category)
    const rest = products.filter(x => x.slug !== slug && x.category !== p.category)
    return [...same, ...rest].slice(0, n)
  }

  /**
   * Productos relacionados de un artículo del blog (carrusel de la Eroteca).
   * Prioridad: relatedProducts (slugs) → relatedCategory → fallback (destacados/más vendidos).
   * Devuelve entre `min` y `max` productos (sin duplicados); vacío solo si no hay catálogo.
   */
  const relatedForArticle = (a?: ArticleRelated | null, max = 8, min = 3): Product[] => {
    const out: Product[] = []
    const seen = new Set<string>()
    const push = (p?: Product) => {
      if (p && !seen.has(p.slug) && out.length < max) { seen.add(p.slug); out.push(p) }
    }
    // 1) slugs explícitos (lo más relevante al tema)
    for (const slug of a?.relatedProducts || []) push(getBySlug(slug))
    // 2) categoría relacionada
    if (a?.relatedCategory) for (const p of byCategory(a.relatedCategory)) push(p)
    // 3) fallback para llegar al mínimo: destacados, luego más vendidos, luego catálogo
    if (out.length < min) for (const p of [...featured(), ...bestsellers(), ...products]) push(p)
    return out
  }

  const subcatBySlug = (slug: string) => subcategories.find(s => s.slug === slug)
  /** Productos de una subcategoría (solo "sus" productos). Vacío si el slug no existe. */
  const bySubcategory = (slug: string) => {
    const sub = subcatBySlug(slug)
    return sub ? products.filter(p => matchesSub(p, sub)) : []
  }
  /** Cuántos productos tiene una subcategoría (0 si vacía → no se muestra en el menú). */
  const subcategoryCount = (slug: string) => bySubcategory(slug).length
  /** Subcategorías con al menos 1 producto. Filtra por categoría si se indica. */
  const subcategoriesWithProducts = (category?: string) =>
    subcategories.filter(s => (!category || s.category === category) && products.some(p => matchesSub(p, s)))

  return {
    products, categories, subcategories, getBySlug, byCategory, categoryName, onSale, bestsellers, featured, related,
    relatedForArticle, subcatBySlug, bySubcategory, subcategoryCount, subcategoriesWithProducts, peso, msi,
  }
}
