// De dónde salen las URLs de retorno y de notificación que se le entregan a la
// pasarela de pago.
//
// POR QUÉ EXISTE ESTE ARCHIVO Y NO SE LEE `publicBaseUrl` A SECAS:
//
// El valor de respaldo en nuxt.config.ts es `http://localhost:3000`, y está bien
// que lo sea: es el que sirve para desarrollo, y .env lo pone igual. El problema
// es lo que pasa si NUXT_PUBLIC_PUBLIC_BASE_URL llegara a faltar en producción
// —alguien la borra, un entorno nuevo, un deploy de preview sin ella—. Ese
// respaldo tomaría el control y el sitio le diría a Mercado Pago que mande las
// notificaciones de pago a localhost.
//
// Lo que eso cuesta, y por eso vale un archivo propio: el cobro SÍ se hace, pero
// el webhook no llega nunca. Los pedidos se quedan en `pending` para siempre,
// nadie los marca como pagados, GHL no se entera, y quien surte no sabe que hay
// algo que enviar. El cliente que ya pagó aterriza además en una página muerta.
// Todo eso sin un solo error en ningún lado.
//
// La regla: corriendo en Vercel, un localhost se trata como configuración rota y
// se usa el dominio público del sitio, que sí está bien configurado. En local
// `process.env.VERCEL` no existe y esto no cambia absolutamente nada.
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i

const limpia = (v: unknown) => String(v ?? '').trim().replace(/\/+$/, '')

export function baseParaPasarela(publicBaseUrl: unknown, siteUrl: unknown): string {
  const base = limpia(publicBaseUrl)
  const sitio = limpia(siteUrl)
  if (!base) return sitio
  // El `sitio &&` es a propósito: si tampoco hay dominio público con qué
  // sustituir, es mejor seguir con lo que hay que devolver una cadena vacía,
  // que rompería la preferencia de pago de una forma más difícil de leer.
  if (process.env.VERCEL && LOCAL.test(base) && sitio) return sitio
  return base
}
