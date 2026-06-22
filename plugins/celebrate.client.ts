// Celebración de pétalos al añadir al carrito (escucha el evento 'cart:add').
// Sutil, sin librerías, se auto-limpia. Se desactiva con prefers-reduced-motion.
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  let lx = window.innerWidth / 2
  let ly = window.innerHeight / 3
  window.addEventListener('pointerdown', (e) => { lx = e.clientX; ly = e.clientY }, { passive: true })

  const colors = ['#E8503A', '#FF6A4D', '#8E5BD6', '#0FA38B', '#FFB23E']
  const phrases = ['Buen gusto ✨', 'Mmm, sí 💜', 'Excelente elección', 'Para disfrutar 🔥', 'Va directo al placer']
  let last = 0

  function burst(x: number, y: number) {
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('span')
      p.className = 'petal'
      const ang = Math.random() * Math.PI * 2
      const dist = 40 + Math.random() * 90
      p.style.left = x + 'px'
      p.style.top = y + 'px'
      p.style.background = colors[i % colors.length]
      p.style.setProperty('--dx', Math.cos(ang) * dist + 'px')
      p.style.setProperty('--dy', Math.sin(ang) * dist - 30 + 'px')
      p.style.setProperty('--dr', Math.random() * 540 - 270 + 'deg')
      p.style.animationDelay = Math.random() * 60 + 'ms'
      document.body.appendChild(p)
      setTimeout(() => p.remove(), 1150)
    }
    const t = document.createElement('div')
    t.className = 'celebrate-toast'
    t.textContent = phrases[Math.floor(Math.random() * phrases.length)]
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 1450)
  }

  window.addEventListener('cart:add', () => {
    const now = Date.now()
    if (now - last < 700) return
    last = now
    burst(lx, ly)
  })
})
