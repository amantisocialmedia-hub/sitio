import { describe, it, expect } from 'vitest'
import { resolveItems, computeTotal, buildOrderRows, MAX_QTY } from '~/server/utils/orderItems'

// Lógica money-critical de pedidos: resolución de precios AUTORITATIVOS (no confía en el cliente),
// coerción de cantidades y armado del snapshot order_items. Sin Supabase ni secretos.
describe('orderItems — resolución autoritativa', () => {
  it('toma el precio del catálogo por slug e IGNORA el price del cliente', () => {
    const out = resolveItems([{ slug: 'vibrating-g', name: 'Vibrating G', price: 1, quantity: 2 }])
    expect(out).toHaveLength(1)
    expect(out[0].unitPrice).toBe(921)         // catálogo, no el 1 del atacante
    expect(out[0].lineTotal).toBe(1842)
    expect(out[0].imageUrl).toContain('/products/vibrating-g')
  })

  it('el nombre cae al catálogo si el cliente no lo manda (el price sigue siendo autoritativo)', () => {
    const out = resolveItems([{ slug: 'denzel', quantity: 1 }])
    expect(out[0].name).toContain('Denzel')     // nombre del catálogo
    expect(out[0].unitPrice).toBe(400)
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

  it('acepta un catálogo inyectado (testabilidad)', () => {
    const cat = { price: { foo: 50 }, name: { foo: 'Foo' }, img: { foo: '/x.jpg' } }
    const out = resolveItems([{ slug: 'foo', quantity: 3 }], cat)
    expect(out[0]).toMatchObject({ slug: 'foo', name: 'Foo', unitPrice: 50, quantity: 3, lineTotal: 150, imageUrl: '/x.jpg' })
  })

  it('computeTotal suma los line totals resueltos', () => {
    const items = resolveItems([
      { slug: 'vibrating-g', quantity: 2 }, // 1842
      { slug: 'denzel', quantity: 1 },      // 400
    ])
    expect(computeTotal(items)).toBe(2242)  // coincide con el e2e de pedidos
  })

  it('buildOrderRows arma el snapshot de order_items', () => {
    const rows = buildOrderRows('order-123', resolveItems([{ slug: 'denzel', name: 'Denzel', quantity: 3 }]))
    expect(rows[0]).toMatchObject({
      order_id: 'order-123', product_slug: 'denzel', product_name: 'Denzel',
      unit_price: 400, quantity: 3, line_total: 1200,
    })
    expect(rows[0].image_url).toContain('/products/denzel')
  })
})
