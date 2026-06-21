import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWishlistStore } from '~/stores/wishlist'

describe('wishlist store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('toggle agrega y luego quita el mismo slug (idempotencia)', () => {
    const w = useWishlistStore()
    w.toggle('vibrating-g')
    expect(w.has('vibrating-g')).toBe(true)
    expect(w.count).toBe(1)
    w.toggle('vibrating-g')
    expect(w.has('vibrating-g')).toBe(false)
    expect(w.count).toBe(0)
  })

  it('has refleja el estado y count cuenta los slugs', () => {
    const w = useWishlistStore()
    w.toggle('a'); w.toggle('b')
    expect(w.count).toBe(2)
    expect(w.has('a')).toBe(true)
    expect(w.has('z')).toBe(false)
  })

  it('remove elimina un slug presente y es no-op si no existe', () => {
    const w = useWishlistStore()
    w.toggle('a'); w.toggle('b')
    w.remove('a')
    expect(w.has('a')).toBe(false)
    expect(w.count).toBe(1)
    w.remove('nope')
    expect(w.count).toBe(1)
  })

  it('clear vacía la lista', () => {
    const w = useWishlistStore()
    w.toggle('a'); w.toggle('b')
    w.clear()
    expect(w.count).toBe(0)
    expect(w.slugs).toEqual([])
  })
})
