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

export const CAMPANA: CampanaCfg = {
  activa: true,
  nombre: 'AMANTI sin filtros',
  gancho: '40% de descuento en toda la tienda',
  descuento: 0.4,
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
