import { test, expect } from '@playwright/test'

// Suprime age-gate y banner de cookies (overlays globales) para poder interactuar.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
})

test('personalización: el quiz alimenta "Elegidos para ti" y la ficha alimenta "Vistos recientemente"', async ({ page }) => {
  // El quiz tiene transiciones (qfade) entre pasos: reducimos motion para evitar flaky.
  await page.emulateMedia({ reducedMotion: 'reduce' })

  // 1) Completar el quiz: 4 preguntas, eligiendo siempre la primera opción.
  await page.goto('/quiz', { waitUntil: 'networkidle' })
  await expect(page.locator('.quiz-opt').first()).toBeVisible()

  for (let i = 0; i < 4; i++) {
    // En cada paso el grupo de opciones se vuelve a renderizar (Transition out-in),
    // por eso re-seleccionamos .quiz-opt .first() en cada iteración.
    await expect(page.locator('.quiz-opt').first()).toBeVisible()
    await page.locator('.quiz-opt').first().click()
    // Espera a que termine la transición de paso (out-in) antes del siguiente clic.
    await page.waitForTimeout(450)
  }

  // 2) Tras la 4ª respuesta aparece el resultado "Esto es para ti".
  await expect(page.getByRole('heading', { name: 'Esto es para ti' })).toBeVisible()

  // 3) Ir al home: debe aparecer la sección personalizada "Elegidos para ti".
  await page.goto('/', { waitUntil: 'networkidle' })
  const elegidos = page.getByRole('heading', { name: /Elegidos para ti/i })
  await expect(elegidos).toBeVisible()

  // La sección personalizada contiene al menos una tarjeta de producto (.pcard).
  const elegidosSection = page.locator('section', { has: elegidos })
  await expect(elegidosSection.locator('.pcard').first()).toBeVisible()
  expect(await elegidosSection.locator('.pcard').count()).toBeGreaterThanOrEqual(1)

  // Sin overflow horizontal en el home con las secciones personalizadas.
  const ov1 = await page.evaluate(
    () => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
  )
  expect(ov1).toBeLessThanOrEqual(1)

  // 4) Visitar una ficha de producto registra "visto recientemente" (addRecent onMounted).
  await page.goto('/tienda/vibrating-g', { waitUntil: 'networkidle' })
  await page.waitForTimeout(250)

  // 5) Volver al home: debe aparecer la sección "Vistos recientemente".
  await page.goto('/', { waitUntil: 'networkidle' })
  const vistos = page.getByRole('heading', { name: /Vistos recientemente/i })
  await expect(vistos).toBeVisible()

  // La sección de vistos recientemente tiene al menos una tarjeta de producto.
  const vistosSection = page.locator('section', { has: vistos })
  await expect(vistosSection.locator('.pcard').first()).toBeVisible()
  expect(await vistosSection.locator('.pcard').count()).toBeGreaterThanOrEqual(1)

  // Sigue sin haber overflow horizontal.
  const ov2 = await page.evaluate(
    () => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
  )
  expect(ov2).toBeLessThanOrEqual(1)
})
