import { expect, type Page } from '@playwright/test'

// Espera a que la app ya esté hidratada, en cualquier página. Se usa en lugar de
// waitUntil 'networkidle', que en este sitio depende de terceros y a veces nunca llega
// (ver regalo.spec.ts).
//
// La señal es el launcher de EROS: components/ChatWidget.vue lo pinta dentro de <ClientOnly> y
// vive en app.vue, así que solo existe en el DOM cuando la app ya montó. Antes de eso los botones
// que vienen del SSR ya se ven, pero un clic puede caer cuando todavía no tienen handler. Se mide
// con toHaveCount y no con toBeVisible porque abrir el chat lo esconde con v-show. Si algún día se
// quita el chat, esto truena con un timeout sobre .eros-launcher: hay que cambiar la señal aquí.
export async function esperarHidratacion(page: Page) {
  await expect(page.locator('.eros-launcher')).toHaveCount(1, { timeout: 15_000 })
}
