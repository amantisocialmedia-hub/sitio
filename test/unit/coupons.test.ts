import { describe, it, expect } from 'vitest'
import { normalizeCode, computeDiscount, validateCoupon, type CouponRow } from '~/server/utils/coupons'

// Cupón base válido; cada test sobreescribe lo que necesita.
const C = (over: Partial<CouponRow> = {}): CouponRow => ({
  code: 'AMANTI15',
  type: 'percent',
  value: 15,
  min_subtotal: null,
  active: true,
  expires_at: null,
  max_uses: null,
  used_count: 0,
  ...over,
})

const NOW = new Date('2026-06-23T12:00:00Z')

// Estos casos prueban la lógica del cupón en sí, así que se les pasa el cuarto
// argumento en true: no deben depender de si hay una campaña global encendida.
// Esa interacción tiene sus propios tests en test/unit/campana.test.ts.

describe('normalizeCode', () => {
  it('recorta y pasa a MAYÚSCULAS', () => {
    expect(normalizeCode('  amanti15 ')).toBe('AMANTI15')
    expect(normalizeCode('Verano2026')).toBe('VERANO2026')
  })
  it('tolera null/undefined/número', () => {
    expect(normalizeCode(null)).toBe('')
    expect(normalizeCode(undefined)).toBe('')
    expect(normalizeCode(123 as any)).toBe('123')
  })
})

describe('computeDiscount', () => {
  it('percent = subtotal * value / 100', () => {
    expect(computeDiscount('percent', 15, 1000)).toBe(150)
    expect(computeDiscount('percent', 10, 333.33)).toBe(33.33) // redondeo 2 decimales
  })
  it('fixed = min(value, subtotal)', () => {
    expect(computeDiscount('fixed', 100, 1000)).toBe(100)
    expect(computeDiscount('fixed', 1500, 1000)).toBe(1000) // no supera el subtotal
  })
  it('nunca negativo ni mayor que el subtotal', () => {
    expect(computeDiscount('percent', 200, 500)).toBe(500) // 200% acotado a subtotal
    expect(computeDiscount('fixed', -50, 500)).toBe(0)
  })
})

describe('validateCoupon', () => {
  it('válido (percent): devuelve discount, type y value', () => {
    const r = validateCoupon(C({ value: 15 }), 1000, NOW, true)
    expect(r).toMatchObject({ valid: true, type: 'percent', value: 15, discount: 150 })
  })

  it('válido (fixed): discount = min(value, subtotal)', () => {
    const r = validateCoupon(C({ type: 'fixed', value: 100 }), 1000, NOW, true)
    expect(r).toMatchObject({ valid: true, type: 'fixed', discount: 100 })
  })

  it('no existe (null) → inválido, discount 0', () => {
    const r = validateCoupon(null, 1000, NOW, true)
    expect(r.valid).toBe(false)
    expect(r.discount).toBe(0)
  })

  it('inactivo → rechazado', () => {
    expect(validateCoupon(C({ active: false }), 1000, NOW, true).valid).toBe(false)
  })

  it('expirado (expires_at en el pasado) → rechazado', () => {
    const r = validateCoupon(C({ expires_at: '2026-06-01T00:00:00Z' }), 1000, NOW, true)
    expect(r.valid).toBe(false)
    expect(r.message).toMatch(/expir/i)
  })

  it('vigente (expires_at futuro) → válido', () => {
    expect(validateCoupon(C({ expires_at: '2026-12-31T00:00:00Z' }), 1000, NOW, true).valid).toBe(true)
  })

  it('agotado (used_count >= max_uses) → rechazado', () => {
    expect(validateCoupon(C({ max_uses: 5, used_count: 5 }), 1000, NOW, true).valid).toBe(false)
    expect(validateCoupon(C({ max_uses: 5, used_count: 6 }), 1000, NOW, true).valid).toBe(false)
  })

  it('con usos disponibles → válido; max_uses null = sin límite', () => {
    expect(validateCoupon(C({ max_uses: 5, used_count: 4 }), 1000, NOW, true).valid).toBe(true)
    expect(validateCoupon(C({ max_uses: null, used_count: 999 }), 1000, NOW, true).valid).toBe(true)
  })

  it('subtotal por debajo del mínimo → rechazado', () => {
    const r = validateCoupon(C({ min_subtotal: 1000 }), 800, NOW, true)
    expect(r.valid).toBe(false)
    expect(r.discount).toBe(0)
    expect(r.message).toMatch(/mínimo/i)
  })

  it('subtotal igual al mínimo → válido (>=)', () => {
    expect(validateCoupon(C({ min_subtotal: 1000 }), 1000, NOW, true).valid).toBe(true)
  })

  it('descuento que daría 0 (value 0) → rechazado', () => {
    expect(validateCoupon(C({ value: 0 }), 1000, NOW, true).valid).toBe(false)
  })
})
