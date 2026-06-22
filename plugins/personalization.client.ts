// Hidrata la personalización (respuestas del quiz + vistos recientemente) desde
// localStorage al cargar, para que cualquier página tenga los datos disponibles.
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return
  usePersonalization().hydrate()
})
