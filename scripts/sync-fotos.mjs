// Asigna fotos automáticamente: pon imágenes en public/products/ nombradas por slug
// (ej. tiny-teasers-nubby_1.jpg, tiny-teasers-nubby_2.jpg) y corre: node scripts/sync-fotos.mjs
import { readdirSync, readFileSync, writeFileSync } from 'fs'

const dataPath = new URL('../data/products.json', import.meta.url)
const data = JSON.parse(readFileSync(dataPath, 'utf8'))
const files = readdirSync(new URL('../public/products', import.meta.url))
  .filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f))
  .sort()

let asignadas = 0, sinFoto = []
for (const p of data.products) {
  const mine = files.filter(f => f === `${p.slug}${f.slice(p.slug.length)}` && (f.startsWith(p.slug + '.') || f.startsWith(p.slug + '_') || f.startsWith(p.slug + '-')))
  p.images = mine.map(f => `/products/${f}`)
  if (mine.length) asignadas++
  else sinFoto.push(p.slug)
}
writeFileSync(dataPath, JSON.stringify(data, null, 2))
console.log(`✅ ${asignadas} productos con foto · ${sinFoto.length} sin foto`)
if (sinFoto.length) console.log('Sin foto:', sinFoto.join(', '))
