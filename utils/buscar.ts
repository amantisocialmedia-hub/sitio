// Cómo decide el buscador de la tienda si un producto coincide con lo que
// alguien escribió.
//
// Vive aquí, y con prueba propia, porque la versión anterior le costó una venta
// a AMANTI y nadie se enteró hasta que revisamos las grabaciones.
//
// Lo que hacía antes:
//
//   const t = q.toLowerCase()
//   list.filter(p => (nombre + subtitulo + marca + descripcion).includes(t))
//
// Un solo `includes()` de la frase COMPLETA. Así, «coco» encontraba Lubricantes
// Sunny, pero «Lubricante coco» devolvía CERO, porque esa frase exacta no
// aparece en ninguna ficha aunque las dos palabras sí estén.
//
// El 1-sep-2026 un cliente le pregunto a Nancy por WhatsApp si había lubricantes
// de chocolate y de coco. Ella busco en el sitio —queda la sesión grabada a las
// 13:46, `/tienda?q=Lubricante+coco`—, no encontró nada, y 45 minutos después
// mandó nota de voz al grupo diciendo que no estaban. Sí estaban.
//
// Ahora se parte en palabras y se piden TODAS (Y lógica, no O): quien escribe
// más palabras está afinando la búsqueda, no ampliándola.
//
// Y se ignoran los acentos en los dos lados. Es una tienda mexicana y medio
// catálogo lleva ñ o tilde; quien teclea «pina colada» o «bellami tentacion»
// desde el celular espera encontrarlo igual.

/** Quita acentos y pasa a minúsculas, para comparar sin que estorben. */
export function normalizar(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * El texto de un producto contra el que se busca.
 *
 * Va la descripción a propósito, y va la categoría a propósito. Antes había DOS
 * buscadores con campos distintos: el de la tienda miraba la descripción pero no
 * la categoría, y el del encabezado —el desplegable que sale al teclear, que es
 * el que más se usa desde el celular— miraba la categoría pero NO la
 * descripción. Como los sabores viven en la descripción, en el del encabezado
 * «coco» no encontraba nada ni siquiera escribiéndolo solo.
 */
export function textoBuscable(p: {
  name?: string
  subtitle?: string
  brand?: string
  category?: string
  description?: string
}): string {
  return normalizar([p.name, p.subtitle, p.brand, p.category, p.description].filter(Boolean).join(' '))
}

/**
 * ¿Este producto coincide con la consulta?
 *
 * Una consulta vacía o de puros espacios coincide con todo: es el estado
 * "sin filtro", no "sin resultados".
 */
export function coincideBusqueda(
  p: { name?: string; subtitle?: string; brand?: string; description?: string },
  consulta: string,
): boolean {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean)
  if (!palabras.length) return true
  const texto = textoBuscable(p)
  return palabras.every((w) => texto.includes(w))
}
