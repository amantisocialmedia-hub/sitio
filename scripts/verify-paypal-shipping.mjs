// Run explicitly in Vercel Preview: node scripts/verify-paypal-shipping.mjs
// Creates unapproved Sandbox orders only. No database, capture, or application endpoints.
import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

if (process.env.VERCEL_ENV !== 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF !== 'fix/envio-80-mxn-preview' ||
    process.env.NUXT_PAYPAL_ENV !== 'sandbox') {
  throw new Error('Verification requires the shipping Preview branch and explicit sandbox mode.')
}
if (!process.env.NUXT_PAYPAL_CLIENT_ID || !process.env.NUXT_PAYPAL_CLIENT_SECRET) {
  throw new Error('Sandbox credentials missing.')
}
await mkdir('.nuxt', { recursive: true })
const outfile = resolve('.nuxt/verify-paypal-shipping.mjs')
await build({
  stdin: { contents: `
    import { ofetch } from 'ofetch'
    import { randomUUID } from 'node:crypto'
    import assert from 'node:assert/strict'
    import { leerConfigPaypal, tokenPaypal, crearOrdenPaypal } from './server/utils/paypal'
    import { calcularEnvio } from './utils/shipping'
    globalThis.$fetch = ofetch
    export async function verify() {
      const cfg = leerConfigPaypal({
        paypalClientId: process.env.NUXT_PAYPAL_CLIENT_ID,
        paypalClientSecret: process.env.NUXT_PAYPAL_CLIENT_SECRET,
        paypalEnv: 'sandbox',
      })
      assert.equal(cfg.ambiente, 'sandbox')
      const token = await tokenPaypal(cfg)
      for (const [subtotal, expectedShipping] of [[262, 80], [999.99, 80], [1000, 0], [1000.01, 0]]) {
        const shippingCost = calcularEnvio(subtotal)
        assert.equal(shippingCost, expectedShipping)
        const total = Math.round((subtotal + shippingCost) * 100) / 100
        const result = await crearOrdenPaypal(cfg, token, {
          order: {
            id: randomUUID(),
            items: [{ name: 'SANDBOX shipping verification', unitPrice: subtotal, quantity: 1 }],
            discount: 0, shippingCost, total, shippingAddress: null,
          },
          returnUrl: 'https://example.invalid/sandbox-verification',
          cancelUrl: 'https://example.invalid/sandbox-verification',
        })
        // Independently read PayPal's stored order, not just our outbound payload.
        const saved = await ofetch('https://api-m.sandbox.paypal.com/v2/checkout/orders/' + encodeURIComponent(result.id), {
          headers: { Authorization: 'Bearer ' + token },
        })
        assert.ok(['CREATED', 'PAYER_ACTION_REQUIRED'].includes(saved.status), 'Unapproved order status')
        const amount = saved.purchase_units[0].amount
        console.log('PAYPAL_SANDBOX_OBSERVED ' + JSON.stringify({ id: saved.id, status: saved.status, amount }))
        assert.equal(amount.currency_code, 'MXN')
        assert.equal(amount.value, total.toFixed(2))
        assert.equal(amount.breakdown.item_total.value, subtotal.toFixed(2))
        assert.equal(Number(amount.breakdown.shipping?.value || 0), expectedShipping)
        console.log('PAYPAL_SHIPPING_VERIFIED ' + JSON.stringify({
          subtotal, shipping: expectedShipping, total, currency: amount.currency_code,
          paypalOrderId: saved.id, status: saved.status,
        }))
      }
      console.log('PAYPAL_SHIPPING_ALL_PASSED: 4 Sandbox orders; no approvals, captures, or database writes.')
    }
  `, resolveDir: process.cwd(), loader: 'ts' },
  outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external',
})
try {
  const { verify } = await import(pathToFileURL(outfile).href)
  await verify()
} catch (error) {
  // Never log a fetch error object: it may contain authentication headers.
  console.error('PAYPAL_SHIPPING_FAILED', JSON.stringify({
    status: error?.response?.status || error?.statusCode || null,
    code: error?.data?.name || error?.code || 'verification-failed',
  }))
  process.exitCode = 1
}
