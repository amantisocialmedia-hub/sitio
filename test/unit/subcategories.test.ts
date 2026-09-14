import { describe, it, expect } from 'vitest'
import { useProducts, matchesSub, subcategories, subCats } from '~/composables/useProducts'

const { products, byCategory, bySubcategory, subcatBySlug, subcategoryCount, subcategoriesWithProducts } = useProducts()

describe('subcategorías — taxonomía y datos', () => {
  it('todos los slugs son únicos', () => {
    const slugs = subcategories.map(s => s.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('cada subcategoría apunta a categorías existentes del catálogo', () => {
    const cats = new Set(products.map(p => p.category))
    const rotas = subcategories.filter(s => !subCats(s).every(c => cats.has(c)))
    expect(rotas.map(s => s.slug)).toEqual([])
  })

  it('subcatBySlug encuentra la definición y es undefined si no existe', () => {
    expect(subcatBySlug('bala-vibradora')?.label).toBe('Bala Vibradora')
    expect(subcatBySlug('no-existe-xyz')).toBeUndefined()
  })
})

describe('subcategorías — filtrado (bug 4: muestra SOLO sus productos)', () => {
  it('bySubcategory devuelve solo productos que pertenecen a la subcategoría', () => {
    const sub = subcatBySlug('bala-vibradora')!
    const res = bySubcategory('bala-vibradora')
    expect(res.length).toBeGreaterThan(0)
    expect(res.every(p => subCats(sub).includes(p.category))).toBe(true)
    expect(res.every(p => matchesSub(p, sub))).toBe(true)
  })

  it('una subcategoría de Masturbadores NO devuelve TODA la categoría (filtra de verdad)', () => {
    // Repro del bug: entrar a una subcolección mostraba todos los productos de la categoría.
    const todosMasturbadores = byCategory('masturbadores').length
    const res = bySubcategory('pocket-pussy')
    expect(res.length).toBeGreaterThan(0)
    expect(res.length).toBeLessThan(todosMasturbadores)
    expect(res.every(p => p.category === 'masturbadores')).toBe(true)
  })

  it('los productos filtrados realmente mencionan la palabra clave de la subcategoría', () => {
    const res = bySubcategory('huevo-vibrador')
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    expect(res.length).toBeGreaterThan(0)
    expect(res.every(p => norm(`${p.name} ${p.subtitle} ${(p.features || []).join(' ')}`).includes('huevo'))).toBe(true)
  })

  it('una subcategoría sin palabras clave equivale a la categoría completa', () => {
    // "Anillos Retardantes" -> categoría retardantes completa.
    expect(bySubcategory('anillos-retardantes').length).toBe(byCategory('retardantes').length)
  })

  it('bySubcategory con slug inexistente devuelve []', () => {
    expect(bySubcategory('no-existe-xyz')).toEqual([])
  })
})

// "Oral" es la primera subcategoría que cruza categorías: las chispas BJ Bang están
// catalogadas en `parejas` y los lubricantes de sabor en `lubricantes`, así que con una
// sola categoría la agrupación que pidió César no se podía armar.
describe('subcategorías — transversal ("Oral")', () => {
  it('junta productos de más de una categoría del catálogo', () => {
    const res = bySubcategory('oral')
    expect(res.length).toBeGreaterThan(0)
    expect(new Set(res.map(p => p.category)).size).toBeGreaterThan(1)
  })

  it('trae las chispas BJ Bang (parejas) junto con los lubricantes de sabor', () => {
    const slugs = bySubcategory('oral').map(p => p.slug)
    expect(slugs).toContain('bj-bang-sandia')
    expect(slugs).toContain('bj-bang-cereza')
    expect(slugs).toContain('lubricantes-sunny')
  })

  it('sigue filtrando: no arrastra completas las categorías que cruza', () => {
    const res = bySubcategory('oral')
    expect(res.length).toBeLessThan(byCategory('lubricantes').length + byCategory('parejas').length)
  })
})

describe('subcategorías — menú dinámico (bug 3: solo las que tienen productos)', () => {
  it('subcategoriesWithProducts excluye las subcategorías vacías', () => {
    const visibles = subcategoriesWithProducts()
    // Toda subcategoría visible tiene al menos 1 producto.
    expect(visibles.every(s => bySubcategory(s.slug).length > 0)).toBe(true)
    // Existe al menos una subcategoría definida pero vacía (p.ej. "Calzón Vibrador").
    expect(subcategoryCount('calzon-vibrador')).toBe(0)
    expect(visibles.some(s => s.slug === 'calzon-vibrador')).toBe(false)
  })

  it('filtra por categoría cuando se indica', () => {
    const visiblesVibradores = subcategoriesWithProducts('vibradores')
    expect(visiblesVibradores.length).toBeGreaterThan(0)
    expect(visiblesVibradores.every(s => subCats(s).includes('vibradores'))).toBe(true)
    // "Bala Vibradora" tiene productos -> aparece (lo exige también el e2e del drawer móvil).
    expect(visiblesVibradores.some(s => s.slug === 'bala-vibradora')).toBe(true)
  })
})
