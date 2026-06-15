import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import data from '~/data/products.json'

const root = process.cwd()
const products = data.products as any[]
const categories = data.categories as any[]
const catSlugs = new Set(categories.map(c => c.slug))

describe('catálogo (smoke)', () => {
  it('products.json es válido y tiene 143 productos', () => {
    expect(Array.isArray(products)).toBe(true)
    expect(products.length).toBe(143)
  })

  it('hay 10 categorías', () => {
    expect(categories.length).toBe(10)
  })

  it('no hay slugs duplicados', () => {
    const slugs = products.map(p => p.slug)
    const dups = slugs.filter((s, i) => slugs.indexOf(s) !== i)
    expect(dups).toEqual([])
  })

  it('cada producto tiene name, price>0 y categoría válida', () => {
    const bad = products.filter(
      p => !p.name || typeof p.price !== 'number' || p.price <= 0 || !catSlugs.has(p.category),
    )
    expect(bad.map(p => p.slug)).toEqual([])
  })

  it('cada imagen declarada existe en public/products/', () => {
    const missing: string[] = []
    for (const p of products) {
      for (const img of p.images || []) {
        const rel = img.replace(/^\//, '') // products/<slug>_1.jpg
        if (!existsSync(join(root, 'public', rel))) missing.push(img)
      }
    }
    expect(missing).toEqual([])
  })

  it('cada categoría declarada tiene al menos 1 producto', () => {
    const empty = categories.filter(c => !products.some(p => p.category === c.slug))
    expect(empty.map(c => c.slug)).toEqual([])
  })
})
