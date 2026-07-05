/** Gestos de la galería de producto (swipe táctil en /tienda/[slug]). */

/**
 * Decide el paso tras un gesto: 1 (siguiente), -1 (anterior) o 0 (ignorar).
 * Ignora gestos cortos (< threshold px) o predominantemente verticales,
 * para no confundir el scroll de la página con un swipe.
 */
export function swipeStep(dx: number, dy: number, threshold = 40): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return 0
  return dx < 0 ? 1 : -1
}

/** Índice destino dentro de [0, count), o null si el paso se sale (sin loop en los extremos). */
export function stepIndex(index: number, step: number, count: number): number | null {
  const next = index + step
  return next < 0 || next >= count ? null : next
}
