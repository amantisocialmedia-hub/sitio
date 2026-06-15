// Normaliza teléfonos MX a 10 dígitos: quita espacios/guiones/paréntesis/+, y recorta
// el prefijo de país 52 (o 521 del formato móvil viejo) si viene al inicio.
export function cleanMxPhone(raw: string | null | undefined): string {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (d.length === 13 && d.startsWith('521')) d = d.slice(3)
  else if (d.length === 12 && d.startsWith('52')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('1')) d = d.slice(1)
  return d
}

// True si, ya normalizado, son exactamente 10 dígitos.
export function isMxPhone10(raw: string | null | undefined): boolean {
  return cleanMxPhone(raw).length === 10
}
