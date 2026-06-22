import { test, expect } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
})

// Lee la opacidad computada de un elemento como número
async function opacityOf(el: import('@playwright/test').Locator): Promise<number> {
  return el.evaluate((node) => parseFloat(getComputedStyle(node as Element).opacity || '1'))
}

test('hover de 2ª foto: .pimg2 crossfade de oculta a visible al pasar el mouse', async ({ page }) => {
  await page.goto('/tienda', { waitUntil: 'networkidle' })

  // Primera .pcard que contenga una segunda foto (.pimg2)
  const card = page.locator('.pcard:has(.pimg2)').first()
  await expect(card).toBeVisible()

  const img2 = card.locator('.pimg2')
  await expect(img2).toBeAttached()

  // Llevamos la tarjeta a la vista para asegurar interacción estable
  await card.scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)

  // En reposo la 2ª foto está prácticamente oculta (opacity:0)
  const restOpacity = await opacityOf(img2)
  expect(restOpacity).toBeLessThan(0.1)

  // Hover sobre la tarjeta -> crossfade (transition .4s); esperamos a que termine
  await card.hover()
  await page.waitForTimeout(550)

  // Tras el hover la 2ª foto está prácticamente visible (opacity:1)
  const hoverOpacity = await opacityOf(img2)
  expect(hoverOpacity).toBeGreaterThan(0.9)
})
