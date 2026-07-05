import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'

// useCartUI / useInstallPrompt / useDiscreet comparten estado vía useState de Nuxt.
// Stub mínimo con la misma semántica (un ref por clave, compartido entre llamadas).
// El lado DOM/localStorage del modo discreto se cubre en e2e (discreto.spec.ts):
// aquí solo el contrato de estado, que es lo que corre sin navegador.
const states = new Map<string, any>()
;(globalThis as any).useState = (key: string, init?: () => any) => {
  if (!states.has(key)) states.set(key, ref(init ? init() : undefined))
  return states.get(key)
}

beforeEach(() => states.clear())

describe('useCartUI — drawer del carrito', () => {
  it('abre y cierra, y el estado se comparte entre componentes (misma clave)', async () => {
    const { useCartUI } = await import('~/composables/useCartUI')
    const a = useCartUI()
    const b = useCartUI() // otro componente
    expect(a.open.value).toBe(false)
    a.openCart()
    expect(b.open.value).toBe(true) // lo ve el otro lado
    b.closeCart()
    expect(a.open.value).toBe(false)
  })
})

describe('useInstallPrompt — estado PWA', () => {
  it('inicia sin prompt diferido ni bandera de instalación, y comparte estado', async () => {
    const { useInstallPrompt } = await import('~/composables/useInstallPrompt')
    const a = useInstallPrompt()
    expect(a.deferred.value).toBeNull()
    expect(a.canInstall.value).toBe(false)
    a.canInstall.value = true
    expect(useInstallPrompt().canInstall.value).toBe(true)
  })
})

describe('useDiscreet — contrato de estado', () => {
  it('toggle alterna on (la persistencia en localStorage la cubre el e2e)', async () => {
    const { useDiscreet } = await import('~/composables/useDiscreet')
    const d = useDiscreet()
    expect(d.on.value).toBe(false)
    d.toggle()
    expect(d.on.value).toBe(true)
    d.toggle()
    expect(d.on.value).toBe(false)
  })

  it('dos consumidores comparten el mismo estado (header e íconos)', async () => {
    const { useDiscreet } = await import('~/composables/useDiscreet')
    const a = useDiscreet()
    const b = useDiscreet()
    a.toggle()
    expect(b.on.value).toBe(true)
  })
})
