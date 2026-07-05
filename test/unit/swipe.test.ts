import { describe, it, expect } from 'vitest'
import { swipeStep, stepIndex } from '~/utils/swipe'

describe('swipeStep — gesto horizontal de la galería (QA móvil)', () => {
  it('ignora gestos por debajo del umbral (40px)', () => {
    expect(swipeStep(39, 0)).toBe(0)
    expect(swipeStep(-39, 0)).toBe(0)
    expect(swipeStep(0, 0)).toBe(0)
  })

  it('ignora gestos predominantemente verticales (no roba el scroll)', () => {
    expect(swipeStep(45, 80)).toBe(0)
    expect(swipeStep(60, -70)).toBe(0)
    expect(swipeStep(-45, -45)).toBe(0) // empate exacto: gana el scroll
  })

  it('deslizar a la izquierda avanza (1) y a la derecha retrocede (-1)', () => {
    expect(swipeStep(-60, 10)).toBe(1)
    expect(swipeStep(60, -10)).toBe(-1)
    expect(swipeStep(-40, 0)).toBe(1) // justo en el umbral sí navega
  })

  it('respeta un umbral personalizado', () => {
    expect(swipeStep(30, 0, 25)).toBe(-1)
    expect(swipeStep(-24, 0, 25)).toBe(0)
  })
})

describe('stepIndex — límites de la galería (sin loop en los extremos)', () => {
  it('avanza y retrocede dentro del rango', () => {
    expect(stepIndex(0, 1, 5)).toBe(1)
    expect(stepIndex(3, -1, 5)).toBe(2)
  })

  it('en los extremos no navega (null)', () => {
    expect(stepIndex(0, -1, 5)).toBeNull()
    expect(stepIndex(4, 1, 5)).toBeNull()
  })

  it('galería de una sola foto nunca navega', () => {
    expect(stepIndex(0, 1, 1)).toBeNull()
    expect(stepIndex(0, -1, 1)).toBeNull()
  })
})
