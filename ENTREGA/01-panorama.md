# Panorama y arquitectura

Esta sección es el punto de entrada al repo. Dice qué es el sistema, con qué está hecho, dónde
vive cada cosa, cómo se renderiza y cómo se levanta en una máquina limpia. Todo lo que aquí se
afirma sale de un archivo del repo y se cita con su ruta.

---

## 1. Qué es esto

Una tienda en línea de juguetes sexuales con entrega discreta, para el mercado mexicano, con
precios en pesos. El nombre del paquete es `amanti-store-cake` (`package.json:2`); la bitácora del
proyecto dice que el repo es `memorx/amanti-store` y que producción es `https://amanti.mx`,
alojada en Vercel bajo el proyecto `amanti-store-cake` (`BITACORA.md:4`).

No es un escaparate: la tienda cobra. Hay **tres caminos de venta vivos al mismo tiempo**, y los
tres crean un pedido en Supabase antes de mandar al cliente a ningún lado:

| Camino | Endpoint | Cómo se enciende |
|---|---|---|
| Mercado Pago Checkout Pro | `server/api/checkout.post.ts` | Con `NUXT_MP_ACCESS_TOKEN` puesto |
| Stripe Checkout (hospedado) | `server/api/stripe-checkout.post.ts` | El botón solo aparece con `NUXT_PUBLIC_STRIPE_ENABLED=1` (`nuxt.config.ts:119`) |
| Pedido por WhatsApp | `server/api/order-whatsapp.post.ts` | Siempre; usa `NUXT_PUBLIC_WHATSAPP_PHONE` |

El pedido por WhatsApp registra el `order` en estado `pending` **antes** de abrir el enlace, para
que quede rastro aunque el cliente nunca escriba (`server/api/order-whatsapp.post.ts:1-3`).

Alrededor de la tienda cuelgan cuatro integraciones que también viven en este repo:

- **Feed de Google Merchant Center**: `GET /feeds/google.xml`, generado al vuelo desde el mismo
  catálogo que usa la tienda (`server/routes/feeds/google.xml.get.ts:1-4`).
- **Catálogo público para el agente de chat EROS (n8n)**: `GET /api/catalog`
  (`server/api/catalog.get.ts:1-3`). El widget de chat habla con n8n a través de
  `POST /api/chat`, que hace de proxy para no exponer la URL del webhook ni pelearse con CORS
  (`server/api/chat.post.ts:1-2`).
- **Puente hacia GoHighLevel** (marketing: postcompra, carrito abandonado, reactivación, aviso a
  quien surte, aviso de envío al cliente): `server/utils/ghl.ts:1-5`.
- **Consola de pedidos para quien surte**: `GET /api/pedidos?pin=XXXX` y
  `POST /api/pedido-enviado`, con la pantalla en `pages/pedidos.vue`. Está pensada para el
  teléfono y el acceso es un PIN compartido, no una cuenta (`pages/pedidos.vue:2-7`).

---

## 2. Aviso antes de seguir: `SETUP.md` está desactualizado

`SETUP.md` es el documento original de arranque del proyecto y **ya no describe el sitio que hay
hoy**. Sigue siendo útil para la parte de variables de entorno y para los pasos de Stripe, pero
varias de sus afirmaciones son falsas. Verificado archivo por archivo:

| Lo que dice `SETUP.md` | Realidad en el repo |
|---|---|
| «Sin rebajas por producto … `compareAt` = 0 en todo el catálogo» (`SETUP.md:40`) | **Falso hoy.** Hay una campaña global de 40% encendida: `CAMPANA.activa: true` (`utils/campana.ts:43`). `aplicarCampana()` baja `price` al precio con descuento y mete el precio de lista en `compareAt` (`utils/campana.ts:170-176`), así que todo el catálogo se muestra con precio tachado. |
| «los descuentos viven en los cupones … que se honran al pagar» (`SETUP.md:40`) | **Falso mientras la campaña esté encendida.** `CUPONES_ACEPTADOS = !CAMPANA.activa` (`utils/campana.ts:138`) y `validateCoupon()` rechaza cualquier cupón con un mensaje explícito (`server/utils/coupons.ts:61-67`). El motivo está escrito: 40% + 15% daría 49% sin que nadie lo decidiera. |
| Cupón de Aplazo `AMANTI25` (`SETUP.md:40`) | **No existe.** La única aparición de «Aplazo» o «AMANTI25» en todo el código fuera de `SETUP.md` es el comentario que explica por qué se quitó: Aplazo no está contratado y anunciarlo prometía algo que la tienda no puede cumplir (`components/PromoBanners.vue:2-5`). |
| «banda Aplazo» en el home (`SETUP.md:66`) | **No se renderiza.** `PromoBanners.vue` solo pinta la banda de Mercado Pago; la prop `show` se conservó únicamente para no romper a quien ya la pasaba (`components/PromoBanners.vue:9-19`). |
| «`/cuenta` (stub de login)» (`SETUP.md:97`) | **Falso.** Es un panel completo: login/registro sin sesión y, con sesión, pestañas de perfil, direcciones y pedidos (`pages/cuenta/index.vue:5-9`, `:34-46`), con cuatro componentes en `components/account/`. |
| «El catálogo de demo trae 8 productos AMANTI en 5 categorías» (`SETUP.md:88`) | **Falso.** 152 productos y 10 categorías en `data/products.json`. |
| «`/blog` … 6 artículos» (`SETUP.md:96`) | **Falso.** 14 artículos en `data/articles.json`. |
| Lista de páginas (`SETUP.md:94-99`) | **Incompleta.** Faltan `/kits`, `/quiz`, `/pedidos` y `/cuenta/nueva-contrasena`. |
| «Deploy a Vercel … sin config extra» (`SETUP.md:79`) | **Incompleto.** Sí existe `vercel.json`, con 149 redirects 301 desde las URLs viejas de Wix. |
| Tabla de variables de entorno (`SETUP.md:29-38`) | **Incompleta.** No menciona las cinco de GoHighLevel, ni `NUXT_N8N_CHAT_WEBHOOK`, ni `NUXT_ENVIO_COSTO` / `NUXT_PUBLIC_ENVIO_COSTO`. El inventario bueno de variables es `.env.example`, no `SETUP.md`. |

**Regla práctica:** para variables de entorno, usa `.env.example`. Para el estado real del
proyecto, usa `BITACORA.md`. `SETUP.md` léelo como historia.

---

## 3. El stack, con versiones

Todo sale de `package.json` (lo declarado) y de `package-lock.json` (lo que de verdad se instala).

**Dependencias de producción** (`package.json:15-22`):

| Paquete | Declarado | Resuelto en `package-lock.json` |
|---|---|---|
| `nuxt` | `^3.21.2` | 3.21.6 (`package-lock.json:9241`) |
| `vue` | `^3.5.30` | 3.5.35 (`package-lock.json:12898`) |
| `pinia` | `^2.3.0` | 2.3.1 (`package-lock.json:9673`) |
| `@pinia/nuxt` | `^0.9.0` | 0.9.0 (`package-lock.json:4089`) |
| `pinia-plugin-persistedstate` | `^3.2.3` | — |
| `@nuxtjs/supabase` | `^2.0.9` | 2.0.9 (`package-lock.json:2768`) |

**Dependencias de desarrollo** (`package.json:23-29`):

| Paquete | Declarado | Resuelto |
|---|---|---|
| `@nuxt/image` | `^2.0.0` | 2.0.0 (`package-lock.json:1965`) |
| `@playwright/test` | `^1.60.0` | 1.60.0 (`package-lock.json:4114`) |
| `vitest` | `^4.1.8` | 4.1.8 (`package-lock.json:12795`) |
| `@vue/test-utils` | `^2.4.11` | — |
| `happy-dom` | `^20.10.3` | — |

Notas que importan:

- **No hay framework de CSS.** Ni Tailwind, ni una librería de componentes. Hay un solo archivo
  global, `assets/css/main.css`, cargado desde `nuxt.config.ts:24`, con las variables de marca en
  `:root` (`assets/css/main.css:2-28`); el resto del estilo vive en `<style scoped>` dentro de cada
  componente. Las tipografías son Google Fonts cargadas sin bloquear, con el truco de
  `media="print"` + `onload="this.media='all'"` y un `<noscript>` de respaldo
  (`nuxt.config.ts:69-82`).
- **TypeScript no aparece en `package.json`**: entra con Nuxt. `npm run postinstall` corre
  `nuxt prepare`, que es lo que genera los tipos de `.nuxt/` (`package.json:10`).
- **`@nuxt/image` es devDependency** aunque sea un módulo activo (`nuxt.config.ts:6`). Funciona
  porque los módulos de Nuxt solo hacen falta al construir; la salida de `.output/` ya viene
  resuelta. Pero significa que **una instalación sin devDependencies no puede construir el sitio**.
- **`package.json` no tiene campo `engines`**: la versión de Node no está fijada en el repo.

---

## 4. Mapa del repo

Estructura estándar de Nuxt 3, sin `src/`: todo cuelga de la raíz.

| Carpeta / archivo | Qué vive ahí |
|---|---|
| `pages/` | 21 páginas `.vue`. El enrutador sale de aquí por convención de nombre de archivo. |
| `components/` | 22 componentes `.vue` (18 en la raíz + 4 en `components/account/`). Auto-importados por Nuxt. |
| `layouts/` | Un solo layout, `default.vue`: nebulosa de fondo, `SiteHeader`, `<slot/>`, `AppFooter`, `BottomNav`, botón de WhatsApp, `CartDrawer`, `CookieConsent` y `AgeGate`. |
| `composables/` | 7 composables (`useAuth`, `useProducts`, `useAnalytics`, `useCartUI`, `useDiscreet`, `useInstallPrompt`, `usePersonalization`). |
| `stores/` | 2 stores de Pinia: `cart.ts` y `wishlist.ts`. |
| `utils/` | 7 utilidades **compartidas entre cliente y servidor**: `buscar`, `campana`, `gclid`, `gtag`, `nombreResena`, `phone`, `swipe`. Que estén aquí y no en `server/utils/` es deliberado: las usan los dos lados. |
| `plugins/` | 9 plugins. 8 son `.client` (solo navegador); `reveal.ts` es universal a propósito, para que la directiva `v-reveal` exista también en SSR. |
| `server/api/` | 13 endpoints (Nitro). Ver tabla abajo. |
| `server/routes/` | 1 ruta pública fuera de `/api`: `feeds/google.xml.get.ts`. |
| `server/utils/` | 10 módulos de servidor: `supabaseAdmin`, `orders`, `orderItems`, `coupons`, `envio`, `costoEnvio`, `baseUrl`, `ghl`, `avisoPedido`, `resenaToken`. |
| `data/` | El catálogo y el contenido, en JSON: `products.json`, `articles.json`, `kits.json`, `reviews.json`. **Esta es la fuente de verdad del catálogo, no una base de datos.** |
| `assets/css/` | `main.css`, el único CSS global. |
| `public/` | Estáticos servidos tal cual: fotos de producto, banners, íconos de marca, `robots.txt`, `sitemap.xml`, `sw.js` (service worker) y `manifest.webmanifest`. |
| `supabase/` | 8 archivos `.sql` con el esquema (tablas, políticas). Son el registro de lo que se aplicó a mano en el panel de Supabase. |
| `scripts/` | 11 archivos de herramientas de fotos, fuera del sitio: 7 `.py`, 1 `.mjs` y 3 `.json` de alias. Bajan, emparejan y sincronizan las fotos de producto. No forman parte del build. |
| `test/` | `unit/` (24), `smoke/` (2) y `e2e/` (23 specs + 1 ayudante). |
| `vercel.json` | 149 redirects 301 desde las URLs de la tienda vieja de Wix. |
| `BITACORA.md` | El registro de qué se hizo, qué se decidió y por qué. **Es la mejor fuente del estado real.** |
| `SETUP.md` | Documento de arranque original, parcialmente obsoleto (ver §2). |

**Carpetas que verás en disco y no son del repo:** `node_modules/`, `.nuxt/`, `.output/`,
`.vercel/`, `fotos_raw/`, `test-results/` — todas ignoradas por `.gitignore`.

### Endpoints de servidor

| Ruta | Qué hace |
|---|---|
| `POST /api/checkout` | Crea `order` pending + `order_items` en Supabase y la preferencia de Mercado Pago (`server/api/checkout.post.ts:1-3`) |
| `POST /api/mp-webhook` | Webhook de pago de Mercado Pago. Valida firma HMAC y **re-consulta el pago contra la API de MP**: no confía en el payload (`server/api/mp-webhook.post.ts:1-4`) |
| `GET /api/mp-webhook` | Solo existe para que pase la prueba de conectividad del panel de MP, que valida con un GET tipo IPN clásico (`server/api/mp-webhook.get.ts:1-4`) |
| `POST /api/stripe-checkout` | Espejo del de MP, con Checkout Session de Stripe (`server/api/stripe-checkout.post.ts:1-3`) |
| `POST /api/stripe-webhook` | Webhook de Stripe con verificación de firma `stripe-signature` (`server/api/stripe-webhook.post.ts:1-3`) |
| `POST /api/order-whatsapp` | Registra el pedido antes de abrir el enlace de WhatsApp (`server/api/order-whatsapp.post.ts:1-3`) |
| `POST /api/coupon-validate` | Valida cupón del lado servidor con `service_role`; el cliente no puede leer `public.coupons` (`server/api/coupon-validate.post.ts:1-4`) |
| `POST /api/cart-save` | Snapshot de carrito abandonado. Degrada con gracia si no existe la tabla (`server/api/cart-save.post.ts:1-4`) |
| `GET /api/pedidos?pin=` | Pedidos pagados, para quien surte (`server/api/pedidos.get.ts:1-3`) |
| `POST /api/pedido-enviado` | Marca enviado, guarda la guía y dispara el aviso al cliente (`server/api/pedido-enviado.post.ts:1-3`) |
| `POST /api/resena` | Reseña de quien compró sin cuenta (`server/api/resena.post.ts:1-3`) |
| `GET /api/catalog` | Catálogo público para el agente EROS (`server/api/catalog.get.ts:1-3`) |
| `POST /api/chat` | Proxy al webhook de n8n (`server/api/chat.post.ts:1-2`) |
| `GET /feeds/google.xml` | Feed de Google Merchant, RSS 2.0 (`server/routes/feeds/google.xml.get.ts:1`) |

---

## 5. Cómo se renderiza, y qué implica

`nuxt.config.ts` **no** pone `ssr: false` ni `nitro.preset`. Eso significa dos cosas:

1. El sitio es **SSR**: cada página se arma en el servidor y luego hidrata en el navegador. No es
   un SPA ni un sitio estático. Existe el script `npm run generate` (`package.json:8`), pero no es
   el camino que se usa: Playwright arranca el servidor de Nitro con
   `node .output/server/index.mjs` (`playwright.config.ts:31`), y `SETUP.md:22` documenta ese mismo
   comando para correr el build.
2. El **preset de Nitro lo escoge el entorno**. En Vercel se detecta solo; en local corre en Node.
   El código detecta Vercel leyendo `process.env.VERCEL` (`nuxt.config.ts:18`,
   `server/utils/baseUrl.ts:19-21`).

De ahí salen cuatro consecuencias que el código asume en todos lados. Vale la pena entenderlas
antes de tocar nada:

**El servidor corre en UTC, no en hora de México.** Cualquier decisión de calendario tiene que
declarar la zona horaria. `utils/campana.ts:97-104` define `diaMx()` con
`Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' })` exactamente por eso: con la
hora del servidor, un banner con fecha de fin se apagaría seis horas antes de tiempo. Además esa
decisión se toma **una sola vez en el servidor** y se serializa al navegador con `useState`, para
que no cambie al hidratar (`BITACORA.md:82-87`).

**Lo que renderiza el servidor no puede depender de `window` ni de `localStorage`.** Por eso 8 de
los 9 plugins son `.client`. El único universal es `plugins/reveal.ts`, y el comentario del archivo
explica por qué: la directiva `v-reveal` tiene que existir también en SSR para no reventar el
render, pero su `mounted` solo corre en cliente.

**Los datos privados no se renderizan en servidor.** `nuxt.config.ts:9-13` lo deja escrito:
`redirect: false` en el módulo de Supabase, login y registro en la misma página `/cuenta`, sin
middleware de ruta (no existe carpeta `middleware/`). `/cuenta` espera a que la sesión se resuelva
en el cliente antes de decidir qué pintar, para no enseñarle el formulario de login a alguien que ya
tiene sesión (`pages/cuenta/index.vue:13-16`). **Si algún día una subruta renderiza datos privados
en SSR, hay que añadir middleware** — el propio config lo advierte (`nuxt.config.ts:10-12`).

**El catálogo se importa como módulo, no se consulta.** `data/products.json` entra por `import` en
el cliente (`composables/useProducts.ts:1`, `stores/cart.ts:2`) y en el servidor
(`server/api/catalog.get.ts:5`, `server/routes/feeds/google.xml.get.ts:18`). Se queda fijo al
construir.

> **Consecuencia práctica:** cambiar un precio, dar de alta un producto o marcar algo como
> `agotado` **exige un despliegue**. No hay panel. No hay conteo de inventario: `agotado` es una
> bandera que se prende a mano en `data/products.json` cuando avisan que se acabó algo
> (`server/utils/orderItems.ts:27-29`, `composables/useProducts.ts:22-23`).

Y el corolario que sostiene todo el sistema de precios: **el precio que se cobra sale del catálogo
del servidor, nunca del que manda el cliente** (`server/utils/orderItems.ts:1-3`). La campaña se
aplica en ese mismo punto, porque si se aplicara solo en la vista el cliente vería 40% menos y
Mercado Pago le cobraría el precio completo (`server/utils/orderItems.ts:18-20`).

---

## 6. Los módulos de Nuxt activos

Son tres (`nuxt.config.ts:6`).

**`@pinia/nuxt`** — estado global. Dos stores: `cart` y `wishlist`. La persistencia en
`localStorage` no viene del módulo: la da `pinia-plugin-persistedstate`, instalado a mano en
`plugins/0.pinia-persist.client.ts`. **El prefijo `0.` del nombre no es decorativo**: obliga a que
ese plugin corra antes que `cart-recovery.client.ts` y `wishlist-sync.client.ts`, que instancian
stores. Un store creado antes de ese `.use()` no persiste (`plugins/0.pinia-persist.client.ts:3-6`).

**`@nuxt/image`** — optimización de imágenes. `provider: 'vercel'` cuando existe `process.env.VERCEL`,
e `ipx` (Node, local) cuando no (`nuxt.config.ts:16-22`). Formato WebP, calidad 72, densidades 1x y 2x.
Consecuencia en local: el primer `GET /tienda` con el servidor frío optimiza 143 imágenes con ipx y
es lento; por eso el timeout de Playwright está en 45 segundos y los workers topados en 2
(`playwright.config.ts:11-17`). En producción eso lo resuelve el CDN de Vercel.

**`@nuxtjs/supabase`** — autenticación y datos (cuentas, direcciones, pedidos, reseñas, wishlist,
cupones, carritos abandonados). Configurado con `redirect: false` (`nuxt.config.ts:13`), decisión
explicada en el comentario de arriba. Lee `SUPABASE_URL` y `SUPABASE_KEY` (la llave anon). El acceso
privilegiado va aparte, en `server/utils/supabaseAdmin.ts`, con `SUPABASE_SERVICE_ROLE_KEY`, y
**nunca** se expone al cliente (`server/utils/supabaseAdmin.ts:3-5`).

DevTools de Nuxt están apagados (`nuxt.config.ts:4`); si los quieres, se encienden ahí.

---

## 7. Correr en local desde cero

```bash
git clone <repo>
cd <repo>
npm install                 # corre nuxt prepare por postinstall (package.json:10)
cp .env.example .env        # y luego edita .env
npm run dev                 # http://localhost:3000
```

Sobre el `.env`: `.env.example` es el inventario bueno y trae explicado para qué es cada variable.
Las que el propio archivo marca como obligatorias son `NUXT_PUBLIC_WHATSAPP_PHONE`, `SUPABASE_URL`,
`SUPABASE_KEY` y, en producción, `SUPABASE_SERVICE_ROLE_KEY` — sin esta última **todo pago con
Mercado Pago devuelve HTTP 500** (`.env.example:38-41`). Las de GoHighLevel, Stripe y Mercado Pago
pueden quedarse vacías en local: sin URL configurada, el puente de GHL simplemente no hace nada y
devuelve `false` (`server/utils/ghl.ts:21-23`).

`.env` está ignorado por git y no se sube (`.gitignore:5-7`).

### Scripts disponibles (`package.json:5-14`)

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en `http://localhost:3000` |
| `npm run build` | Build de producción a `.output/` |
| `npm run preview` | Previsualiza el build |
| `npm run generate` | Generación estática (existe, pero no es el modo que usa el proyecto) |
| `npm run test:unit` | `vitest run` |
| `npm run test:e2e` | `playwright test` |
| `npm test` | `vitest run && playwright test` |

### Correr el build como en producción

```bash
npm run build
node .output/server/index.mjs   # puerto 3000
```

### Correr las pruebas

Unitarias: entorno `happy-dom`, incluye `test/unit/**/*.test.ts` y `test/smoke/**/*.test.ts`,
con `globals: true` y los alias `~` y `@` apuntando a la raíz (`vitest.config.ts:7-14`). No
necesitan servidor ni red.

```bash
npm run test:unit
```

End-to-end (Playwright):

```bash
npm run build                  # OBLIGATORIO antes de los e2e
npx playwright install chromium
npm run test:e2e
```

> ⚠️ **Trampa 1 — `npm test` no construye.** El script es `vitest run && playwright test`
> (`package.json:11`) y Playwright arranca su servidor con `node .output/server/index.mjs`
> (`playwright.config.ts:31`). Si no corriste `npm run build` antes, ese archivo no existe y **la
> suite e2e completa truena**, sin que el error diga nada sobre el build.

> ⚠️ **Trampa 2 — servidor reutilizado con código viejo.** `reuseExistingServer: true`
> (`playwright.config.ts:48`): si ya hay algo escuchando en el puerto, Playwright lo reutiliza en
> vez de levantar el suyo. Si ese proceso es un build anterior, la suite prueba **código viejo y
> pasa en verde**. Ante un resultado que no cuadra, mata lo que esté en el puerto y reconstruye.

Detalles del arranque de Playwright que ahorran tiempo:

- El puerto es **3457**, configurable con `E2E_PORT`. No es el 3010 porque en la máquina donde se
  desarrolló eso cae en el rango que Windows reserva para Hyper-V/WSL y Node truena con `EACCES`
  antes de escuchar, así que ningún e2e corría (`playwright.config.ts:3-6`).
- Un solo proyecto, `chromium` desktop. La cobertura móvil no es otro proyecto: vive dentro de
  `responsive.spec.ts`, que fija el viewport a 393 px con `setViewportSize`, para no obligar a los
  specs de escritorio a un layout donde algunos controles quedan ocultos (`playwright.config.ts:26-29`).
- `retries: 1`, para absorber hipos del rate-limit de auth de Supabase (`playwright.config.ts:19`).
- **Los specs de pedidos están condicionados a variables de entorno.** La `service_role` se pasa
  desde el shell como `SB_SVC` y nunca va escrita en el repo; sin ella esos endpoints responden 500
  y los tests se saltan (`playwright.config.ts:36-37`). La bitácora anota 16 saltados en la corrida
  completa del 10/09 por faltarles `SB_URL` / `SB_ANON` / `SB_SVC` (`BITACORA.md:26-28`).
- El webhook de Mercado Pago tiene un modo de prueba que **solo funciona fuera de producción**: el
  config fuerza `NODE_ENV=test` y `MP_WEBHOOK_TEST_MODE=1` para poder simular pagos. En Vercel,
  `NODE_ENV=production` deshabilita ese bypass aunque la variable existiera
  (`playwright.config.ts:41-45`).
- **Acoplamiento escondido que conviene saber antes de borrar nada:** los e2e no esperan
  `networkidle` (que en este sitio depende de terceros y a veces nunca llega); esperan a que
  aparezca el launcher del chat EROS, porque vive en `app.vue` dentro de `<ClientOnly>` y solo
  existe en el DOM cuando la app ya hidrató (`test/e2e/hidratacion.ts:3-13`). Si algún día se quita
  el widget de chat, **los 13 specs que usan ese ayudante truenan por timeout** y hay que cambiar
  la señal ahí.

---

## 8. Inventario numérico del proyecto

Conteos hechos sobre el repo el 18 de septiembre de 2026.

**Código**

| Qué | Cuántos |
|---|---|
| Páginas (`pages/**/*.vue`) | 21 |
| Componentes (`components/**/*.vue`) | 22 (18 raíz + 4 en `account/`) |
| Layouts | 1 |
| Composables | 7 |
| Stores de Pinia | 2 |
| Utilidades compartidas (`utils/`) | 7 |
| Plugins | 9 (8 `.client`, 1 universal) |
| Endpoints en `server/api/` | 13 |
| Rutas públicas en `server/routes/` | 1 (`/feeds/google.xml`) |
| Utilidades de servidor (`server/utils/`) | 10 |

**Rutas que existen** (de `pages/`): `/`, `/tienda`, `/tienda/[slug]`, `/carrito`, `/favoritos`,
`/kits`, `/quiz`, `/blog`, `/blog/[slug]`, `/nosotros`, `/contacto`, `/faq`, `/rewards`, `/cuenta`,
`/cuenta/nueva-contrasena`, `/pedidos`, `/envios`, `/pagos`, `/garantias`, `/terminos`,
`/privacidad`. Más el 404 con marca (`error.vue`), que cubre cualquier ruta inexistente.

**Contenido y datos**

| Qué | Cuántos | Dónde |
|---|---|---|
| Productos | 152 | `data/products.json` |
| Categorías | 10 | `data/products.json` |
| Subcategorías del mega-menú | 47 | `composables/useProducts.ts:76-137` |
| Artículos del blog (Eroteca) | 14 | `data/articles.json` |
| Kits | 4 | `data/kits.json` |
| Archivos de foto de producto | 496 | `public/products/` |
| Esquemas SQL | 8 | `supabase/` |
| Redirects 301 | 149 (140 de `/product-page/…`, 9 de `/category/…`) | `vercel.json` |
| URLs en el sitemap estático | 159 (11 fijas, 142 de producto, 6 de blog) | `public/sitemap.xml` |

**Pruebas**

| Qué | Cuántos |
|---|---|
| Archivos de prueba unitaria (`test/unit/`) | 24 |
| Archivos de prueba smoke (`test/smoke/`) | 2 |
| Specs end-to-end (`test/e2e/*.spec.ts`) | 23 (+ `hidratacion.ts`, que es ayudante, no spec) |
| Declaraciones `test(...)` / `it(...)` en los specs e2e | 69 |

**Verificado el 18/09/2026, al preparar esta entrega:** la suite unitaria dio **268 pruebas en verde
en 26 archivos**, en unos 30 segundos, con `npx vitest run --pool=threads --no-file-parallelism`
(en máquinas lentas el modo por defecto puede fallar al levantar los workers; ver `09-pruebas.md`).
De las e2e, la última corrida completa registrada es la del 10/09: 62 verdes y 16 saltadas, que
piden credenciales de Supabase (`BITACORA.md:25-28`). Lo primero que conviene hacer al recibir el
proyecto es correr las dos y quedarse con los números de tu máquina.

La bitácora también deja anotada deuda de pruebas conocida, para que no te confíe un verde: el
test 4 de `test/e2e/busqueda-analytics.spec.ts` **pasa en falso** (su `pushState` no llega al
router), y el del widget en `test/e2e/chat.spec.ts` depende de la respuesta real de n8n
(`BITACORA.md:79-80`).

---

## 9. Trampas que pueden tumbar producción o costar dinero

Cinco cosas que conviene saber antes de tocar el primer archivo. Las cinco están documentadas en el
código; esto es un índice, no la explicación completa.

> ⚠️ **1. La campaña de 40% es un booleano manual sin caducidad, y ya tiene fecha vencida encima.**
> `CAMPANA.activa: true` (`utils/campana.ts:43`). El acuerdo del equipo fue apagarla el **30 de
> septiembre de 2026** (`utils/campana.ts:28-31`). **No se apaga sola**: alguien tiene que venir a
> poner `false` y desplegar. Si nadie lo hace, la tienda sigue regalando el 40% indefinidamente y
> nada avisa (`utils/campana.ts:33-35`, `BITACORA.md:89-93`).
>
> Y no se apaga solo eso: al feed de Google **a propósito** no se le puso
> `sale_price_effective_date`. Si el feed caducara el 30-sep y el interruptor siguiera encendido,
> Google anunciaría el precio de lista mientras la tienda cobra el rebajado; eso es discrepancia de
> precio y **Merchant Center suspende los productos por eso**. Los dos se apagan el mismo día o
> ninguno (`utils/campana.ts:37-41`).

> ⚠️ **2. Cada disparo a GoHighLevel cuesta dinero.** Los triggers son premium y se cobran **por
> uso** (`server/utils/ghl.ts:12-17`, `.env.example:47-49`). Por eso `carrito_abandonado` lleva un
> candado en el llamador que lo limita a una vez por episodio de carrito en lugar de las 8-10 que
> saldrían siguiendo cada guardado. No quites ese candado, y no pongas esas URLs en un entorno de
> pruebas que dispare tráfico real. Las URLs traen el id de la cuenta de GHL: quien las tenga puede
> disparar el workflow y generar cobro, y por eso no se commitean (`server/utils/ghl.ts:53-55`).

> ⚠️ **3. `NUXT_PUBLIC_PUBLIC_BASE_URL` faltante en producción significa pagos cobrados que nunca
> se registran.** El valor de respaldo en `nuxt.config.ts` es `http://localhost:3000`. Si esa
> variable llegara a faltar en Vercel, el sitio le diría a Mercado Pago que mande las notificaciones
> a localhost: el cobro sí se hace, el webhook no llega nunca, los pedidos se quedan en `pending`
> para siempre y quien surte no se entera. Todo eso sin un solo error en ningún lado. Por eso
> existe `server/utils/baseUrl.ts`: corriendo en Vercel, un `localhost` se trata como configuración
> rota y se usa el dominio público (`server/utils/baseUrl.ts:1-21`).

> ⚠️ **4. El respaldo del teléfono de WhatsApp en `nuxt.config.ts` tiene que ser el número bueno.**
> Según el comentario del propio config, nueve lugares del sitio arman enlaces de WhatsApp,
> incluido `stores/cart.ts`, que es por donde se piden pedidos. Buscando `wa.me` y `whatsappPhone`
> aparecen ocho archivos de aplicación (`components/WhatsAppButton.vue`, `components/ChatWidget.vue`,
> `components/BottomNav.vue`, `stores/cart.ts`, `pages/tienda/[slug].vue`, `pages/contacto.vue`,
> `pages/terminos.vue`, `pages/garantias.vue`), así que el orden de magnitud es el mismo.
> Si `NUXT_PUBLIC_WHATSAPP_PHONE` faltara —alguien la borra, un entorno nuevo, un
> preview sin ella— todos caerían en ese respaldo en silencio, y serían pedidos yéndose a un
> número ajeno. Ya pasó una vez: entre un cambio de número y el 31-ago-2026 esa línea tuvo un número
> viejo, y nadie lo notó porque en producción la variable siempre gana (`nuxt.config.ts:102-114`).

> ⚠️ **5. `public/sitemap.xml` es un archivo estático y ya está desfasado.** Lista 142 productos
> contra los 152 del catálogo, y 6 artículos contra los 14 que hay. No se regenera solo: hay que
> actualizarlo a mano cada vez que se dan de alta productos o artículos. (El feed de Google, en
> cambio, **sí** se genera al vuelo y no tiene este problema.) Ojo también con `public/robots.txt`,
> que bloquea `/carrito`, `/cuenta`, `/favoritos` y `/pedidos`.

Un detalle menor pero que confunde si no se sabe: **los IDs de GA4, Google Ads, Clarity y Meta
Pixel están escritos en el código**, no en variables de entorno
(`plugins/tracking.client.ts:14-17`). Si buscas dónde cambiarlos, es ahí. Ese mismo archivo
implementa Consent Mode v2: Google carga siempre pero con consentimiento denegado por defecto,
mientras que Clarity y Meta Pixel no se cargan hasta que la persona acepta
(`plugins/tracking.client.ts:1-11`).

---

## 10. Lo que esta sección NO puede afirmar

Todo lo anterior se leyó del repo. Tres cosas que el repo no dice **se confirmaron contra los paneles
el 18/09/2026** y están en `00-LEEME-PRIMERO.md` y `07-variables-de-entorno.md`: qué variables están
cargadas en Vercel producción (sus nombres, no sus valores), a qué equipo y proyecto está ligado
(`izalith/amanti-store-cake`) y cuántas pruebas pasan hoy (268).

Estas otras **no son verificables desde el repo** y quien reciba el proyecto tiene que confirmarlas
en los paneles correspondientes:

- Los **valores** de las variables de entorno. Por regla, este paquete nunca los lee.
- Qué tablas, columnas y políticas RLS existen de verdad en Supabase. Los `.sql` de `supabase/` son
  el registro de lo que se pensaba aplicar; que estén aplicados es otra cosa.
- Con qué versión de Node construye Vercel. `package.json` no tiene campo `engines`.
- Si el sitio arranca en local sin `SUPABASE_URL` / `SUPABASE_KEY`, o si el módulo falla al iniciar.
  No se probó.
- Si las URLs de webhook de GoHighLevel, Mercado Pago y Stripe están dadas de alta y apuntando a
  este sitio.
