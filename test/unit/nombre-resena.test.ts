// Con qué nombre sale publicada una reseña.
//
// La prueba que importa es la tercera: que NO haya forma de que el nombre del
// envío termine en la ficha pública. Antes ese era el comportamiento por
// omisión, y en una tienda de entrega discreta eso es un problema, no un
// detalle.
import { describe, it, expect } from 'vitest'
import { nombreResena, NOMBRE_RESENA_NEUTRO } from '~/utils/nombreResena'

describe('nombre público de una reseña', () => {
  it('usa el que el cliente escribió', () => {
    expect(nombreResena('Andrea')).toBe('Andrea')
  })

  it('le quita los espacios de los lados', () => {
    expect(nombreResena('  Andrea  ')).toBe('Andrea')
  })

  it('sin nombre escrito va la etiqueta neutra, nunca otra cosa', () => {
    expect(nombreResena('')).toBe(NOMBRE_RESENA_NEUTRO)
    expect(nombreResena('   ')).toBe(NOMBRE_RESENA_NEUTRO)
    expect(nombreResena(undefined)).toBe(NOMBRE_RESENA_NEUTRO)
    expect(nombreResena(null)).toBe(NOMBRE_RESENA_NEUTRO)
  })

  it('corta a 60 para que nadie use el campo de pizarrón', () => {
    expect(nombreResena('a'.repeat(200))).toHaveLength(60)
  })
})
