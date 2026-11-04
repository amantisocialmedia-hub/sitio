import { test, expect } from '@playwright/test'

for (const [subtotal, envio, total] of [[262,80,342],[999.99,80,1079.99],[1000,0,1000],[1200,0,1200]]) {
  test('resumen y botón: subtotal ' + subtotal, async ({ context, page, baseURL }) => {
    await context.addCookies([{ name: 'amanti_age_ok', value: '1', url: baseURL! }, { name: 'amanti_cookie_consent', value: 'rejected', url: baseURL! }])
    // Fixtures de UI: el servidor nunca acepta estos slugs (probado por resolveItems).
    await page.addInitScript(({subtotal}) => {
      localStorage.setItem('amanti_welcome_seen','1')
      localStorage.setItem('cart',JSON.stringify({ items:[{ slug:'shipping-ui-fixture', name:'Producto de prueba', price:subtotal, quantity:1, emoji:'', bg:'' }], gift:{isGift:false,recipient:'',sender:'',message:''} }))
    }, { subtotal })
    // Bloquea toda escritura: esta prueba solo comprueba la presentación del carrito.
    await page.route('**/api/**', route => route.request().method() === 'GET' ? route.continue() : route.fulfill({status:400,body:'{}'}))
    await page.goto('/carrito')
    const row = page.locator('.sline').filter({ has: page.locator('span').filter({hasText:/^Envío$/}) })
    await expect(row).toContainText(envio ? '$ 80' : 'Gratis')
    const formatted = '$ ' + total.toLocaleString('es-MX')
    await expect(page.locator('.sline.total')).toContainText(formatted)
    await expect(page.locator('.cb-total')).toContainText(formatted)
  })
}
