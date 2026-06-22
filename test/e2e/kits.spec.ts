import { test, expect } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'amanti_age_ok', value: '1', url: 'http://localhost:3010' },
    { name: 'amanti_cookie_consent', value: 'rejected', url: 'http://localhost:3010' },
  ])
})

test.describe('Página /kits', () => {
  test('lista >=3 kits y el primero tiene >=2 items', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto('/kits', { waitUntil: 'networkidle' })

    const cards = page.locator('.kitcard')
    await expect(cards.first()).toBeVisible()
    expect(await cards.count()).toBeGreaterThanOrEqual(3)

    const firstItems = cards.first().locator('.kit-items li')
    const itemCount = await firstItems.count()
    expect(itemCount).toBeGreaterThanOrEqual(2)

    expect(errors).toEqual([])
  })

  test('añadir kit al carrito agrega sus items y aparecen como filas en /carrito', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto('/kits', { waitUntil: 'networkidle' })

    const firstCard = page.locator('.kitcard').first()
    await expect(firstCard).toBeVisible()

    // Nº de items del primer kit (cada uno es un slug distinto -> una fila por slug en el carrito)
    const itemCount = await firstCard.locator('.kit-items li').count()
    expect(itemCount).toBeGreaterThanOrEqual(2)

    const addBtn = firstCard.getByRole('button', { name: /Añadir kit al carrito/i })
    await expect(addBtn).toBeVisible()
    await addBtn.click()
    // botón cambia a estado "añadido" y dispara evento cart:add
    await page.waitForTimeout(400)

    await page.goto('/carrito', { waitUntil: 'networkidle' })

    const rows = page.locator('.carttable tbody tr')
    await expect(rows.first()).toBeVisible()
    expect(await rows.count()).toBeGreaterThanOrEqual(itemCount)

    expect(errors).toEqual([])
  })

  test('sin overflow horizontal @390', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/kits', { waitUntil: 'networkidle' })
    await expect(page.locator('.kitcard').first()).toBeVisible()
    await page.waitForTimeout(300)

    const ov = await page.evaluate(() =>
      Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    )
    expect(ov).toBeLessThanOrEqual(1)
  })
})

test.describe('Home /', () => {
  test('tiene la sección "Kits listos para disfrutar"', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto('/', { waitUntil: 'networkidle' })

    await expect(
      page.getByRole('heading', { name: 'Kits listos para disfrutar' }),
    ).toBeVisible()

    expect(errors).toEqual([])
  })
})
