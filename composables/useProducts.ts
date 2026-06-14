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
}

const products = data.products as Product[]
const categories = data.categories as Category[]

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
  return { products, categories, getBySlug, byCategory, categoryName, onSale, bestsellers, featured, related, peso, msi }
}
