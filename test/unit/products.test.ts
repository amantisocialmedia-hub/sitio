import { describe, it, expect } from 'vitest'
import { useProducts, peso, msi, type Product } from '~/composables/useProducts'

const { products, categories, byCategory, onSale, getBySlug, related, categoryName, bestsellers, featured, relatedForArticle } = useProducts()

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

  it('related con slug desconocido devuelve fallback products.slice(0,n)', () => {
    const res = related('no-existe-xyz', 4)
    expect(res).toEqual(products.slice(0, 4))
  })

  it('related ordena la misma categoría antes que el resto', () => {
    const base = products.find(p => products.filter(x => x.category === p.category).length > 1)!
    const res = related(base.slug, products.length)
    const sameCount = products.filter(x => x.slug !== base.slug && x.category === base.category).length
    expect(res.slice(0, sameCount).every(r => r.category === base.category)).toBe(true)
    expect(res.some(r => r.slug === base.slug)).toBe(false)
  })

  it('categoryName resuelve el nombre y cae al slug si no existe', () => {
    expect(categoryName(categories[0].slug)).toBe(categories[0].name)
    expect(categoryName('zzz-no-existe')).toBe('zzz-no-existe')
  })

  it('bestsellers solo devuelve hot y featured solo featured', () => {
    expect(bestsellers().every(p => p.hot)).toBe(true)
    expect(bestsellers().length).toBeGreaterThan(0)
    expect(featured().every(p => p.featured)).toBe(true)
    expect(featured().length).toBeGreaterThan(0)
  })

  it('onSale está vacío: los descuentos son por cupón, no precios "antes" por producto', () => {
    expect(onSale().length).toBe(0)
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

describe('relatedForArticle — productos relacionados del blog', () => {
  it('prioriza relatedProducts (slugs) y respeta el orden', () => {
    const res = relatedForArticle({ relatedProducts: ['tempo', 'juguetona-tressa'] })
    expect(res[0].slug).toBe('tempo')
    expect(res[1].slug).toBe('juguetona-tressa')
    expect(res.length).toBeGreaterThanOrEqual(3) // se rellena al mínimo con fallback
  })

  it('usa relatedCategory y tope de 8 cuando hay de sobra', () => {
    const res = relatedForArticle({ relatedCategory: 'vibradores' })
    expect(res.length).toBe(8)
    expect(res.every(p => p.category === 'vibradores')).toBe(true)
  })

  it('rellena con fallback si la categoría no alcanza el mínimo', () => {
    const res = relatedForArticle({ relatedCategory: 'lubricantes' }) // catálogo: 2
    expect(res.length).toBeGreaterThanOrEqual(3)
    expect(res.slice(0, 2).every(p => p.category === 'lubricantes')).toBe(true)
  })

  it('sin nada especificado usa fallback (destacados/más vendidos), 3–8', () => {
    const res = relatedForArticle({})
    expect(res.length).toBeGreaterThanOrEqual(3)
    expect(res.length).toBeLessThanOrEqual(8)
  })

  it('ignora slugs inexistentes y nunca duplica', () => {
    const res = relatedForArticle({ relatedProducts: ['no-existe-xyz', 'tempo', 'tempo'], relatedCategory: 'vibradores' })
    expect(res.filter(p => p.slug === 'tempo').length).toBe(1)
    expect(res.some(p => p.slug === 'no-existe-xyz')).toBe(false)
    expect(res.length).toBeLessThanOrEqual(8)
    expect(new Set(res.map(p => p.slug)).size).toBe(res.length) // sin duplicados
  })

  it('respeta un máximo personalizado', () => {
    const res = relatedForArticle({ relatedCategory: 'vibradores' }, 4)
    expect(res.length).toBe(4)
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
