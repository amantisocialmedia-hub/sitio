// Aviso de pedido nuevo a quien surte.
//
// Nancy lo pidió textual: «que me llegue por whats por favor». El riesgo aquí
// no es de dinero sino operativo: si el mensaje llega incompleto o sin
// dirección y eso no se nota, alguien empaca algo que no puede enviar.
import { describe, it, expect } from 'vitest'
import { direccionParaGuia, textoAviso } from '~/server/utils/avisoPedido'

const envio = {
  recipient: 'Ana López', phone: '4431234567', line1: 'Av. Camelinas 3020',
  colonia: 'Las Américas', line2: 'Depto 4B', city: 'Morelia',
  state: 'Michoacán', postal_code: '58270',
}

describe('direccionParaGuia', () => {
  it('arma la dirección en una línea, lista para copiar', () => {
    const d = direccionParaGuia(envio)
    expect(d).toContain('Ana López')
    expect(d).toContain('Av. Camelinas 3020')
    expect(d).toContain('C.P. 58270')
    expect(d).not.toContain('\n') // una sola línea: se pega de un jalón
  })

  it('omite los campos vacíos sin dejar separadores sueltos', () => {
    const d = direccionParaGuia({ ...envio, colonia: '', line2: '' })
    expect(d).not.toContain('· ·')
  })

  it('devuelve vacío si no hay calle: no hay dirección que dar', () => {
    expect(direccionParaGuia(null)).toBe('')
    expect(direccionParaGuia({ ...envio, line1: '' })).toBe('')
  })
})

describe('textoAviso', () => {
  const base = {
    pedidoId: 'abc-123', total: 824,
    items: [{ nombre: 'Mini Antojo Nubby', cantidad: 2 }],
    envio,
  }

  it('trae monto, artículos y dirección', () => {
    const t = textoAviso(base)
    expect(t).toContain('$824')
    expect(t).toContain('2x Mini Antojo Nubby')
    expect(t).toContain('Ana López')
  })

  it('AVISA FUERTE cuando el pedido no tiene dirección', () => {
    // Lo importante: que no pase desapercibido. Un pedido sin dirección no se
    // puede surtir y hay que pedírsela al cliente antes de empacar nada.
    const t = textoAviso({ ...base, envio: null })
    expect(t).toContain('SIN DIRECCIÓN')
  })

  it('marca el modo regalo, que cambia cómo se empaca', () => {
    expect(textoAviso({ ...base, esRegalo: true })).toContain('regalo')
    expect(textoAviso(base)).not.toContain('regalo')
  })

  it('siempre incluye el enlace al panel', () => {
    expect(textoAviso(base)).toContain('amanti.mx/pedidos')
  })
})
