// Estela de color suave que sigue al cursor (solo desktop con puntero fino).
// Un glow principal sigue al mouse con lerp; detrás, una pequeña cadena de puntos
// lo persigue con retardo creciente para dejar una estela tipo cometa muy sutil.
// Se desactiva en táctil y con prefers-reduced-motion. No bloquea clics (pointer-events:none).
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return
  const fine = window.matchMedia('(pointer: fine)').matches
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!fine || reduce) return

  const head = document.createElement('div')
  head.className = 'cursor-glow'
  head.setAttribute('aria-hidden', 'true')
  document.body.appendChild(head)

  // Cadena de puntos: cada uno persigue al anterior, así que cuanto más atrás
  // está, más se retrasa, más pequeño y más tenue → cola de cometa sutil.
  const N = 5
  const trail = Array.from({ length: N }, (_, i) => {
    const el = document.createElement('div')
    el.className = 'cursor-trail'
    el.setAttribute('aria-hidden', 'true')
    document.body.appendChild(el)
    return {
      el,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      scale: 1 - (i + 1) * 0.14,        // 0.86 → 0.30
      op: Math.max(0.5 - i * 0.09, 0.06), // 0.50 → 0.14
    }
  })

  let tx = window.innerWidth / 2
  let ty = window.innerHeight / 2
  let x = tx
  let y = ty
  let shown = false

  const setShown = (v: boolean) => {
    shown = v
    head.style.opacity = v ? '1' : '0'
    for (const t of trail) t.el.style.opacity = v ? String(t.op) : '0'
  }

  const onMove = (e: PointerEvent) => {
    tx = e.clientX
    ty = e.clientY
    if (!shown) setShown(true)
  }
  const onDown = () => {
    head.classList.remove('pulse')
    void head.offsetWidth // reinicia la animación
    head.classList.add('pulse')
  }
  const onLeave = () => setShown(false)

  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onDown, { passive: true })
  document.addEventListener('mouseleave', onLeave)

  let raf = 0
  const loop = () => {
    x += (tx - x) * 0.2
    y += (ty - y) * 0.2
    head.style.transform = `translate3d(${x}px, ${y}px, 0)`
    // Cada punto persigue al de delante (px,py) con un lerp más lento → retardo en cadena.
    let px = x
    let py = y
    for (const t of trail) {
      t.x += (px - t.x) * 0.34
      t.y += (py - t.y) * 0.34
      t.el.style.transform = `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.scale})`
      px = t.x
      py = t.y
    }
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  // limpieza si el plugin se re-evalúa (HMR / navegación SPA no recrea, pero por si acaso)
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      document.removeEventListener('mouseleave', onLeave)
      head.remove()
      for (const t of trail) t.el.remove()
    })
  }
})
