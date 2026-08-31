// El empujador del dataLayer de Google. Vive aparte del plugin, y con prueba
// propia, porque aqui estuvo escondido durante semanas el error mas caro del sitio.
//
// gtag.js SOLO interpreta una entrada del dataLayer como comando (consent, config,
// event...) cuando esa entrada es un objeto `arguments`. Si le llega un Array
// normal lo ignora en silencio: el script de Google carga, el dataLayer se ve lleno
// de comandos, no hay un solo error en consola... y no pasa absolutamente nada.
//
// Asi estuvo AMANTI hasta el 31-ago-2026. GA4 decia "todavia no se han recibido
// datos de tu sitio web" desde el primer dia, y la conversion de compra de Google
// Ads no registro ninguna de las ventas reales del 27 al 29 de agosto. La delatora
// fue la cookie `_ga`: no existia ni con el consentimiento ya aceptado, senal de
// que el `config` nunca llegaba a ejecutarse.
//
// Los rest params estan solo para que TypeScript revise las llamadas; lo que se
// empuja es `arguments`. NO lo conviertas en arrow function: las arrow no tienen
// `arguments`, y el error vuelve exactamente igual de mudo.
export function gtagPush(..._args: any[]): void {
  if (typeof window === 'undefined') return
  const w = window as any
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push(arguments)
}
