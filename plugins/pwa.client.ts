// Registra el service worker (instalable + shell offline) y captura el evento
// beforeinstallprompt para ofrecer una instalación con nuestro propio botón.
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }

  const { deferred, canInstall } = useInstallPrompt()
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault() // evita el mini-infobar nativo; mostramos nuestro banner
    deferred.value = e
    canInstall.value = true
  })
  window.addEventListener('appinstalled', () => {
    canInstall.value = false
    deferred.value = null
  })
})
