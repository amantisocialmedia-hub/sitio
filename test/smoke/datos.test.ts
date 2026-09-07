import { describe, it, expect } from 'vitest'
import data from '~/data/products.json'
import articlesData from '~/data/articles.json'
import kitsData from '~/data/kits.json'
import reviewsData from '~/data/reviews.json'

// Integridad referencial entre los archivos de data/: un slug con typo aquí no truena
// el build — el producto simplemente desaparece del carrusel/kit en silencio.
const slugs = new Set((data.products as any[]).map(p => p.slug))
const catSlugs = new Set((data.categories as any[]).map(c => c.slug))
const articles = (articlesData as any).articles as any[]
const kits = (kitsData as any).kits as any[]

describe('datos (smoke) — integridad referencial', () => {
  // Sin número exacto a propósito: la Eroteca crece con el plan editorial (7 artículos
  // programados desde sep-2026), y clavar el conteo obliga a tocar el test cada semana
  // sin comprobar nada más. Lo que importa es que no haya slugs repetidos —eso sí rompe
  // el ruteo de /blog/<slug>— y que ninguno entre sin sus campos base.
  it('articles.json: artículos con slug único y campos base', () => {
    expect(articles.length).toBeGreaterThanOrEqual(12)
    const s = articles.map(a => a.slug)
    expect(new Set(s).size).toBe(s.length)
    const bad = articles.filter(a => !a.title || !a.excerpt || !a.body || !a.category)
    expect(bad.map(a => a.slug)).toEqual([])
  })

  it('articles.json: relatedProducts y relatedCategory apuntan a slugs existentes', () => {
    const rotos: string[] = []
    for (const a of articles) {
      for (const s of a.relatedProducts || []) if (!slugs.has(s)) rotos.push(`${a.slug} → ${s}`)
      if (a.relatedCategory && !catSlugs.has(a.relatedCategory)) rotos.push(`${a.slug} → cat:${a.relatedCategory}`)
    }
    expect(rotos).toEqual([])
  })

  it('kits.json: cada kit tiene ≥2 items y todos existen en el catálogo', () => {
    expect(kits.length).toBeGreaterThan(0)
    const rotos: string[] = []
    for (const k of kits) {
      if ((k.items || []).length < 2) rotos.push(`${k.slug}: <2 items`)
      for (const s of k.items || []) if (!slugs.has(s)) rotos.push(`${k.slug} → ${s}`)
    }
    expect(rotos).toEqual([])
  })

  it('reviews.json: cada slug con reseñas curadas existe en el catálogo', () => {
    const rotos = Object.keys(reviewsData as Record<string, unknown>).filter(s => !slugs.has(s))
    expect(rotos).toEqual([])
  })
})
