import { describe, it, expect } from 'vitest'
import { resolveItems, computeTotal, buildOrderRows, MAX_QTY } from '~/server/utils/orderItems'
import { precioVigente } from '~/utils/campana'

// Los precios esperados se derivan del de lista en vez de escribirse a mano, para
// que estos tests sigan siendo válidos con la campaña de descuento encendida o
// apagada. precioVigente() es justo lo que el sitio cobra hoy.
const P_VIBRATING_G = precioVigente(921)
const P_DENZEL = precioVigente(400)

// Lógica money-critical de pedidos: resolución de precios AUTORITATIVOS (no confía en el cliente),
// coerción de cantidades y armado del snapshot order_items. Sin Supabase ni secretos.
describe('orderItems — resolución autoritativa', () => {
  it('toma el precio del catálogo por slug e IGNORA el price del cliente', () => {
    const out = resolveItems([{ slug: 'vibrating-g', name: 'Vibrating G', price: 1, quantity: 2 }])
    expect(out).toHaveLength(1)
    expect(out[0].unitPrice).toBe(P_VIBRATING_G) // catálogo, no el 1 del atacante
    expect(out[0].lineTotal).toBe(P_VIBRATING_G * 2)
    expect(out[0].imageUrl).toContain('/products/vibrating-g')
  })

  it('el nombre cae al catálogo si el cliente no lo manda (el price sigue siendo autoritativo)', () => {
    const out = resolveItems([{ slug: 'denzel', quantity: 1 }])
    expect(out[0].name).toContain('Denzel')     // nombre del catálogo
    expect(out[0].unitPrice).toBe(P_DENZEL)
  })

  it('coacciona quantity a entero (floor) dentro de [1, MAX_QTY]', () => {
    expect(resolveItems([{ slug: 'denzel', quantity: 2.9 as any }])[0].quantity).toBe(2)
    expect(() => resolveItems([{ slug: 'denzel', quantity: 0 }])).toThrow()
    expect(() => resolveItems([{ slug: 'denzel', quantity: -1 }])).toThrow()
    expect(() => resolveItems([{ slug: 'denzel', quantity: Number.NaN as any }])).toThrow()
    expect(() => resolveItems([{ slug: 'denzel', quantity: MAX_QTY + 1 }])).toThrow()
  })

  it('rechaza slug desconocido o ausente (400)', () => {
    expect(() => resolveItems([{ slug: 'no-existe-xyz', quantity: 1 }])).toThrow()
    expect(() => resolveItems([{ name: 'sin slug', price: 100, quantity: 1 } as any])).toThrow()
  })

  it('lanza si el carrito está vacío o nulo', () => {
    expect(() => resolveItems([])).toThrow()
    expect(() => resolveItems(null as any)).toThrow()
  })

  // Lo agotado tiene que morir en el SERVIDOR. Esconder el botón en la ficha no
  // basta: queda gente con la página abierta desde antes, con el carrito guardado
  // en el navegador, o entrando por el enlace del anuncio de Google. Si el
  // rechazo no vive aquí, esa persona paga por algo que no se le puede enviar.
  const CATALOGO = {
    price: { hay: 100, nohay: 200 },
    name: { hay: 'Sí Hay', nohay: 'Ya No Hay' },
    img: { hay: null, nohay: null },
    agotado: { hay: false, nohay: true },
  }

  it('rechaza un producto agotado aunque el cliente lo mande en el carrito', () => {
    expect(() => resolveItems([{ slug: 'nohay', quantity: 1 }], CATALOGO)).toThrow(/se agotó/)
  })

  it('nombra el producto agotado, para que se sepa cuál quitar', () => {
    expect(() => resolveItems([{ slug: 'nohay', quantity: 1 }], CATALOGO)).toThrow(/Ya No Hay/)
  })

  it('un carrito mixto no pasa: basta un agotado para detener el pedido completo', () => {
    expect(() => resolveItems([
      { slug: 'hay', quantity: 1 },
      { slug: 'nohay', quantity: 1 },
    ], CATALOGO)).toThrow(/se agotó/)
  })

  it('lo que no está agotado sigue pasando normal', () => {
    const out = resolveItems([{ slug: 'hay', quantity: 2 }], CATALOGO)
    expect(out[0].lineTotal).toBe(200)
  })

  it('un catálogo sin la bandera agotado no rompe nada', () => {
    const sinBandera = { price: { hay: 100 }, name: { hay: 'Sí Hay' }, img: { hay: null } }
    expect(resolveItems([{ slug: 'hay', quantity: 1 }], sinBandera)[0].slug).toBe('hay')
  })

  it('acepta un catálogo inyectado (testabilidad)', () => {
    const cat = { price: { foo: 50 }, name: { foo: 'Foo' }, img: { foo: '/x.jpg' } }
    const out = resolveItems([{ slug: 'foo', quantity: 3 }], cat)
    expect(out[0]).toMatchObject({ slug: 'foo', name: 'Foo', unitPrice: 50, quantity: 3, lineTotal: 150, imageUrl: '/x.jpg' })
  })

  it('computeTotal suma los line totals resueltos', () => {
    const items = resolveItems([
      { slug: 'vibrating-g', quantity: 2 },
      { slug: 'denzel', quantity: 1 },
    ])
    expect(computeTotal(items)).toBe(P_VIBRATING_G * 2 + P_DENZEL)
  })

  it('buildOrderRows arma el snapshot de order_items', () => {
    const rows = buildOrderRows('order-123', resolveItems([{ slug: 'denzel', name: 'Denzel', quantity: 3 }]))
    expect(rows[0]).toMatchObject({
      order_id: 'order-123', product_slug: 'denzel', product_name: 'Denzel',
      unit_price: P_DENZEL, quantity: 3, line_total: P_DENZEL * 3,
    })
    expect(rows[0].image_url).toContain('/products/denzel')
  })
})
