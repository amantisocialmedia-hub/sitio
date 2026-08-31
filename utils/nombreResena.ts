// Con qué nombre se publica una reseña.
//
// Esto vive en utils/ (no en server/utils/) porque lo usan los DOS caminos de
// resena: el del invitado, que pasa por server/api/resena.post.ts, y el de
// quien tiene cuenta, que inserta desde el navegador en pages/tienda/[slug].vue.
// Con pruebas propias porque es una promesa de discrecion, no un
// detalle de formato: la ficha de producto es publica y AMANTI vende con
// entrega discreta. Antes, los dos caminos publicaban un nombre que la persona
// nunca escribio: el invitado, el de quien recibio el paquete (shipping_address);
// y quien tenia cuenta sin nombre de perfil, el pedazo de su correo antes de la
// arroba. En los dos casos alguien acababa firmando en publico la resena de un
// juguete sexual con su nombre real.
//
// La regla ahora: solo se publica lo que la persona TECLEA. Si no teclea nada,
// va la etiqueta neutra. Nunca el correo, nunca la direccion, nunca el nombre
// del envio.
export const NOMBRE_RESENA_NEUTRO = 'Cliente AMANTI'

export function nombreResena(escrito?: string | null): string {
  return (String(escrito || '').trim() || NOMBRE_RESENA_NEUTRO).slice(0, 60)
}
