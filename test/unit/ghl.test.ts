// Puente de eventos hacia GoHighLevel.
//
// El riesgo que cubren estos tests NO es que un correo salga feo: es que un
// fallo de GHL tumbe el webhook de Mercado Pago y un pago confirmado se quede
// sin registrar. Por eso lo que más se prueba aquí es que NADA de este módulo
// pueda lanzar hacia quien lo llama, pase lo que pase con la red.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ghlConectado,
  emitirEventoGhl,
  emitirEventoGhlSinEsperar,
  payloadCompra,
} from '~/server/utils/ghl'

const URL_PRUEBA = 'https://services.leadconnectorhq.com/hooks/prueba'

beforeEach(() => {
  delete process.env.NUXT_GHL_WEBHOOK_URL
  vi.restoreAllMocks()
})

afterEach(() => {
  delete process.env.NUXT_GHL_WEBHOOK_URL
})

describe('ghlConectado', () => {
  it('es false sin la variable de entorno', () => {
    expect(ghlConectado()).toBe(false)
  })

  it('es false si la variable viene vacía o en blanco', () => {
    process.env.NUXT_GHL_WEBHOOK_URL = '   '
    expect(ghlConectado()).toBe(false)
  })

  it('es true con una URL configurada', () => {
    process.env.NUXT_GHL_WEBHOOK_URL = URL_PRUEBA
    expect(ghlConectado()).toBe(true)
  })
})

describe('emitirEventoGhl', () => {
  it('sin configurar no llama a la red y devuelve false', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(await emitirEventoGhl('compra_confirmada', { a: 1 })).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('manda POST con JSON y devuelve true cuando GHL responde ok', async () => {
    process.env.NUXT_GHL_WEBHOOK_URL = URL_PRUEBA
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, status: 200 } as any)

    expect(await emitirEventoGhl('compra_confirmada', { pedido_id: 'x1' })).toBe(true)

    const [url, init] = fetchSpy.mock.calls[0] as [string, any]
    expect(url).toBe(URL_PRUEBA)
    expect(init.method).toBe('POST')
    const enviado = JSON.parse(init.body)
    expect(enviado.evento).toBe('compra_confirmada')
    expect(enviado.pedido_id).toBe('x1')
    expect(typeof enviado.enviado_en).toBe('string') // marca de tiempo para depurar en GHL
  })

  it('devuelve false —sin lanzar— si GHL responde con error', async () => {
    process.env.NUXT_GHL_WEBHOOK_URL = URL_PRUEBA
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500 } as any)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(emitirEventoGhl('carrito_abandonado', {})).resolves.toBe(false)
  })

  it('devuelve false —sin lanzar— si la red truena', async () => {
    process.env.NUXT_GHL_WEBHOOK_URL = URL_PRUEBA
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNRESET'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(emitirEventoGhl('carrito_abandonado', {})).resolves.toBe(false)
  })

  it('devuelve false —sin lanzar— si el timeout aborta', async () => {
    process.env.NUXT_GHL_WEBHOOK_URL = URL_PRUEBA
    const abort = new Error('The operation was aborted')
    abort.name = 'TimeoutError'
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(abort)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(emitirEventoGhl('compra_confirmada', {})).resolves.toBe(false)
  })
})

describe('emitirEventoGhlSinEsperar', () => {
  // Esta es LA prueba importante: es la variante que se llama desde el webhook
  // de pagos, y no debe poder romper nada ni dejar una promesa sin manejar.
  it('no lanza aunque la red truene, y no deja rechazos sueltos', async () => {
    process.env.NUXT_GHL_WEBHOOK_URL = URL_PRUEBA
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('caída total'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const sueltos: unknown[] = []
    const onUnhandled = (r: unknown) => sueltos.push(r)
    process.on('unhandledRejection', onUnhandled)

    expect(() => emitirEventoGhlSinEsperar('compra_confirmada', {})).not.toThrow()
    await new Promise((r) => setTimeout(r, 20)) // deja correr el microtask

    process.off('unhandledRejection', onUnhandled)
    expect(sueltos).toHaveLength(0)
  })

  it('no lanza cuando no está configurado', () => {
    expect(() => emitirEventoGhlSinEsperar('carrito_recuperado', {})).not.toThrow()
  })
})

describe('payloadCompra', () => {
  const base = {
    orderId: 'ord-1',
    email: 'cliente@ejemplo.mx',
    total: 900,
    sitio: 'https://amanti.mx',
    items: [
      { slug: 'tiny-teasers-nubby', name: 'Mini Antojo Nubby', price: 301, quantity: 2 },
      { slug: 'venus-butterfly', name: 'Mariposita de Venus', price: 728, quantity: 1 },
    ],
  }

  it('arma los enlaces a la ficha de cada producto', () => {
    const p = payloadCompra(base) as any
    expect(p.items[0].url_producto).toBe('https://amanti.mx/tienda/tiny-teasers-nubby')
    expect(p.items[1].url_producto).toBe('https://amanti.mx/tienda/venus-butterfly')
  })

  it('el enlace de reseña apunta al ancla real de la ficha', () => {
    // La ficha tiene <section id="resenas">. Si alguien renombra ese ancla,
    // este test truena antes de que el correo del día 10 mande a la nada.
    const p = payloadCompra(base) as any
    expect(p.url_resena).toBe('https://amanti.mx/tienda/tiny-teasers-nubby#resenas')
  })

  it('suma las cantidades, no los renglones', () => {
    const p = payloadCompra(base) as any
    expect(p.num_articulos).toBe(3)
  })

  it('aplana el producto principal para las plantillas de GHL', () => {
    const p = payloadCompra(base) as any
    expect(p.producto_principal).toBe('Mini Antojo Nubby')
    expect(p.producto_principal_slug).toBe('tiny-teasers-nubby')
  })

  it('no truena con un pedido sin artículos', () => {
    const p = payloadCompra({ ...base, items: [] }) as any
    expect(p.num_articulos).toBe(0)
    expect(p.producto_principal).toBeNull()
    expect(p.url_resena).toBeNull()
  })

  it('no duplica la diagonal si el sitio viene con barra final', () => {
    const p = payloadCompra({ ...base, sitio: 'https://amanti.mx/' }) as any
    expect(p.url_producto).toBe('https://amanti.mx/tienda/tiny-teasers-nubby')
  })

  it('deja pasar email null (pedido de invitado) sin romperse', () => {
    const p = payloadCompra({ ...base, email: null }) as any
    expect(p.email).toBeNull()
    expect(p.pedido_id).toBe('ord-1')
  })
})
