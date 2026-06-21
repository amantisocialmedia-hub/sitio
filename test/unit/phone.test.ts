import { describe, it, expect } from 'vitest'
import { cleanMxPhone, isMxPhone10 } from '~/utils/phone'

describe('cleanMxPhone', () => {
  it('quita espacios, guiones y paréntesis', () => {
    expect(cleanMxPhone('443 123 0732')).toBe('4431230732')
    expect(cleanMxPhone('(443) 123-0732')).toBe('4431230732')
  })
  it('recorta +52 / 52 / 521 al inicio', () => {
    expect(cleanMxPhone('+52 443 123 0732')).toBe('4431230732')
    expect(cleanMxPhone('524431230732')).toBe('4431230732')
    expect(cleanMxPhone('5214431230732')).toBe('4431230732')
  })
  it('deja 10 dígitos tal cual', () => {
    expect(cleanMxPhone('4431230732')).toBe('4431230732')
  })
  it('recorta el prefijo 1 del formato de 11 dígitos', () => {
    expect(cleanMxPhone('14431230732')).toBe('4431230732')
  })
  it('null/undefined devuelven cadena vacía', () => {
    expect(cleanMxPhone(null)).toBe('')
    expect(cleanMxPhone(undefined)).toBe('')
  })
})

describe('isMxPhone10', () => {
  it('valida exactamente 10 dígitos tras normalizar', () => {
    expect(isMxPhone10('443 123 0732')).toBe(true)
    expect(isMxPhone10('+524431230732')).toBe(true)
    expect(isMxPhone10('12345')).toBe(false)
    expect(isMxPhone10('44312307321')).toBe(false)
    expect(isMxPhone10('')).toBe(false)
    expect(isMxPhone10('14431230732')).toBe(true) // 11 dígitos con prefijo 1 -> 10 tras normalizar
  })
})
