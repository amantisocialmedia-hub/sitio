// Puente de eventos hacia GoHighLevel.
//
// Dos riesgos, y los dos cuestan:
//
// 1. Que un fallo de GHL tumbe el webhook de Mercado Pago y un pago confirmado
//    se quede sin registrar. Por eso se prueba que NADA de este módulo pueda
//    lanzar hacia quien lo llama, pase lo que pase con la red.
// 2. Que disparemos de más. Los triggers de GHL son premium y se cobran POR USO,
//    y /api/cart-save se llama 8-10 veces por comprador. Por eso `debeAvisarCarrito`
//    tiene su propio bloque de pruebas: es la regla que evita la factura.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ghlConectado,
  emitirEventoGhl,
  emitirEventoGhlSinEsperar,
  debeAvisarCarrito,
  payloadCompra,
} from '~/server/utils/ghl'

const URL_POSTCOMPRA = 'https://services.leadconnectorhq.com/hooks/CUENTA/webhook-trigger/postcompra'
const URL_CARRITO = 'https://services.leadconnectorhq.com/hooks/CUENTA/webhook-trigger/carrito'
const URL_REACTIVACION = 'https://services.leadconnectorhq.com/hooks/CUENTA/webhook-trigger/reactivacion'

const TODAS = [
  'NUXT_GHL_WEBHOOK_POSTCOMPRA',
  'NUXT_GHL_WEBHOOK_CARRITO_ABANDONADO',
  'NUXT_GHL_WEBHOOK_REACTIVACION',
]
const limpiar = () => TODAS.forEach((k) => delete process.env[k])

beforeEach(() => { limpiar(); vi.restoreAllMocks() })
afterEach(limpiar)

describe('ghlConectado', () => {
  it('es false sin la variable del evento', () => {
    expect(ghlConectado('compra_confirmada')).toBe(false)
  })

  it('es false si la variable viene en blanco', () => {
    process.env.NUXT_GHL_WEBHOOK_POSTCOMPRA = '   '
    expect(ghlConectado('compra_confirmada')).toBe(false)
  })

  it('se pregunta POR EVENTO: conectar uno no conecta los otros', () => {
    // GHL da una URL por automatización, así que se pueden ir encendiendo de a una.
    process.env.NUXT_GHL_WEBHOOK_POSTCOMPRA = URL_POSTCOMPRA
    expect(ghlConectado('compra_confirmada')).toBe(true)
    expect(ghlConectado('carrito_abandonado')).toBe(false)
    expect(ghlConectado('reactivacion')).toBe(false)
  })
})

describe('emitirEventoGhl', () => {
  it('sin configurar no llama a la red y devuelve false', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(await emitirEventoGhl('compra_confirmada', { a: 1 })).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('cada evento va a SU propia URL, no a una global', async () => {
    // Si esto se rompe, un carrito abandonado dispararía el workflow de
    // postcompra: correo equivocado al cliente equivocado, y cobrado.
    process.env.NUXT_GHL_WEBHOOK_POSTCOMPRA = URL_POSTCOMPRA
    process.env.NUXT_GHL_WEBHOOK_CARRITO_ABANDONADO = URL_CARRITO
    process.env.NUXT_GHL_WEBHOOK_REACTIVACION = URL_REACTIVACION
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200 } as any)

    await emitirEventoGhl('compra_confirmada', {})
    await emitirEventoGhl('carrito_abandonado', {})
    await emitirEventoGhl('reactivacion', {})

    expect(fetchSpy.mock.calls.map((c) => c[0])).toEqual([URL_POSTCOMPRA, URL_CARRITO, URL_REACTIVACION])
  })

  it('manda POST con JSON y devuelve true cuando GHL responde ok', async () => {
    process.env.NUXT_GHL_WEBHOOK_POSTCOMPRA = URL_POSTCOMPRA
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200 } as any)

    expect(await emitirEventoGhl('compra_confirmada', { pedido_id: 'x1' })).toBe(true)

    const init = fetchSpy.mock.calls[0][1] as any
    expect(init.method).toBe('POST')
    const enviado = JSON.parse(init.body)
    expect(enviado.evento).toBe('compra_confirmada')
    expect(enviado.pedido_id).toBe('x1')
    expect(typeof enviado.enviado_en).toBe('string')
  })

  it('devuelve false —sin lanzar— si GHL responde con error', async () => {
    process.env.NUXT_GHL_WEBHOOK_CARRITO_ABANDONADO = URL_CARRITO
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500 } as any)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(emitirEventoGhl('carrito_abandonado', {})).resolves.toBe(false)
  })

  it('devuelve false —sin lanzar— si la red truena', async () => {
    process.env.NUXT_GHL_WEBHOOK_CARRITO_ABANDONADO = URL_CARRITO
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNRESET'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(emitirEventoGhl('carrito_abandonado', {})).resolves.toBe(false)
  })

  it('devuelve false —sin lanzar— si el timeout aborta', async () => {
    process.env.NUXT_GHL_WEBHOOK_POSTCOMPRA = URL_POSTCOMPRA
    const abort = new Error('The operation was aborted')
    abort.name = 'TimeoutError'
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(abort)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(emitirEventoGhl('compra_confirmada', {})).resolves.toBe(false)
  })
})

describe('emitirEventoGhlSinEsperar', () => {
  // LA prueba importante: es la variante que llama el webhook de pagos.
  it('no lanza aunque la red truene, y no deja rechazos sueltos', async () => {
    process.env.NUXT_GHL_WEBHOOK_POSTCOMPRA = URL_POSTCOMPRA
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('caída total'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const sueltos: unknown[] = []
    const onUnhandled = (r: unknown) => sueltos.push(r)
    process.on('unhandledRejection', onUnhandled)

    expect(() => emitirEventoGhlSinEsperar('compra_confirmada', {})).not.toThrow()
    await new Promise((r) => setTimeout(r, 20))

    process.off('unhandledRejection', onUnhandled)
    expect(sueltos).toHaveLength(0)
  })

  it('no lanza cuando no está configurado', () => {
    expect(() => emitirEventoGhlSinEsperar('reactivacion', {})).not.toThrow()
  })
})

describe('debeAvisarCarrito — el candado que evita que nos cobren de más', () => {
  const caso = (o: Partial<Parameters<typeof debeAvisarCarrito>[0]>) =>
    debeAvisarCarrito({ recuperado: false, episodioVivo: false, registroDisponible: true, ...o })

  it('avisa la PRIMERA vez que aparece un carrito', () => {
    expect(caso({})).toBe(true)
  })

  it('NO vuelve a avisar mientras el mismo episodio siga vivo', () => {
    // Este es el que ahorra dinero: cart-save se llama 8-10 veces por comprador
    // (cada cambio del carrito + cada vez que se oculta la pestaña).
    expect(caso({ episodioVivo: true })).toBe(false)
  })

  it('NO avisa cuando el carrito se recuperó: eso lo hacen los extractores', () => {
    expect(caso({ recuperado: true })).toBe(false)
    expect(caso({ recuperado: true, episodioVivo: true })).toBe(false)
  })

  it('ante la duda NO avisa: sin registro no se sabe si ya avisamos', () => {
    // Equivocarse hacia "mandar de más" aquí significa cobrar de más Y spamear.
    expect(caso({ registroDisponible: false })).toBe(false)
    expect(caso({ registroDisponible: false, episodioVivo: false })).toBe(false)
  })

  it('vuelve a avisar en un episodio NUEVO, ya cerrado el anterior', () => {
    expect(caso({ episodioVivo: false })).toBe(true)
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

  // Sin nombre, la plantilla de GHL saluda "Hola ," y el comprador entra al CRM
  // como un ID sin persona. Cesar lo pidio el 31-ago-2026: que los datos dinamicos
  // de los correos cuadren con lo que manda el sitio.
  it('manda nombre y telefono para que GHL arme un contacto de verdad', () => {
    const p = payloadCompra({ ...base, nombre: 'Josué Morales', telefono: '5512345678' }) as any
    expect(p.nombre).toBe('Josué Morales')
    expect(p.telefono).toBe('5512345678')
  })

  it('sin nombre ni telefono manda null, nunca undefined ni cadena vacia', () => {
    const p = payloadCompra(base) as any
    expect(p.nombre).toBeNull()
    expect(p.telefono).toBeNull()
    expect(payloadCompra({ ...base, nombre: '', telefono: '' } as any).nombre).toBeNull()
  })

  it('arma los enlaces a la ficha de cada producto', () => {
    const p = payloadCompra(base) as any
    expect(p.items[0].url_producto).toBe('https://amanti.mx/tienda/tiny-teasers-nubby')
    expect(p.items[1].url_producto).toBe('https://amanti.mx/tienda/venus-butterfly')
  })

  it('el enlace de reseña apunta al ancla real de la ficha', () => {
    // La ficha tiene <section id="resenas">. Si alguien renombra ese ancla,
    // truena aquí y no en el correo del día 10.
    const p = payloadCompra(base) as any
    expect(p.url_resena).toBe('https://amanti.mx/tienda/tiny-teasers-nubby#resenas')
  })

  // Con la llave puesta, ese mismo enlace lleva firmado el permiso para reseñar
  // sin cuenta. Es de lo que depende el correo del día 10 de César: sin el
  // permiso, el invitado llega a la ficha y le sale "Inicia sesión".
  describe('con las reseñas de invitado encendidas', () => {
    beforeEach(() => { process.env.NUXT_RESENA_SECRET = 'llave-de-prueba' })
    afterEach(() => { delete process.env.NUXT_RESENA_SECRET })

    it('el enlace del día 10 lleva el permiso firmado', () => {
      const p = payloadCompra(base) as any
      expect(p.url_resena).toContain(`pedido=${base.orderId}`)
      expect(p.url_resena).toContain('firma=')
      expect(p.url_resena.endsWith('#resenas')).toBe(true)
    })

    it('manda un enlace por artículo, no sólo del principal', () => {
      // Para que el correo pueda pedir reseña de todo lo que se llevó.
      const p = payloadCompra(base) as any
      expect(p.urls_resena).toHaveLength(2)
      expect(p.urls_resena[0].slug).toBe('tiny-teasers-nubby')
      expect(p.urls_resena[1].slug).toBe('venus-butterfly')
      // Cada uno con SU firma: la de un producto no debe servir para el otro.
      const f = (u: string) => u.split('firma=')[1]
      expect(f(p.urls_resena[0].url)).not.toBe(f(p.urls_resena[1].url))
    })

    it('el enlace del principal es el mismo que el de su renglón', () => {
      const p = payloadCompra(base) as any
      expect(p.url_resena).toBe(p.urls_resena[0].url)
    })
  })

  it('suma las cantidades, no los renglones', () => {
    expect((payloadCompra(base) as any).num_articulos).toBe(3)
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
