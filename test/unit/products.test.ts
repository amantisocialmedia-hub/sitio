import { describe, it, expect } from 'vitest'
import { useProducts, peso, msi, type Product } from '~/composables/useProducts'

const { products, categories, byCategory, onSale, getBySlug, related } = useProducts()

describe('useProducts — filtros', () => {
  it('byCategory devuelve solo productos de esa categoría', () => {
    const cat = categories[0].slug
    const res = byCategory(cat)
    expect(res.length).toBeGreaterThan(0)
    expect(res.every(p => p.category === cat)).toBe(true)
  })

  it('getBySlug encuentra el producto correcto', () => {
    const p = products[0]
    expect(getBySlug(p.slug)?.slug).toBe(p.slug)
    expect(getBySlug('no-existe-xyz')).toBeUndefined()
  })

  it('onSale solo devuelve productos con compareAt > price', () => {
    const res = onSale()
    expect(res.every(p => p.compareAt > p.price)).toBe(true)
  })

  it('related no incluye el propio producto y respeta el límite', () => {
    const p = products[0]
    const res = related(p.slug, 4)
    expect(res.length).toBeLessThanOrEqual(4)
    expect(res.some(r => r.slug === p.slug)).toBe(false)
  })

  it('búsqueda por q (nombre + subtitle) — misma lógica que /tienda', () => {
    const q = (list: Product[], t: string) =>
      list.filter(p => (p.name + ' ' + (p.subtitle || '')).toLowerCase().includes(t.toLowerCase()))
    const res = q(products, 'con app')
    expect(res.length).toBeGreaterThan(0)
    expect(res.every(p => (p.name + ' ' + p.subtitle).toLowerCase().includes('con app'))).toBe(true)
  })

  it('rango de precio — misma lógica que /tienda', () => {
    const inRange = (list: Product[], min: number, max: number) =>
      list.filter(p => p.price >= min && p.price <= max)
    const res = inRange(products, 100, 500)
    expect(res.every(p => p.price >= 100 && p.price <= 500)).toBe(true)
    expect(res.length).toBeLessThan(products.length)
  })
})

describe('formato de precio', () => {
  it('peso formatea en MXN con separador de miles', () => {
    expect(peso(1013)).toBe('$ 1,013')
    expect(peso(99)).toBe('$ 99')
    expect(peso(1234.6)).toBe('$ 1,235') // redondea
  })
  it('msi divide entre meses', () => {
    expect(msi(3000, 3)).toBe('$ 1,000')
  })
})
