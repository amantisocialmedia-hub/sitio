// Campaña global de descuento. El riesgo que cubren estos tests no es que el
// banner se vea mal: es que el sitio ENSEÑE un precio y COBRE otro. Por eso lo
// que más se prueba aquí es que el catálogo del navegador y el del servidor
// salgan del mismo cálculo.
import { describe, it, expect } from 'vitest'
import productsData from '~/data/products.json'
import {
  CAMPANA,
  CAMPANA_PCT,
  CUPONES_ACEPTADOS,
  MOSTRAR_CUPONES,
  aplicarCampana,
  precioCampana,
  type CampanaCfg,
} from '~/utils/campana'
import { priceBySlug } from '~/server/utils/orderItems'
import { validateCoupon, type CouponRow } from '~/server/utils/coupons'

const catalogo = (productsData as any).products as { slug: string; price: number; compareAt: number }[]

const encendida: CampanaCfg = { activa: true, nombre: 'Prueba', gancho: '', descuento: 0.4 }
const apagada: CampanaCfg = { ...encendida, activa: false }

describe('precioCampana', () => {
  it('descuenta el porcentaje y redondea al peso', () => {
    expect(precioCampana(1000, encendida)).toBe(600)
    expect(precioCampana(501, encendida)).toBe(301) // 300.6 -> 301
    expect(precioCampana(99, encendida)).toBe(59) //  59.4 -> 59
  })

  it('nunca devuelve NaN con basura de entrada', () => {
    expect(precioCampana(NaN, encendida)).toBe(0)
    expect(precioCampana(undefined as any, encendida)).toBe(0)
  })
})

describe('aplicarCampana', () => {
  it('apagada devuelve la MISMA lista, sin copiar ni tocar precios', () => {
    const items = [{ slug: 'a', price: 500, compareAt: 0 }]
    expect(aplicarCampana(items, apagada)).toBe(items)
  })

  it('encendida baja el precio y guarda el de lista para tacharlo', () => {
    const [p] = aplicarCampana([{ slug: 'a', price: 500, compareAt: 0 }], encendida)
    expect(p.price).toBe(300)
    expect(p.compareAt).toBe(500) // la UI ya sabe tachar compareAt cuando > price
  })

  it('no muta la lista original', () => {
    const items = [{ slug: 'a', price: 500, compareAt: 0 }]
    aplicarCampana(items, encendida)
    expect(items[0].price).toBe(500)
  })

  it('deja el catálogo entero con descuento y sin precios negativos ni cero', () => {
    const conCampana = aplicarCampana(catalogo, encendida)
    expect(conCampana).toHaveLength(catalogo.length)
    conCampana.forEach((p, i) => {
      expect(p.price).toBeGreaterThan(0)
      expect(p.price).toBeLessThan(catalogo[i].price)
      expect(p.compareAt).toBe(catalogo[i].price)
    })
  })
})

describe('el precio que se muestra es el que se cobra', () => {
  // Si alguien agrega la campaña en la vista y olvida el servidor (o al revés),
  // este test truena antes de que un cliente pague de más.
  it('el catálogo del navegador y el autoritativo del servidor coinciden slug por slug', () => {
    const vista = aplicarCampana(catalogo) // misma llamada que hace useProducts()
    expect(Object.keys(priceBySlug)).toHaveLength(vista.length)
    vista.forEach((p) => {
      expect(priceBySlug[p.slug]).toBe(p.price)
    })
  })
})

describe('cupones durante la campaña', () => {
  const cupon: CouponRow = {
    code: 'AMANTI15', type: 'percent', value: 15, min_subtotal: null,
    active: true, expires_at: null, max_uses: null, used_count: 0,
  }

  it('con la campaña encendida el servidor los rechaza (no se apilan descuentos)', () => {
    const r = validateCoupon(cupon, 1000, new Date(), false)
    expect(r.valid).toBe(false)
    expect(r.discount).toBe(0)
  })

  it('con la campaña apagada siguen funcionando igual que siempre', () => {
    const r = validateCoupon(cupon, 1000, new Date(), true)
    expect(r.valid).toBe(true)
    expect(r.discount).toBe(150)
  })
})

describe('interruptores', () => {
  it('los cupones se aceptan si y solo si no hay campaña', () => {
    expect(CUPONES_ACEPTADOS).toBe(!CAMPANA.activa)
  })

  it('nunca se anuncian cupones durante la campaña', () => {
    if (CAMPANA.activa) expect(MOSTRAR_CUPONES).toBe(false)
  })

  it('el porcentaje del texto corresponde al descuento aplicado', () => {
    expect(CAMPANA_PCT).toBe(Math.round(CAMPANA.descuento * 100))
  })
})
