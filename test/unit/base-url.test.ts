import { describe, it, expect, afterEach } from 'vitest'
import { baseParaPasarela } from '~/server/utils/baseUrl'

// De aquí salen la notification_url y las back_urls que se le dan a Mercado Pago
// y a Stripe. Si esto devuelve un localhost en producción, el cobro se hace pero
// el webhook no llega nunca: el pedido se queda en `pending` para siempre, nadie
// lo marca como pagado y quien surte no se entera. Sin un solo error visible.

const SITIO = 'https://amanti.mx'

afterEach(() => { delete process.env.VERCEL })

describe('baseParaPasarela — en local no cambia nada', () => {
  it('respeta el localhost de desarrollo', () => {
    expect(baseParaPasarela('http://localhost:3000', SITIO)).toBe('http://localhost:3000')
  })

  it('respeta cualquier otro base de desarrollo (un túnel, por ejemplo)', () => {
    expect(baseParaPasarela('https://algo.ngrok.io', SITIO)).toBe('https://algo.ngrok.io')
  })
})

describe('baseParaPasarela — en Vercel, un localhost es configuración rota', () => {
  it('sustituye localhost por el dominio público', () => {
    process.env.VERCEL = '1'
    expect(baseParaPasarela('http://localhost:3000', SITIO)).toBe(SITIO)
  })

  it('cubre las otras formas de decir "esta máquina"', () => {
    process.env.VERCEL = '1'
    for (const local of ['http://127.0.0.1:3000', 'http://0.0.0.0:8080', 'https://localhost']) {
      expect(baseParaPasarela(local, SITIO)).toBe(SITIO)
    }
  })

  it('NO toca un dominio real', () => {
    process.env.VERCEL = '1'
    expect(baseParaPasarela('https://amanti.mx', SITIO)).toBe(SITIO)
    expect(baseParaPasarela('https://preview-abc.vercel.app', SITIO)).toBe('https://preview-abc.vercel.app')
  })

  // Un dominio que solo CONTIENE la palabra no es local. Si esto se rompe,
  // una tienda con ese nombre veria sus pagos redirigidos a otro lado.
  it('no confunde un dominio que solo contiene la palabra', () => {
    process.env.VERCEL = '1'
    expect(baseParaPasarela('https://localhost.midominio.mx', SITIO)).toBe('https://localhost.midominio.mx')
    expect(baseParaPasarela('https://mi-localhost.mx', SITIO)).toBe('https://mi-localhost.mx')
  })

  // Sin dominio con que sustituir es mejor seguir con lo que hay: romper la
  // preferencia de pago con una cadena vacia es mas dificil de diagnosticar.
  it('si no hay dominio público con qué sustituir, deja el que venía', () => {
    process.env.VERCEL = '1'
    expect(baseParaPasarela('http://localhost:3000', '')).toBe('http://localhost:3000')
  })
})

describe('baseParaPasarela — higiene', () => {
  it('quita la diagonal final para que no salgan URLs con doble diagonal', () => {
    expect(baseParaPasarela('https://amanti.mx/', SITIO)).toBe('https://amanti.mx')
    expect(baseParaPasarela('https://amanti.mx///', SITIO)).toBe('https://amanti.mx')
  })

  it('sin base cae al sitio', () => {
    expect(baseParaPasarela('', SITIO)).toBe(SITIO)
    expect(baseParaPasarela(undefined, SITIO)).toBe(SITIO)
    expect(baseParaPasarela(null, SITIO)).toBe(SITIO)
  })
})
