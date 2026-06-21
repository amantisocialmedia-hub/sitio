// Scroll-reveal liviano: un solo IntersectionObserver compartido para toda la app.
// Directiva v-reveal: añade .reveal al montar (cliente) y .in al entrar al viewport (one-shot).
// Respeta prefers-reduced-motion: si el usuario lo pide, no observa y deja el contenido visible.
// Plugin universal (no .client) para que la directiva exista también en SSR (sin warning) —
// el hook mounted solo corre en cliente, así que el contenido se renderiza normal en el servidor.
export default defineNuxtPlugin((nuxt) => {
  let io: IntersectionObserver | null = null
  const reduce = import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (import.meta.client && !reduce) {
    io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io?.unobserve(e.target)
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    )
  }

  nuxt.vueApp.directive('reveal', {
    mounted(el: HTMLElement, binding) {
      if (!io) return // reduced-motion o SSR: queda visible sin animar
      el.classList.add('reveal')
      const i = binding.value?.i ?? el.dataset.revealIndex
      if (i != null) el.style.setProperty('--i', String(i))
      io.observe(el)
    },
    unmounted(el: HTMLElement) {
      io?.unobserve(el)
    },
  })
})
