import { describe, it, expect } from 'vitest'
import { scoreProduct } from '~/composables/usePersonalization'

// scoreProduct(p, answers) es una función pura: dado un producto y las respuestas
// del quiz, devuelve un número (rating base + bonificaciones/penalizaciones).
// Estos tests verifican los casos clave del scoring sin Nuxt ni runtime de browser.

// Helper: construye un producto mínimo con texto NEUTRO (sin palabras que
// disparen reglas de vibe/exp), para aislar la regla bajo prueba.
function makeProduct(overrides: Record<string, any> = {}) {
  return {
    rating: 4,
    category: 'vibradores',
    price: 800,
    name: 'Producto',
    subtitle: 'Subtitulo',
    badges: [] as string[],
    description: 'Descripcion',
    ...overrides,
  }
}

const EMPTY = { who: '', vibe: '', exp: '', budget: '' }

describe('scoreProduct (personalizacion)', () => {
  it('con todas las respuestas vacias devuelve exactamente p.rating', () => {
    const p = makeProduct({ rating: 4.2, price: 800 })
    expect(scoreProduct(p, { who: '', vibe: '', exp: '', budget: '' })).toBe(4.2)
  })

  it('who="mi" + category "vibradores" suma +2.5 sobre el rating base', () => {
    // Texto neutro y price >= 700 para que ninguna otra regla intervenga;
    // solo who="mi" esta activo, asi que la unica bonificacion es +2.5.
    const p = makeProduct({ rating: 3, category: 'vibradores', price: 900 })
    const base = scoreProduct(p, EMPTY) // = p.rating = 3
    const withWho = scoreProduct(p, { ...EMPTY, who: 'mi' })
    expect(withWho).toBe(base + 2.5)
    expect(withWho).toBeCloseTo(5.5, 10)
  })

  it('budget="bajo" penaliza (-2) un producto con price>600', () => {
    // category "lubricantes" no dispara reglas con answers vacias salvo budget;
    // price=900 (>600) => penalizacion de -2.
    const p = makeProduct({ rating: 4, category: 'lubricantes', price: 900 })
    const base = scoreProduct(p, EMPTY) // = 4
    const withBudget = scoreProduct(p, { ...EMPTY, budget: 'bajo' })
    expect(withBudget).toBe(base - 2)
    expect(withBudget).toBeCloseTo(2, 10)
  })

  it('budget="bajo" premia (+1.8) un producto con price<=600', () => {
    // price=600 (<=600) => bonificacion de +1.8.
    const p = makeProduct({ rating: 4, category: 'lubricantes', price: 600 })
    const base = scoreProduct(p, EMPTY) // = 4
    const withBudget = scoreProduct(p, { ...EMPTY, budget: 'bajo' })
    expect(withBudget).toBe(base + 1.8)
    expect(withBudget).toBeCloseTo(5.8, 10)
  })
})
