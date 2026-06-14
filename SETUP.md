# AMANTI — Tienda (estilo Cake Sex Shop)

Tienda completa en **Nuxt 3 + Vue 3 + Pinia**, con diseño calcado de cake-sexshop.com
(morado + serif, mega-menús, banners de promo, rebajas, rewards) y **catálogo AMANTI**.

> El diseño y la estructura replican a Cake; el **logo**, los **banners** y los **productos** son de AMANTI (no se copiaron sus assets ni su catálogo).

---

## Cómo correr en local

```bash
npm install
cp .env.example .env      # luego edita .env (ver abajo)
npm run dev               # http://localhost:3000
```

Build de producción:

```bash
npm run build
node .output/server/index.mjs   # corre el build (puerto 3000)
```

---

## Variables de entorno (`.env`)

| Variable | Para qué | Obligatoria |
|---|---|---|
| `NUXT_PUBLIC_WHATSAPP_PHONE` | Número de WhatsApp para pedidos (formato `52` + `1` + 10 dígitos, sin `+`) | **Sí** (para pedidos por WhatsApp) |
| `NUXT_MP_ACCESS_TOKEN` | Access token de MercadoPago (sandbox o producción) | Solo para cobrar con MercadoPago |
| `NUXT_PUBLIC_PUBLIC_BASE_URL` | URL pública del sitio (para los redirects de MP). En local `http://localhost:3000`; en prod la URL de Vercel/dominio | Sí en prod |
| `NUXT_PUBLIC_SITE_URL` | URL canónica (`https://amanti.mx`) | No |

---

## Qué YA está hecho

- **Home** completa: barra discreta, búsqueda, pills de beneficios, hero SALE, banda MercadoPago, banda Aplazo, mosaico de categorías, banner de marca, íconos redondos, carruseles (Novedades / Lo más vendido), Especial de la semana, FAQ, AMANTI Rewards, reseñas, "¿Por qué AMANTI?" + manifiesto, newsletter.
- **Nav morado** con **mega-menús** y toda la taxonomía estilo Cake (Vibradores, Masturbadores, Dildos, Lencería, Blog…) + barra inferior fija + WhatsApp flotante + drawer móvil.
- **Colección** (`/tienda`): hero, breadcrumb, **filtros laterales** (categorías, ofertas, marca, precio), orden (relevancia/precio/alfabético), grid y estado vacío. Filtra por `?cat=`, `?sale=1`, `?q=`.
- **Ficha de producto** (`/tienda/[slug]`): galería, rating, subtítulo, marca, 4 badges circulares, precio/rebaja, íconos de pago, nota de MSI, selector de cantidad, **Añadir al carrito**, **Pedir por WhatsApp**, lista de confianza, tabs (Descripción/Políticas/Envíos/Garantía), relacionados.
- **Carrito** (`/carrito`): tabla, resumen, **Pagar con MercadoPago** (vía `/api/checkout`), **Ordenar por WhatsApp**, bloque de Rewards, más vendidos, y mensajes de estado (`?status=success|failure|pending`).
- Carrito **persistente** (localStorage) con Pinia.
- Backend listo: `server/api/checkout.post.ts` (crea preferencia de MercadoPago y redirige), `stores/cart.ts` (incluye generador de link de WhatsApp).

---

## WIRING que falta (para Claude Code)

1. **Editar `.env`**: poner el `NUXT_PUBLIC_WHATSAPP_PHONE` real (ej. `5214431234567`). Dejar `NUXT_MP_ACCESS_TOKEN` vacío por ahora si aún no se cobra con MP.
2. **Deploy a Vercel** (Nuxt/Nitro se detecta solo, sin config extra).
3. En Vercel, cargar las env vars, incluyendo `NUXT_PUBLIC_PUBLIC_BASE_URL` = la URL de Vercel, y re-deploy.
4. Verificar HTTP 200 en `/`, `/tienda`, `/tienda/luna-suave`, `/carrito`.
5. (Opcional) Cuando haya token de MercadoPago, probar el flujo de pago real.

---

## Nota sobre el catálogo

El catálogo de demo trae **8 productos AMANTI** en 5 categorías (vibradores, parejas, lubricantes, wellness, exploración). Los mega-menús muestran la taxonomía completa estilo Cake, pero las subcategorías sin inventario aparecerán vacías hasta cargar más productos. Editar el catálogo en **`data/products.json`**.

---

## Páginas incluidas (todas funcionales)

- `/` Home · `/tienda` colección con filtros · `/tienda/[slug]` ficha · `/carrito`
- `/favoritos` (wishlist funcional — el corazón guarda en el dispositivo) ❤️
- `/blog` (Eroteca) + `/blog/[slug]` (6 artículos en `data/articles.json`)
- `/nosotros` · `/contacto` · `/faq` · `/rewards` · `/cuenta` (stub de login)
- `/envios` · `/pagos` · `/garantias` · `/terminos` · `/privacidad`
- **404 con marca** (`error.vue`) para cualquier ruta inexistente.

Todos los enlaces del nav y del footer ya apuntan a páginas reales.

> ⚠️ **Textos legales** (`/terminos`, `/privacidad`, `/garantias`): son un marco general de ejemplo. Antes de publicar, revísalos/ajústalos con un asesor legal (especialmente el aviso de privacidad conforme a la LFPDPPP).
