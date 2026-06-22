// Estela de color suave que sigue al cursor (solo desktop con puntero fino).
// Sigue al mouse con lerp para dar sensación de "estela". No bloquea clics (pointer-events:none).
// Se desactiva en táctil y con prefers-reduced-motion.
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return
  const fine = window.matchMedia('(pointer: fine)').matches
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!fine || reduce) return

  const el = document.createElement('div')
  el.className = 'cursor-glow'
  el.setAttribute('aria-hidden', 'true')
  document.body.appendChild(el)

  let tx = window.innerWidth / 2
  let ty = window.innerHeight / 2
  let x = tx
  let y = ty
  let shown = false

  const onMove = (e: PointerEvent) => {
    tx = e.clientX
    ty = e.clientY
    if (!shown) { shown = true; el.style.opacity = '1' }
  }
  const onDown = () => {
    el.classList.remove('pulse')
    void el.offsetWidth // reinicia la animación
    el.classList.add('pulse')
  }
  const onLeave = () => { shown = false; el.style.opacity = '0' }

  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onDown, { passive: true })
  document.addEventListener('mouseleave', onLeave)

  let raf = 0
  const loop = () => {
    x += (tx - x) * 0.16
    y += (ty - y) * 0.16
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`
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
      el.remove()
    })
  }
})
