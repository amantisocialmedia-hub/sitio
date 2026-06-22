// Modo discreto: difumina visualmente el contenido sensible (imágenes/nombres) con un toque.
// Persiste en localStorage. El blur es solo cosmético; el texto/aria queda intacto para lectores.
export const useDiscreet = () => {
  const on = useState('discreet', () => false)

  function apply(v: boolean) {
    on.value = v
    if (import.meta.client) {
      document.documentElement.classList.toggle('discreet', v)
      try { localStorage.setItem('amanti_discreet', v ? '1' : '0') } catch {}
    }
  }
  function toggle() { apply(!on.value) }
  function init() {
    if (import.meta.client && localStorage.getItem('amanti_discreet') === '1') apply(true)
  }
  return { on, toggle, init }
}
