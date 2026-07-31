// gclid: el identificador de clic que Google Ads agrega a la URL de destino.
//
// Lo recordamos durante la visita para poder pegarlo en el mensaje de WhatsApp. Los
// pedidos que se cierran por chat NO pasan por la página de gracias, así que sin esta
// referencia Ads no tiene forma de atribuirlos a la campaña que los trajo.
//
// A propósito en sessionStorage y NO en cookie: dura lo que dura la visita — que es todo
// lo que necesita el flujo de WhatsApp — y así no dejamos un identificador persistente
// antes de que el usuario acepte cookies.
const KEY = 'amanti_gclid'

/** Solo caracteres válidos de un gclid, y acotado: nunca pegar basura de la URL. */
function sanitize(raw: string | null): string {
  if (!raw) return ''
  const clean = raw.replace(/[^A-Za-z0-9_-]/g, '')
  return clean.length > 0 && clean.length <= 120 ? clean : ''
}

/** Lee el gclid de la URL de aterrizaje y lo recuerda para el resto de la visita. */
export function captureGclid(): void {
  if (typeof window === 'undefined') return
  try {
    const found = sanitize(new URLSearchParams(window.location.search).get('gclid'))
    if (found) window.sessionStorage.setItem(KEY, found)
  } catch { /* sessionStorage puede estar bloqueado (modo privado): no pasa nada */ }
}

export function getGclid(): string {
  if (typeof window === 'undefined') return ''
  try { return sanitize(window.sessionStorage.getItem(KEY)) } catch { return '' }
}

/**
 * Sufijo para el texto del mensaje de WhatsApp. Vacío si la visita no viene de Ads,
 * que es el caso de la mayoría — el mensaje solo cambia para quien llegó por un anuncio.
 */
export function waRef(): string {
  const g = getGclid()
  return g ? `\n\nref: ${g}` : ''
}
