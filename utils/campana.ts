// Campaña de descuento global ("AMANTI sin filtros", 40% en todo el catálogo).
//
// POR QUÉ VIVE AQUÍ Y NO EN UNA VARIABLE DE ENTORNO:
// el precio que ve el cliente y el precio que se le cobra TIENEN que salir del
// mismo cálculo. Si el interruptor viviera en el entorno, el navegador y el
// servidor podrían leer valores distintos durante un despliegue y acabaríamos
// enseñando 40% y cobrando el precio completo. Un flag en el código viaja en el
// mismo bundle para los dos lados: o está encendido en todos, o en ninguno.
//
// PARA ENCENDER LA CAMPAÑA: cambia `activa` a true y despliega. Eso es todo.
// Se aplica sola a la tienda, la ficha, el buscador, el carrito, el cobro de
// Mercado Pago, los pedidos guardados y el feed de Google.
//
// PARA APAGARLA: `activa` a false. Los precios vuelven a los de lista y el
// precio tachado desaparece. No hay que tocar el catálogo.

export interface CampanaCfg {
  /** Interruptor único. Con false el sitio se comporta como si no existiera campaña. */
  activa: boolean
  /** Cómo se llama la venta en el banner del home. */
  nombre: string
  /** Frase corta bajo el título del banner. */
  gancho: string
  /** Fracción de descuento: 0.4 = 40%. */
  descuento: number
}

// FECHA ACORDADA DE FIN: 30 de septiembre de 2026.
//
// El equipo lo decidio en el grupo el 31-ago-2026. Raul: «Se dejara todo el mes
// el 40%». Cesar: «yo lo dejaria todo septiembre».
//
// NO se apaga solo. Esto es un booleano y alguien tiene que venir a ponerlo en
// false. Si el 1 de octubre nadie lo hace, la tienda sigue regalando el 40%
// indefinidamente y nada avisa.
//
// Por eso tampoco se le puso `sale_price_effective_date` al feed de Google (ver
// server/routes/feeds/google.xml.get.ts): si el feed caducara el 30-sep y este
// interruptor siguiera encendido, Google anunciaria el precio de lista mientras
// el sitio cobra el rebajado. Eso es discrepancia de precio, y Merchant Center
// suspende por eso. Los dos tienen que apagarse el mismo dia o ninguno.
export const CAMPANA: CampanaCfg = {
  activa: true,
  nombre: 'AMANTI sin filtros',
  gancho: '40% de descuento en toda la tienda',
  descuento: 0.4,
}

// ---------------------------------------------------------------------------
// Banner de temporada (una imagen, con fecha de caducidad)
// ---------------------------------------------------------------------------
// A diferencia de CAMPANA, este SÍ se apaga solo. Es la pieza que César manda para
// una fecha concreta (fiestas patrias 2026) y que tiene que desaparecer sin que
// nadie se acuerde de venir a apagarla.
//
// Va atado a `CAMPANA.activa` a propósito: el banner anuncia el mismo 40%, así que
// si la campaña se apagara antes, el banner no puede quedarse prometiendo un
// descuento que la tienda ya no da.
//
// PARA CAMBIAR LAS FECHAS: `desde` y `hasta` son días de calendario en hora de
// México, los dos INCLUSIVE. Con `hasta: '2026-09-16'` el banner se ve todo el 16 y
// a las 00:00 del 17 (hora de México) ya no existe; vuelve el bloque de siempre.

export interface BannerTemporada {
  activo: boolean
  /** Primer día en que se ve, hora de México (YYYY-MM-DD, inclusive). */
  desde: string
  /** Último día en que se ve, hora de México (YYYY-MM-DD, inclusive). */
  hasta: string
  imagen: string
  /** Recorte para pantallas chicas: el original es 16:9 y a 390px el texto no se lee. */
  imagenMovil: string
  alt: string
  href: string
}

export const BANNER_TEMPORADA: BannerTemporada = {
  activo: true,
  desde: '2026-09-15',
  hasta: '2026-09-16',
  imagen: '/banners/patrio-2026.webp',
  imagenMovil: '/banners/patrio-2026-movil.webp',
  alt: 'Da el grito a tu manera — 40% de descuento en todos los productos',
  href: '/tienda',
}

/**
 * El día de hoy en México como 'YYYY-MM-DD'.
 *
 * Se calcula con la zona horaria explícita y NO con la del servidor: en Vercel el
 * reloj está en UTC, así que entre las 18:00 y la medianoche de México el servidor
 * ya cree que es el día siguiente. Con esto, el banner cambia a la medianoche de
 * Morelia y no seis horas antes.
 *
 * El formato en-CA da ISO (2026-09-15), que se puede comparar como texto.
 */
export function diaMx(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora)
}

/** Si el banner de temporada debe verse ahora mismo. */
export function bannerVigente(
  ahora: Date = new Date(),
  cfg: BannerTemporada = BANNER_TEMPORADA,
  campana: CampanaCfg = CAMPANA,
): boolean {
  if (!cfg.activo || !campana.activa) return false
  const hoy = diaMx(ahora)
  return hoy >= cfg.desde && hoy <= cfg.hasta
}

// ---------------------------------------------------------------------------
// Comunicación de cupones (AMANTI15)
// ---------------------------------------------------------------------------
// César pidió (12-ago) bajar del sitio todo anuncio, banner o comunicación de
// descuentos hasta que den luz verde al relanzamiento. Esto NO borra el cupón:
// sigue vivo en Supabase y sigue funcionando para quien ya lo tenga; solo deja
// de anunciarse en el home, el hero, los kits y el carrito.
const ANUNCIAR_CUPONES = false

/**
 * Si el sitio anuncia cupones ahora mismo.
 * Durante la campaña siempre es false aunque se prenda arriba: el 40% es el
 * mensaje, y dos descuentos encimados confunden y se restan entre sí.
 */
export const MOSTRAR_CUPONES = ANUNCIAR_CUPONES && !CAMPANA.activa

/**
 * Si el servidor acepta cupones al cobrar.
 * Con la campaña encendida NO: el catálogo ya trae el 40% y un AMANTI15 encima
 * dejaría la venta en 49% de descuento sin que nadie lo haya decidido.
 */
export const CUPONES_ACEPTADOS = !CAMPANA.activa

/** El 40% en número entero, para los textos ("40% OFF"). */
export const CAMPANA_PCT = Math.round(CAMPANA.descuento * 100)

/**
 * Precio con la campaña aplicada, redondeado al peso.
 * Todos los precios del catálogo son enteros, así que no hay centavos que cuidar.
 */
export function precioCampana(precioLista: number, cfg: CampanaCfg = CAMPANA): number {
  const p = Number(precioLista) || 0
  return Math.round(p * (1 - cfg.descuento))
}

/**
 * Precio que el sitio cobra HOY por un precio de lista dado: con la campaña
 * encendida devuelve el rebajado; apagada, el mismo de lista.
 *
 * Ojo con la diferencia: `precioCampana` calcula siempre el descuento (es pura
 * aritmética y no mira el interruptor); esta respeta el estado de la campaña.
 */
export function precioVigente(precioLista: number, cfg: CampanaCfg = CAMPANA): number {
  return cfg.activa ? precioCampana(precioLista, cfg) : Number(precioLista) || 0
}

/**
 * Devuelve el catálogo con la campaña aplicada: `price` baja al precio de venta
 * y `compareAt` guarda el precio de lista, que es el que la tienda ya sabe
 * tachar (ProductCard y la ficha traen esa UI desde antes).
 *
 * Con la campaña apagada devuelve la MISMA lista, sin copiar ni tocar nada.
 */
export function aplicarCampana<T extends { price: number; compareAt?: number }>(
  items: T[],
  cfg: CampanaCfg = CAMPANA,
): T[] {
  if (!cfg.activa) return items
  return items.map((p) => ({ ...p, price: precioCampana(p.price, cfg), compareAt: p.price }))
}
