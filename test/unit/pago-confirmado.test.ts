// Las transiciones de estado del pedido (server/utils/pagoConfirmado.ts),
// compartidas por Mercado Pago y PayPal desde el 24-oct-2026.
//
// La parte con Supabase se ejercita en el e2e de pedidos (FASE B); aquí va la
// regla pura, que es la que decide si un rechazo tardío puede tumbar un pago.
import { describe, it, expect } from 'vitest'
import { ALLOWED_PREV, transicionPermitida } from '~/server/utils/pagoConfirmado'

describe('transiciones del pedido', () => {
  it('solo hacia adelante: un rechazo tardío nunca revierte un pago', () => {
    expect(transicionPermitida('paid', 'cancelled')).toBe(false)
    expect(transicionPermitida('refunded', 'paid')).toBe(false)
    expect(transicionPermitida('refunded', 'cancelled')).toBe(false)
  })
  it('paid admite venir de pending y de cancelled (reintento aprobado tras un rechazo)', () => {
    expect(transicionPermitida('pending', 'paid')).toBe(true)
    expect(transicionPermitida('cancelled', 'paid')).toBe(true)
  })
  it('cancelled solo desde pending; refunded solo desde paid', () => {
    expect(transicionPermitida('pending', 'cancelled')).toBe(true)
    expect(transicionPermitida('paid', 'refunded')).toBe(true)
    expect(transicionPermitida('pending', 'refunded')).toBe(false)
  })
  it('un estado desconocido no transiciona a nada', () => {
    expect(transicionPermitida('shipped', 'paid')).toBe(false)
    expect(transicionPermitida('', 'cancelled')).toBe(false)
  })
  it('la tabla es la misma que llevaba el webhook de Mercado Pago desde agosto', () => {
    expect(ALLOWED_PREV).toEqual({ paid: ['pending', 'cancelled'], cancelled: ['pending'], refunded: ['paid'] })
  })
})
