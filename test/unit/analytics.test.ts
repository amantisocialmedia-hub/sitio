import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAnalytics } from '~/composables/useAnalytics'

// useAnalytics dispara GA4 (gtag) y Meta Pixel (fbq) a la vez, y promete NUNCA lanzar
// (sin consentimiento no hay trackers). Aquí se fija ese contrato y los payloads.

const w = window as any

beforeEach(() => {
  delete w.gtag
  delete w.fbq
})

describe('useAnalytics — payloads', () => {
  it('viewItem manda view_item (GA4) y ViewContent (Pixel) con el mismo producto', () => {
    w.gtag = vi.fn()
    w.fbq = vi.fn()
    useAnalytics().viewItem({ slug: 'denzel', name: 'Denzel 8”', price: 400, category: 'dildos' })

    expect(w.gtag).toHaveBeenCalledWith('event', 'view_item', {
      currency: 'MXN',
      value: 400,
      items: [{ item_id: 'denzel', item_name: 'Denzel 8”', price: 400, quantity: 1, item_category: 'dildos' }],
    })
    expect(w.fbq).toHaveBeenCalledWith('track', 'ViewContent', {
      content_ids: ['denzel'], content_name: 'Denzel 8”', content_type: 'product', value: 400, currency: 'MXN',
    })
  })

  it('search manda search (GA4) con el termino y cuantos resultados dio, y Search (Pixel)', () => {
    w.gtag = vi.fn()
    w.fbq = vi.fn()
    useAnalytics().search('Lubricante coco', 12)

    expect(w.gtag).toHaveBeenCalledWith('event', 'search', {
      search_term: 'Lubricante coco',
      search_results: 12,
    })
    expect(w.fbq).toHaveBeenCalledWith('track', 'Search', {
      search_string: 'Lubricante coco', content_type: 'product',
    })
  })

  it('search registra la busqueda que dio CERO resultados (es la que interesa)', () => {
    w.gtag = vi.fn()
    useAnalytics().search('chocolate', 0)
    expect(w.gtag.mock.calls[0][2]).toEqual({ search_term: 'chocolate', search_results: 0 })
  })

  it('search recorta el termino y no dispara si queda vacio', () => {
    w.gtag = vi.fn()
    const a = useAnalytics()
    a.search('  coco  ', 3)
    expect(w.gtag.mock.calls[0][2].search_term).toBe('coco')
    a.search('   ', 0)
    expect(w.gtag).toHaveBeenCalledOnce()
  })

  it('addToCart multiplica value por quantity (y quantity omitida = 1)', () => {
    w.gtag = vi.fn()
    w.fbq = vi.fn()
    const a = useAnalytics()
    a.addToCart({ slug: 'denzel', name: 'Denzel', price: 400, quantity: 3 })
    expect(w.gtag.mock.calls[0][2].value).toBe(1200)
    expect(w.fbq.mock.calls[0][2].value).toBe(1200)

    a.addToCart({ slug: 'denzel', name: 'Denzel', price: 400 })
    expect(w.gtag.mock.calls[1][2].value).toBe(400)
  })

  it('beginCheckout suma num_items y junta los content_ids', () => {
    w.fbq = vi.fn()
    useAnalytics().beginCheckout(1600, [
      { slug: 'denzel', name: 'Denzel', price: 400, quantity: 2 },
      { slug: 'krono-dildo-realista', name: 'Krono', price: 400, quantity: 2 },
    ])
    expect(w.fbq).toHaveBeenCalledWith('track', 'InitiateCheckout', expect.objectContaining({
      value: 1600, num_items: 4, content_ids: ['denzel', 'krono-dildo-realista'],
    }))
  })

  it('purchase incluye transaction_id en GA4', () => {
    w.gtag = vi.fn()
    useAnalytics().purchase('order-77', 750, [{ slug: 'aselia-majestic-vibrator', name: 'Aselia', price: 750 }])
    expect(w.gtag.mock.calls[0][2].transaction_id).toBe('order-77')
  })
})

describe('useAnalytics — nunca lanza', () => {
  it('sin gtag ni fbq (sin consentimiento) es un no-op silencioso', () => {
    expect(() => useAnalytics().viewItem({ slug: 'x', name: 'X', price: 1 })).not.toThrow()
  })

  it('si un tracker lanza, se traga el error y el otro SÍ se llama', () => {
    w.gtag = vi.fn(() => { throw new Error('GA caído') })
    w.fbq = vi.fn()
    expect(() => useAnalytics().viewItem({ slug: 'x', name: 'X', price: 1 })).not.toThrow()
    expect(w.fbq).toHaveBeenCalledOnce()
  })

  it('valores no-función en window.gtag/fbq no se invocan ni lanzan', () => {
    w.gtag = 'no-soy-funcion'
    w.fbq = 42
    expect(() => useAnalytics().addToCart({ slug: 'x', name: 'X', price: 1 })).not.toThrow()
  })
})
