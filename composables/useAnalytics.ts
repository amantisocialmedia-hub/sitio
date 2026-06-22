// Eventos de ecommerce que disparan GA4 (gtag) y Meta Pixel (fbq) a la vez.
// No-op si los trackers no están cargados (sin consentimiento) — nunca lanza.
interface Line { slug: string; name: string; price: number; quantity?: number; category?: string }

function emit(gaEvent: string, gaParams: Record<string, any>, fbEvent: string, fbParams: Record<string, any>) {
  if (typeof window === 'undefined') return
  const w = window as any
  try { if (typeof w.gtag === 'function') w.gtag('event', gaEvent, gaParams) } catch {}
  try { if (typeof w.fbq === 'function') w.fbq('track', fbEvent, fbParams) } catch {}
}

const gaItems = (items: Line[]) => items.map(i => ({
  item_id: i.slug, item_name: i.name, price: i.price, quantity: i.quantity ?? 1, item_category: i.category,
}))

export function useAnalytics() {
  const viewItem = (p: Line) => emit(
    'view_item',
    { currency: 'MXN', value: p.price, items: gaItems([p]) },
    'ViewContent',
    { content_ids: [p.slug], content_name: p.name, content_type: 'product', value: p.price, currency: 'MXN' },
  )
  const addToCart = (p: Line) => {
    const value = p.price * (p.quantity ?? 1)
    emit(
      'add_to_cart',
      { currency: 'MXN', value, items: gaItems([p]) },
      'AddToCart',
      { content_ids: [p.slug], content_name: p.name, content_type: 'product', value, currency: 'MXN' },
    )
  }
  const beginCheckout = (value: number, items: Line[]) => emit(
    'begin_checkout',
    { currency: 'MXN', value, items: gaItems(items) },
    'InitiateCheckout',
    { value, currency: 'MXN', num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0), content_ids: items.map(i => i.slug) },
  )
  const purchase = (transactionId: string, value: number, items: Line[]) => emit(
    'purchase',
    { transaction_id: transactionId, currency: 'MXN', value, items: gaItems(items) },
    'Purchase',
    { value, currency: 'MXN', content_ids: items.map(i => i.slug), content_type: 'product' },
  )
  return { viewItem, addToCart, beginCheckout, purchase }
}
