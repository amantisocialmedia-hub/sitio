import { describe, it, expect } from 'vitest'
import { coincideBusqueda, normalizar, textoBuscable } from '~/utils/buscar'
import productsData from '~/data/products.json'

// Estas pruebas existen por una venta que se perdió y que nadie vio perderse.
//
// El 1-sep-2026 un cliente le preguntó a Nancy por WhatsApp si había lubricantes
// de chocolate y de coco. Ella buscó en el sitio —queda la sesión grabada,
// `/tienda?q=Lubricante+coco`—, el buscador devolvió CERO, y ella reportó que no
// estaban. Sí estaban: Lubricantes Sunny viene en 12 sabores y uno es coco.
//
// La causa era que el filtro hacía UN includes() de la frase completa. «coco»
// funcionaba; «Lubricante coco» no, porque esa frase exacta no aparece junta en
// ninguna ficha.

const productos = (productsData as any).products as any[]
const buscar = (q: string) => productos.filter((p) => coincideBusqueda(p, q))
const nombres = (q: string) => buscar(q).map((p) => p.name)

describe('coincideBusqueda — la regresión que costó la venta', () => {
  it('«Lubricante coco» encuentra Lubricantes Sunny', () => {
    expect(nombres('Lubricante coco')).toContain('Lubricantes Sunny')
  })

  it('la búsqueda exacta que hizo Nancy no puede volver a dar cero', () => {
    expect(buscar('Lubricante coco').length).toBeGreaterThan(0)
  })

  it('otras frases que un cliente escribiría tampoco dan cero', () => {
    for (const q of ['lubricante de sabor', 'lubricantes con sabor', 'gel sabor cereza']) {
      expect(buscar(q).length, `«${q}» no devolvió nada`).toBeGreaterThan(0)
    }
  })
})

describe('coincideBusqueda — cómo compara', () => {
  it('pide TODAS las palabras, no cualquiera', () => {
    // «coco» solo está en Lubricantes Sunny. Sumarle una palabra que ese
    // producto no tiene debe dejar la lista vacía, no ampliarla.
    expect(buscar('coco arnes').length).toBe(0)
  })

  it('no le importa el orden de las palabras', () => {
    expect(nombres('coco lubricante')).toEqual(nombres('lubricante coco'))
  })

  it('ignora acentos en los dos lados', () => {
    expect(normalizar('Piña Colada')).toBe('pina colada')
    expect(nombres('pina colada')).toContain('Antojo Piña Colada')
    expect(nombres('piña colada')).toContain('Antojo Piña Colada')
  })

  it('ignora espacios de sobra', () => {
    expect(nombres('  lubricante   coco  ')).toContain('Lubricantes Sunny')
  })

  // Consulta vacía = sin filtro. Si devolviera cero, la tienda se vería vacía
  // al borrar el texto del buscador.
  it('consulta vacía o de puros espacios coincide con todo', () => {
    expect(coincideBusqueda(productos[0], '')).toBe(true)
    expect(coincideBusqueda(productos[0], '   ')).toBe(true)
  })
})

describe('textoBuscable — mira todos los campos', () => {
  // El buscador del encabezado NO miraba la descripción, y ahí viven los
  // sabores. Por eso «coco» tampoco funcionaba en el desplegable del celular,
  // que es el que más se usa.
  it('incluye la descripción, que es donde viven los sabores', () => {
    const sunny = productos.find((p) => p.slug === 'lubricantes-sunny')
    expect(textoBuscable(sunny)).toContain('coco')
  })

  it('incluye la categoría', () => {
    const sunny = productos.find((p) => p.slug === 'lubricantes-sunny')
    expect(textoBuscable(sunny)).toContain('lubricantes')
  })
})

describe('chocolate sigue sin existir', () => {
  // No es un bug: no está en el catálogo. Si algún día alguien lo da de alta,
  // esta prueba truena y hay que avisarle a Nancy, que tiene un cliente
  // esperándolo desde el 1-sep-2026.
  it('nadie vende chocolate todavía', () => {
    expect(buscar('chocolate').length).toBe(0)
  })
})
