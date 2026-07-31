import { describe, it, expect, beforeEach } from 'vitest'
import { captureGclid, getGclid, waRef } from '~/utils/gclid'

// El gclid se pega en el texto del mensaje de WhatsApp, que es contenido que ve el
// cliente y que Ads después lee para atribuir. Dos cosas que no se pueden romper:
// (1) nunca meter caracteres arbitrarios de la URL en el mensaje, y
// (2) si la visita NO viene de un anuncio, el mensaje debe quedar idéntico a antes.

function land(url: string) {
  window.history.replaceState({}, '', url || '/')
}

beforeEach(() => {
  window.sessionStorage.clear()
  land('/')
})

describe('gclid', () => {
  it('sin gclid en la URL no recuerda nada y no toca el mensaje', () => {
    land('/?utm_source=meta')
    captureGclid()
    expect(getGclid()).toBe('')
    expect(waRef()).toBe('')
  })

  it('guarda el gclid de la URL de aterrizaje y lo expone como sufijo', () => {
    land('/?gclid=EAIaIQobChMI_abc-123')
    captureGclid()
    expect(getGclid()).toBe('EAIaIQobChMI_abc-123')
    expect(waRef()).toBe('\n\nref: EAIaIQobChMI_abc-123')
  })

  it('sobrevive a la navegación interna (ya no está en la URL)', () => {
    land('/?gclid=abc123')
    captureGclid()
    land('/tienda/denzel-8')
    expect(waRef()).toBe('\n\nref: abc123')
  })

  it('descarta caracteres que no son de un gclid', () => {
    land('/?gclid=' + encodeURIComponent('abc<script>&x=1 "'))
    captureGclid()
    expect(getGclid()).toBe('abcscriptx1')
  })

  it('ignora un gclid absurdamente largo en vez de pegarlo al mensaje', () => {
    land('/?gclid=' + 'a'.repeat(200))
    captureGclid()
    expect(getGclid()).toBe('')
    expect(waRef()).toBe('')
  })
})
