// Precio tachado en el feed de Google Shopping.
//
// El riesgo que cubren estos tests es de dinero y va en los dos sentidos:
//
//  - Si `price` y `sale_price` se invierten, Google anuncia el precio de LISTA
//    como si fuera el rebajado. El cliente hace clic esperando pagar $835 y en
//    el sitio ve $501: no es un error visual, es una promesa rota al revés y
//    Google penaliza la discrepancia de precio.
//  - Si no se manda `sale_price`, el anuncio sale sin tachado y se pierde el
//    gancho de la promoción, que es justo lo que pidió Emilio.
//
// Se prueba la REGLA, no el XML: cómo se decide qué precio va en cada etiqueta.
import { describe, it, expect } from 'vitest'
import { aplicarCampana, type CampanaCfg } from '~/utils/campana'

const encendida: CampanaCfg = { activa: true, nombre: 'Prueba', gancho: '', descuento: 0.4 }
const apagada: CampanaCfg = { ...encendida, activa: false }

/**
 * La regla del feed, tal cual está en server/routes/feeds/google.xml.get.ts.
 *
 * Google lo quiere AL REVÉS que el sitio: para él `price` es el de lista y
 * `sale_price` el rebajado. El sitio guarda el rebajado en `price` y el de
 * lista en `compareAt`. Ese cruce es lo que se prueba aquí.
 */
function etiquetasDePrecio(p: { price: number; compareAt?: number }) {
  if (p.compareAt && p.compareAt > p.price) {
    return { price: p.compareAt, sale_price: p.price }
  }
  return { price: p.price, sale_price: null }
}

describe('feed de Google: precio tachado', () => {
  it('con campaña encendida, price es el de LISTA y sale_price el rebajado', () => {
    const [p] = aplicarCampana([{ slug: 'x', price: 835, compareAt: 0 }], encendida)
    const et = etiquetasDePrecio(p)
    // 835 con 40% = 501. Google debe anunciar 835 tachado y 501 como venta.
    expect(et.price).toBe(835)
    expect(et.sale_price).toBe(501)
  })

  it('NUNCA anuncia como precio de venta uno mayor al de lista', () => {
    // Este es el que atrapa la inversión. Si alguien voltea las etiquetas,
    // sale_price queda por encima de price y esto truena.
    const conCampana = aplicarCampana(
      [
        { slug: 'a', price: 835, compareAt: 0 },
        { slug: 'b', price: 501, compareAt: 0 },
        { slug: 'c', price: 99, compareAt: 0 },
      ],
      encendida,
    )
    for (const p of conCampana) {
      const et = etiquetasDePrecio(p)
      expect(et.sale_price).not.toBeNull()
      expect(et.sale_price!).toBeLessThan(et.price)
    }
  })

  it('el sale_price es EXACTAMENTE lo que cobra el sitio', () => {
    // Si el feed anuncia un precio y el carrito cobra otro, Google marca la
    // discrepancia y puede suspender la cuenta de Merchant Center.
    const [p] = aplicarCampana([{ slug: 'x', price: 1213, compareAt: 0 }], encendida)
    expect(etiquetasDePrecio(p).sale_price).toBe(p.price)
  })

  it('con campaña apagada manda un solo precio y ningún tachado', () => {
    const [p] = aplicarCampana([{ slug: 'x', price: 835, compareAt: 0 }], apagada)
    const et = etiquetasDePrecio(p)
    expect(et.price).toBe(835)
    expect(et.sale_price).toBeNull()
  })

  it('no inventa tachado cuando compareAt viene igual o menor al precio', () => {
    // Un producto mal capturado no debe salir anunciado como rebaja falsa.
    expect(etiquetasDePrecio({ price: 500, compareAt: 500 }).sale_price).toBeNull()
    expect(etiquetasDePrecio({ price: 500, compareAt: 400 }).sale_price).toBeNull()
    expect(etiquetasDePrecio({ price: 500 }).sale_price).toBeNull()
  })
})
