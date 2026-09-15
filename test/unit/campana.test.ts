// Campaña global de descuento. El riesgo que cubren estos tests no es que el
// banner se vea mal: es que el sitio ENSEÑE un precio y COBRE otro. Por eso lo
// que más se prueba aquí es que el catálogo del navegador y el del servidor
// salgan del mismo cálculo.
import { describe, it, expect } from 'vitest'
import productsData from '~/data/products.json'
import {
  BANNER_TEMPORADA,
  CAMPANA,
  CAMPANA_PCT,
  CUPONES_ACEPTADOS,
  MOSTRAR_CUPONES,
  aplicarCampana,
  bannerVigente,
  diaMx,
  precioCampana,
  type BannerTemporada,
  type CampanaCfg,
} from '~/utils/campana'
import { priceBySlug } from '~/server/utils/orderItems'
import { validateCoupon, type CouponRow } from '~/server/utils/coupons'

const catalogo = (productsData as any).products as { slug: string; price: number; compareAt: number }[]

const encendida: CampanaCfg = { activa: true, nombre: 'Prueba', gancho: '', descuento: 0.4 }
const apagada: CampanaCfg = { ...encendida, activa: false }

// Banner de temporada. Lo que se prueba aquí es la promesa que se le hizo a César: que se
// apaga SOLO, y que lo hace a la medianoche de México y no a la de UTC (seis horas antes,
// que es la que tiene el servidor de Vercel).
describe('bannerVigente — caducidad por fecha', () => {
  const patrio: BannerTemporada = { ...BANNER_TEMPORADA, activo: true, desde: '2026-09-15', hasta: '2026-09-16' }
  // México (CDMX) es UTC-6 todo el año desde que se quitó el horario de verano en 2022.
  const mx = (y: number, m: number, d: number, h: number, min = 0) => new Date(Date.UTC(y, m - 1, d, h + 6, min))

  it('el día de hoy se lee en hora de México, no en la del servidor', () => {
    // 15-sep 21:00 en Morelia. En UTC ya es 16-sep 03:00.
    expect(diaMx(mx(2026, 9, 15, 21))).toBe('2026-09-15')
  })

  it('no se ve antes de la fecha de inicio', () => {
    expect(bannerVigente(mx(2026, 9, 14, 23, 59), patrio, encendida)).toBe(false)
  })

  it('se ve desde el primer minuto del 15 y hasta el último del 16', () => {
    expect(bannerVigente(mx(2026, 9, 15, 0, 1), patrio, encendida)).toBe(true)
    expect(bannerVigente(mx(2026, 9, 15, 23, 0), patrio, encendida)).toBe(true)
    expect(bannerVigente(mx(2026, 9, 16, 23, 59), patrio, encendida)).toBe(true)
  })

  it('se apaga solo a la medianoche del 17, sin que nadie lo toque', () => {
    expect(bannerVigente(mx(2026, 9, 17, 0, 1), patrio, encendida)).toBe(false)
    expect(bannerVigente(mx(2026, 9, 20, 12), patrio, encendida)).toBe(false)
  })

  it('con la campaña apagada no se ve, aunque esté en fecha: anuncia un 40% que ya no existe', () => {
    expect(bannerVigente(mx(2026, 9, 15, 12), patrio, apagada)).toBe(false)
  })

  it('el interruptor manual también lo apaga', () => {
    expect(bannerVigente(mx(2026, 9, 15, 12), { ...patrio, activo: false }, encendida)).toBe(false)
  })

  it('las imágenes que anuncia existen en public/', async () => {
    const { existsSync } = await import('node:fs')
    for (const ruta of [BANNER_TEMPORADA.imagen, BANNER_TEMPORADA.imagenMovil]) {
      expect(existsSync(`public${ruta}`), `falta public${ruta}`).toBe(true)
    }
  })
})

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
