import { describe, it, expect, beforeEach } from 'vitest'
import { gtagPush } from '~/utils/gtag'

// Esta prueba existe por una razón muy concreta, y no es estilo.
//
// gtag.js ignora EN SILENCIO cualquier entrada del dataLayer que no sea un objeto
// `arguments`. Cuando esto se rompe no hay excepción, no hay error en consola, no
// hay nada: el script de Google carga igual y el dataLayer se ve perfecto. Lo único
// que pasa es que GA4 se queda en cero y las conversiones de Google Ads no registran
// ni una venta. Es el bug que se descubre semanas después, contando el dinero que
// ya se gastó en pauta a ciegas. Aquí se queda clavado para que no vuelva.

const w = window as any

beforeEach(() => { delete w.dataLayer })

describe('gtagPush', () => {
  it('empuja un objeto `arguments`, NUNCA un Array', () => {
    gtagPush('config', 'G-HE23F0TWMG')
    const entrada = w.dataLayer[0]
    expect(Object.prototype.toString.call(entrada)).toBe('[object Arguments]')
    expect(Array.isArray(entrada)).toBe(false)
  })

  it('conserva los argumentos en orden y con su tipo', () => {
    gtagPush('consent', 'default', { analytics_storage: 'denied', wait_for_update: 500 })
    expect(Array.from(w.dataLayer[0])).toEqual([
      'consent', 'default', { analytics_storage: 'denied', wait_for_update: 500 },
    ])
  })

  it('crea el dataLayer si no existe y va acumulando, sin pisar lo ya empujado', () => {
    gtagPush('js', new Date(0))
    gtagPush('config', 'AW-17872915568')
    expect(w.dataLayer).toHaveLength(2)
    expect(w.dataLayer[1][1]).toBe('AW-17872915568')
  })

  it('respeta un dataLayer que ya venía de antes', () => {
    w.dataLayer = [{ event: 'algo_previo' }]
    gtagPush('event', 'purchase', { value: 309 })
    expect(w.dataLayer).toHaveLength(2)
    expect(w.dataLayer[0]).toEqual({ event: 'algo_previo' })
  })
})
