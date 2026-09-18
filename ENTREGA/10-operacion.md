# Manual de operación

Este capítulo es el recetario. Cada receta es una tarea que esta tienda pide de verdad, con los pasos en orden, los archivos exactos que hay que tocar y cómo comprobar que quedó. Está escrito para alguien que nunca ha abierto este repo y que no va a tener a quién preguntarle.

Tres ideas que conviene traer en la cabeza antes de la primera receta:

1. **El catálogo es un archivo de texto, no una base de datos.** Los productos viven en `data/products.json`, los artículos del blog en `data/articles.json`, los kits en `data/kits.json` y las reseñas curadas en `data/reviews.json`. No hay panel de administración. Cambiar un precio o marcar algo agotado es editar JSON, hacer commit y desplegar.
2. **Hay dos clases de interruptor y no se tocan igual.** Lo que tiene que ser idéntico en el navegador y en el servidor vive en el **código** (la campaña de descuento, el umbral de envío gratis). Lo que es una decisión comercial que debe poder cambiarse sin desplegar vive en **variables de entorno** (el costo de envío, las URLs de GoHighLevel). Cada receta dice cuál es cuál y por qué.
3. **Nadie corre los tests por ti.** No hay integración continua: no existe carpeta `.github/` en el repo, `package.json:5-14` define `build: nuxt build` sin `prebuild` ni ganchos, y `vercel.json` sólo trae redirecciones (no hay `buildCommand`). Vercel construye y publica aunque el catálogo esté roto. Correr la suite antes de hacer commit es responsabilidad tuya y de nadie más.

---

## 0. Antes de tocar nada: instalar, correr, probar y desplegar

### 0.1 Levantar el proyecto en local

```bash
npm install
cp .env.example .env    # luego edita .env
npm run dev             # http://localhost:3000
```

Esos son los pasos que documenta `SETUP.md:12-16`. Pero **`.env.example` no basta**.

`.env.example` (57 líneas) cubre WhatsApp, Mercado Pago, Stripe, Supabase y las cinco URLs de GoHighLevel. Le faltan cinco variables que el código sí lee:

| Falta en `.env.example` | Quién la lee | Qué se rompe sin ella |
|---|---|---|
| `NUXT_ENVIO_COSTO` | `server/utils/costoEnvio.ts:23` | El envío sale gratis siempre (ver receta 7) |
| `NUXT_PUBLIC_ENVIO_COSTO` | `nuxt.config.ts:121-125` | El carrito pinta envío $0 |
| `NUXT_PEDIDOS_PIN` | `server/api/pedidos.get.ts:17`, `server/api/pedido-enviado.post.ts:11` | `/api/pedidos` responde **404**: la pantalla de surtido no abre |
| `NUXT_PROMO_VIGENCIA` | `server/routes/feeds/google.xml.get.ts:55` | El feed de Google no manda fecha de fin de la promo |
| `NUXT_RESENA_SECRET` | `server/utils/resenaToken.ts:27` | No se firman ni se aceptan reseñas de invitado |

Y hay una sexta que tampoco está: `NUXT_N8N_CHAT_WEBHOOK`, el webhook del agente EROS. Esa sí tiene valor por defecto cableado en `nuxt.config.ts:99`, y `server/api/chat.post.ts:7` lo usa tal cual, así que el chat funciona en local sin configurar nada — pero ese default está en el código y hay que saberlo.

> **Si vas a probar envío, `/pedidos`, la vigencia de la promo o las reseñas de invitado en local, agrega esas variables a mano a tu `.env`.** Copiar `.env.example` y llenarlo te deja sin cobro de envío, sin pantalla de pedidos y sin vigencia de promo, y **sin un solo error visible**: todo degrada en silencio a propósito. Vale la pena actualizar `.env.example` en el repo para que el siguiente no tropiece con lo mismo.

**Para que el sitio arranque de verdad hacen falta las tres de Supabase**: `SUPABASE_URL`, `SUPABASE_KEY` (la anon/public) y `SUPABASE_SERVICE_ROLE_KEY` (`.env.example:34-41`, `nuxt.config.ts:8-14`). Sin las dos primeras no hay cuentas, wishlist en la nube ni reseñas reales; sin la tercera, **todo pago con Mercado Pago devuelve HTTP 500** (`.env.example:38-41`). La tienda, el catálogo y el carrito se ven bien sin ellas, y ese es justo el engaño: `npm run dev` te enseña una tienda que parece completa.

> ⚠️ **Nunca copies valores de `.env` a un documento, a un ticket ni a un chat.** Ahí viven el token de Mercado Pago, la llave `service_role` de Supabase, los secretos de Stripe y las URLs de webhook de GoHighLevel. Quien las tenga puede cobrar, leer clientes o disparar automatizaciones que se pagan por uso. En cualquier comunicación va **el nombre de la variable, nunca el valor**.

### 0.2 La base de datos: la carpeta `supabase/`

El esquema esperado de Supabase vive en el repo, en `supabase/*.sql`. En una instalación nueva hay que correr esos archivos en **Supabase → SQL Editor → New query → Run** (`supabase/all.sql:1-6`). Son idempotentes: se pueden correr más de una vez sin romper nada.

| Archivo | Qué crea o cambia |
|---|---|
| `supabase/all.sql` | El paquete completo: `leads` (`:9`), `wishlist_items` (`:22`), `reviews` (`:39`), la columna `gift` en `orders` (`:61`) y `abandoned_carts` (`:64`), con sus políticas de RLS |
| `supabase/abandoned-carts.sql` | Sólo `abandoned_carts` (`:12`), si ya tienes lo demás |
| `supabase/reviews.sql` | Sólo `reviews` (`:9`) y sus políticas |
| `supabase/wishlist.sql` | Sólo `wishlist_items` (`:9`) |
| `supabase/orders-gift.sql` | `alter table orders add column gift` (`:10`) |
| `supabase/orders-envio.sql` | Agrega `shipped_at` y `tracking` a `orders` (`:10`, `:13`) — es lo que hace posible la pantalla `/pedidos` |
| `supabase/resenas-invitado.sql` | Hace `user_id` opcional en `reviews`, agrega `order_id` y el índice único parcial (`:16`, `:19`, `:28-30`) |
| `supabase/addresses-colonia.sql` | Agrega la columna de colonia a `addresses` (`:19`) |

> **Lo que el repo NO trae: el `create table` original de `orders` y de `order_items`, ni la tabla de cupones.** Los SQL de arriba los dan por existentes (`orders-envio.sql:10` hace `alter table public.orders`). Si montas un proyecto de Supabase desde cero vas a tener que reconstruir esas dos tablas leyendo qué columnas usa el código: `server/api/pedidos.get.ts:31` lista las de `orders` y `:42` las de `order_items`, y `server/utils/orderItems.ts:94-104` arma las filas de `order_items`.

Nota de diseño que se repite en varios lugares: **`abandoned_carts` y `reviews` tienen RLS encendido y ninguna política para el cliente** (`supabase/abandoned-carts.sql:23-24`). Sólo el servidor escribe, con la llave de servicio, que se salta RLS. `supabase/resenas-invitado.sql:9-13` explica por qué no se abrió una política a `anon` para las reseñas de invitado: el endpoint ya comprueba la firma del enlace, que el pedido esté pagado y que incluya ese producto — abrir RLS sería dejar abierta justo la puerta que el endpoint está cuidando.

### 0.3 Las dos suites y qué cubre cada una

`package.json:11-13` define:

| Comando | Qué corre |
|---|---|
| `npm run test:unit` | Vitest: `test/unit/**` y `test/smoke/**` (`vitest.config.ts:12`) |
| `npm run test:e2e` | Playwright: `test/e2e/**` |
| `npm test` | Las dos, una tras otra (`vitest run && playwright test`) |

**`npm run test:unit` es la que vas a correr después de casi toda receta.** Es rápida y es la que revisa la integridad del catálogo y de los datos.

**`npm run test:e2e` necesita un build previo.** Playwright levanta el servidor con `node .output/server/index.mjs` (`playwright.config.ts:31`), o sea el build de producción, no `nuxt dev`. Si no corriste `npm run build` antes, no hay qué levantar:

```bash
npm run build
npm run test:e2e
```

El puerto por defecto es `3457` y se puede pisar con `E2E_PORT` (`playwright.config.ts:6`); el comentario de ahí explica por qué ya no es el 3010: en la máquina donde se desarrolló, ese puerto cae en el rango que Windows reserva para Hyper-V/WSL y Node truena con `EACCES` antes de escuchar, así que Playwright no podía levantar su servidor y **ningún** e2e corría.

> **Una parte de los e2e se salta sola si no le das credenciales de Supabase.** Los specs de cupones, pedidos y cuentas hacen `test.skip` cuando faltan `SB_URL`, `SB_ANON` y `SB_SVC` (`test/e2e/coupons.spec.ts:17`, `test/e2e/orders.spec.ts:14`, `test/e2e/account-auth.spec.ts:14`). La bitácora registra una corrida completa con **62 verdes, 0 rojos y 16 saltados** exactamente por eso (`BITACORA.md:25-28`). Si ves "16 skipped" y das por hecho que todo pasó, no probaste pedidos ni cupones. `SB_SVC` es la llave `service_role` y se pasa desde el shell, nunca hardcodeada (`playwright.config.ts:35-37`).

### 0.4 Desplegar

El repo apunta a `git@github.com:memorx/amanti-store.git` y la única rama configurada es `master` (`.git/config:8-13`). No hay flujo de ramas ni de pull requests montado en el repo: no existe `.github/`, ni plantillas de PR, ni workflows. El trabajo se empuja a `master`.

Existe una carpeta `.vercel/` (`.vercel/project.json`) que liga este repo a un proyecto de Vercel. **El mecanismo exacto del despliegue —si Vercel construye solo al hacer push a `master` o si alguien corre el CLI— no se puede verificar leyendo el repo**; confírmalo entrando al panel de Vercel.

Lo que sí está documentado y muerde: **en Vercel una variable de entorno nueva o modificada sólo entra con un despliegue nuevo** (`BITACORA.md:867-868`; ahí se cuenta que hubo que hacer un commit vacío justamente para eso). Cambiar la variable y quedarse mirando el sitio esperando que cambie es la forma más común de perder media hora.

### 0.5 Revertir un despliegue que salió mal

Esta es la salida natural cuando una receta se tuerce en producción, y hay dos caminos.

**Camino 1 — revertir el commit (siempre disponible, y es el que deja rastro).**

```bash
git log --oneline -5          # identifica el commit malo
git revert <sha>              # crea un commit que deshace ese cambio
git push origin master
```

`git revert` no reescribe historia, así que es seguro aunque alguien más ya haya bajado el cambio. Si el despliegue se dispara solo con el push, con esto basta; si no, hay que volver a lanzarlo desde Vercel.

**Camino 2 — promover el despliegue anterior desde el panel de Vercel.** Es más rápido que un revert porque no reconstruye nada. *(Sin verificar desde el repo: no hay forma de comprobar desde aquí que ese botón esté disponible en este proyecto ni con qué permisos.)*

> ⚠️ **Revertir el código NO revierte una variable de entorno.** Si lo que rompiste fue el valor de `NUXT_ENVIO_COSTO` o una URL de GoHighLevel, el revert de código no hace nada: hay que corregir la variable en Vercel **y** disparar un despliegue nuevo (`BITACORA.md:867-868`).

> ⚠️ **Revertir no despinta el feed de Google de inmediato.** El feed se sirve con `s-maxage=86400` (`server/routes/feeds/google.xml.get.ts:183`), así que el CDN puede seguir entregando el XML malo hasta 24 horas después de que tú ya veas el bueno. Ver receta 6.

---

## 1. Dar de alta un producto nuevo

### Qué es un producto aquí

Un objeto dentro del arreglo `products` de `data/products.json`. El arreglo arranca en la línea 74; antes van las 10 categorías (`:2-73`). Hoy hay 152 productos. El primero, en las líneas 75 en adelante, sirve de plantilla.

### Pasos

**1. Elige el slug.** Es el identificador y va directo a la URL `/tienda/<slug>`. Tiene que ser kebab-case estricto: minúsculas, números y guiones simples. Lo verifica `test/smoke/catalog.test.ts:72-75` con la expresión `^[a-z0-9]+(-[a-z0-9]+)*$`. No puede repetirse (`:21-25`).

**2. Agrega el objeto con los campos obligatorios.**

| Campo | Regla | Dónde se verifica |
|---|---|---|
| `slug` | kebab-case, único | `test/smoke/catalog.test.ts:21-25`, `:72-75` |
| `name` | no vacío | `test/smoke/catalog.test.ts:27-32` |
| `price` | número mayor a 0 | `test/smoke/catalog.test.ts:27-32` |
| `category` | uno de los 10 slugs de `categories` | `test/smoke/catalog.test.ts:27-32` |
| `compareAt` | `0`, o un número **mayor** que `price` | `test/smoke/catalog.test.ts:52-55` |
| `rating` | entre 1 y 5 | `test/smoke/catalog.test.ts:62-65` |
| `emoji` y `bg` | los dos presentes | `test/smoke/catalog.test.ts:57-60` |
| `brand`, `subtitle`, `description`, `features` | presentes, `features` con al menos 1 | `test/smoke/catalog.test.ts:67-70` |

El smoke del catálogo (`test/smoke/catalog.test.ts`) rechaza estos campos, pero **sólo cuando corres `npm run test:unit`**. No hay CI ni gancho de build: Vercel construye y publica aunque el producto no traiga `rating`, no traiga `brand` o tenga `compareAt <= price`. Correr la suite antes de hacer commit es responsabilidad tuya.

Las 10 categorías válidas están en `data/products.json:2-73`: `vibradores`, `dildos`, `anal`, `bdsm`, `parejas`, `hombre`, `arneses`, `masturbadores`, `retardantes`, `lubricantes`.

> ⚠️ **El `price` es el precio de LISTA, no el que se cobra hoy.** Con la campaña del 40% encendida, el sitio vende a 60% de ese número y lo hace en un solo lugar (`utils/campana.ts:170-176`). Si capturas el precio ya rebajado, el producto sale rebajado dos veces. Lo mismo al revés: `compareAt` se debe dejar en `0` — la campaña lo llena sola con el precio de lista para que la UI lo tache.

Campos opcionales que sí hacen algo:

- `hot: true` → entra al carrusel de más vendidos (`composables/useProducts.ts:150`).
- `featured: true` → entra a los destacados (`composables/useProducts.ts:151`).
- `badges` → los distintivos circulares de la ficha.
- `feedTitle`, `feedDescription` → título y descripción optimizados sólo para Google, con caída al `name` y `description` normales (`server/routes/feeds/google.xml.get.ts:121-122`).
- `feedId` → **si está presente, sustituye siempre el `g:id`**: el código emite `xmlEscape(p.feedId || p.slug)` sin mirar nada más (`server/routes/feeds/google.xml.get.ts:120`). Existe porque Google corta el id a 50 caracteres, así que en la práctica sólo se pone en los slugs largos (la razón está escrita en el comentario de `:34`), **pero el código no verifica la longitud**: si lo pones en un slug corto, gana igual.
- `excludeFromFeed: true` → lo saca del feed de Google sin quitarlo de la tienda (`server/routes/feeds/google.xml.get.ts:114`).
- `agotado: true` → ver la receta 2.

**3. Pon las fotos.** Los archivos van en `public/products/`, nombrados por slug.

Las reglas reales de nombrado están en `scripts/sync-fotos.mjs:8,13`, y son más anchas de lo que parece:

- **Extensiones aceptadas:** `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif` (`:8`).
- **Prefijos aceptados:** el nombre tiene que empezar con el slug seguido de `.`, `_` o `-` (`:13`). O sea que `mi-producto.jpg`, `mi-producto_1.jpg` y `mi-producto-frente.webp` son todos válidos.
- **El orden es alfabético** (`.sort()` en `:9`), no el que tú imagines.

> ⚠️ **La PRIMERA imagen del arreglo no es cosmética.** `images[0]` es la que se manda a Google como `g:image_link` (`server/routes/feeds/google.xml.get.ts:125`; las demás van como `additional_image_link`) y la que se guarda como snapshot en el pedido (`server/utils/orderItems.ts:24-26`). Como el orden sale de un `sort()` alfabético, `mi-producto-zoom.jpg` se va antes que `mi-producto_1.jpg`. Si te importa cuál es la principal, nómbralas para que ordenen bien (`_1`, `_2`, `_3`).

Después puedes correr:

```bash
node scripts/sync-fotos.mjs
```

que recorre `public/products/` y llena el campo `images` de cada producto (`scripts/sync-fotos.mjs:1-2`).

> ⚠️ **Ese script reescribe `images` de TODOS los productos, no sólo del nuevo.** El bucle de `scripts/sync-fotos.mjs:12-17` asigna `p.images = mine` sin condición, así que cualquier producto cuyo archivo no esté hoy en `public/products/` se queda con `images: []` y pierde sus fotos en el JSON. Si no tienes el directorio completo de imágenes en tu copia local, **no lo corras**: escribe el arreglo `images` a mano.

Si lo escribes a mano, cada ruta debe empezar con `/products/` (`test/smoke/catalog.test.ts:77-80`) y el archivo tiene que existir de verdad en `public/products/` (`test/smoke/catalog.test.ts:34-43`).

**4. Sube el conteo del smoke.** `test/smoke/catalog.test.ts:14` clava el número:

```ts
expect(products.length).toBe(152)
```

Si agregas un producto y no cambias ese 152 por 153, `npm run test:unit` truena. No es un bug del test: es el candado que evita que alguien borre productos sin darse cuenta.

**5. Agrega la URL al sitemap.** `public/sitemap.xml` es un **archivo estático**, no se genera solo. Agrega una línea con el mismo formato que las demás:

```xml
<url><loc>https://amanti.mx/tienda/mi-producto</loc></url>
```

> Dato para calibrar expectativas: hoy el sitemap trae 142 URLs de producto contra 152 productos en el catálogo, o sea que ya viene desfasado. Si vas a ponerte al corriente, ese es el hueco.

**6. (Opcional) Reseñas curadas.** Si quieres que la ficha nazca con reseñas, agrega una entrada en `data/reviews.json` con el slug como llave y un arreglo de objetos `{ name, rating, date, text, verified }` (`pages/tienda/[slug].vue:13-14`). Las reseñas reales de Supabase se anteponen a estas (`pages/tienda/[slug].vue:15-17`). El smoke exige que **todo slug que aparezca ahí exista en el catálogo** (`test/smoke/datos.test.ts:46-49`), así que si borras un producto, borra también su bloque de reseñas.

### Cómo verificar que quedó

1. `npm run test:unit` en verde.
2. `npm run dev` y abrir `http://localhost:3000/tienda/<slug>`: la ficha carga, con foto y precio.
3. `http://localhost:3000/api/catalog`: el producto aparece en la lista, con `inStock: true` y su `url` (`server/api/catalog.get.ts:15-33`). Esto importa porque de ahí lee el agente de chat EROS.
4. `http://localhost:3000/feeds/google.xml`: hay un `<item>` con tu slug en el `<g:id>` y tu foto principal en `<g:image_link>`.

---

## 2. Marcar un producto como agotado (y devolverlo)

No hay conteo de inventario. Es una bandera que alguien prende a mano cuando avisan que se acabó (`server/utils/orderItems.ts:27-29`).

### Para marcarlo

En `data/products.json`, dentro del objeto del producto, agrega:

```json
"agotado": true
```

Eso es todo. Se propaga solo a **cuatro superficies**, y vale la pena saber cuáles son porque cada una cubre un agujero distinto:

| Superficie | Qué hace | Dónde |
|---|---|---|
| Ficha de producto | Cambia "Añadir al carrito" por un botón muerto "Agotado por ahora", y el botón de WhatsApp pasa a decir "Avísame cuando vuelva" | `pages/tienda/[slug].vue:444-446` |
| Feed de Google | Manda `<g:availability>out_of_stock</g:availability>` | `server/routes/feeds/google.xml.get.ts:132` |
| `/api/catalog` | Devuelve `inStock: false` | `server/api/catalog.get.ts:31` |
| Cobro (`resolveItems`) | **Rechaza el pedido con HTTP 409** nombrando el producto | `server/utils/orderItems.ts:67-72` |

La cuarta es la importante y el comentario de `server/utils/orderItems.ts:62-66` explica por qué: esconder el botón en la ficha no basta. Alguien puede traer la página abierta desde antes, tener el carrito guardado en su navegador o entrar por el enlace directo de un anuncio de Google. Si el rechazo viviera sólo en la vista, esa persona pagaría por algo que no se le puede enviar, y devolver un cobro cuesta más que perder la venta.

La tercera también tiene historia: cuando se agregó la bandera se cablearon tres superficies y `/api/catalog` se quedó fuera (`BITACORA.md:319-334`, con la tabla de las cuatro y el `inStock: true` que estaba cableado). Era la peor para equivocarse, porque las otras sólo *muestran* algo que ya no hay; ésa le contesta al chat, que **recomienda** productos en una conversación uno a uno.

> ⚠️ **Lo que la bandera NO hace: la tarjeta del grid en `/tienda` no cambia.** `components/ProductCard.vue` no consulta `agotado` en ninguna parte, así que el producto se sigue viendo normal en la colección y su botón "Añadir 🛍️" sigue metiéndolo al carrito (`components/ProductCard.vue:61`). El cliente se entera hasta que intenta pagar y el servidor devuelve el 409. Si eso te parece inaceptable, ahí está el pendiente; pero al menos nadie paga de más.

### Para devolverlo a la venta

Quita la línea, o ponla en `false`. Las cuatro superficies vuelven solas.

### Cómo verificar

1. `npm run test:unit` — `test/unit/orders.test.ts:46-78` cubre el rechazo en el servidor, incluido el caso del carrito mixto (basta un agotado para detener el pedido completo).
2. En dev, `/feeds/google.xml` debe traer `out_of_stock` para ese slug, y `/api/catalog` debe traerlo con `inStock: false`.
3. En la ficha, el botón debe estar apagado.

> ⚠️ **El feed tarda en actualizarse hacia afuera.** Se sirve con `Cache-Control: public, max-age=3600, s-maxage=86400` (`server/routes/feeds/google.xml.get.ts:183`), o sea que el CDN puede seguir entregando el XML anterior hasta 24 horas. Si necesitas comprobarlo sin caché, pide la URL con un parámetro cualquiera (`/feeds/google.xml?v=2`).

---

## 3. Agregar o quitar una categoría (y las subcategorías del menú)

Aquí hay **dos taxonomías distintas** y confundirlas es fácil.

| | Categorías | Subcategorías |
|---|---|---|
| Dónde viven | `data/products.json:2-73` (arreglo `categories`) | `composables/useProducts.ts:76-137` (constante `subcategories`) |
| Qué son | El campo `category` de cada producto. Son 10 | Etiquetas del mega-menú que se resuelven **filtrando** el catálogo |
| Cómo se asignan | A mano, en cada producto | Solas, por palabra clave sobre nombre/subtítulo/características |
| URL | `/tienda?cat=<slug>` | `/tienda?cat=<slug>&sub=<slug>` |

### (a) Agregar una categoría

**1. Agrega el objeto al arreglo `categories` de `data/products.json`** con `slug`, `name`, `emoji`, `blurb` e `image`. El `image` apunta a un archivo de `public/categories/` (hoy hay uno por cada una de las 10).

**2. Sube el conteo.** `test/smoke/catalog.test.ts:17-19` clava `expect(categories.length).toBe(10)`. Si agregas una y no lo cambias, `npm run test:unit` truena.

**3. Ponle productos ANTES de hacer commit.** `test/smoke/catalog.test.ts:45-48` exige que **cada categoría declarada tenga al menos 1 producto**. Una categoría vacía no es un adorno inofensivo: sale en el mosaico del home (`pages/index.vue:25`), en los chips de `/tienda` (`pages/tienda/index.vue:173`) y en los filtros laterales (`:215`), y quien la elija llega a una colección vacía.

Hay precedente escrito de exactamente eso: el mega-menú traía "Lencería" apuntando a productos que no existían, y quedó comentado en `components/SiteHeader.vue:106-113` con la razón — «la categoría no existe en el catálogo (0 productos) y el rótulo mandaba a `/tienda` completa ("dildos bajo Lencería")».

**4. Decide si entra al mega-menú.** El menú **no** se arma solo desde `categories`: sus bloques y rótulos están escritos a mano en `components/SiteHeader.vue:89-119`, y cada rótulo se resuelve contra la taxonomía de subcategorías por su `label` (`:87`).

### (b) Quitar una categoría

Es el caso peligroso, porque el smoke lo agarra por el otro lado: `test/smoke/catalog.test.ts:27-32` exige que el `category` de **cada producto** sea un slug que exista. Si borras la categoría y dejas productos apuntando a ella, truena la suite — y si no la corres, esos productos quedan con una categoría fantasma: `categoryName()` devuelve el slug crudo como nombre (`composables/useProducts.ts:148`) y la ficha muestra el slug en el breadcrumb (`pages/tienda/[slug].vue:349`).

Orden correcto: **primero** reasigna todos los productos de esa categoría a otra, **después** bórrala del arreglo y baja el conteo del smoke.

Y revisa dos cosas más antes de borrar:

- `data/articles.json`: un artículo puede traer `relatedCategory` apuntando ahí. El smoke lo verifica (`test/smoke/datos.test.ts:27-34`).
- `composables/useProducts.ts:76-137`: cualquier subcategoría cuyo `category` sea esa se queda huérfana.

### (c) Agregar una subcategoría

Una subcategoría es una regla de filtro, no un dato del producto (`composables/useProducts.ts:43-57`):

```ts
{ slug: 'huevo-vibrador', label: 'Huevo Vibrador', category: 'vibradores', keywords: ['huevo'] }
```

- **Sin `keywords`** → la categoría completa.
- **Con `keywords`** → los productos de esa categoría que mencionen alguna palabra clave en nombre, subtítulo o características (`:61`, `:68-73`). La comparación normaliza acentos y mayúsculas (`:60`), así que `'succion'` encuentra "succión".
- **`category` puede ser un arreglo**, y eso la vuelve transversal. El ejemplo vivo es `'oral'`, que existe a la vez en `lubricantes` y en `parejas` porque las chispas BJ Bang están catalogadas como producto de pareja y los lubricantes de sabor como lubricante (`:51-54`, `:83-87`).

**El menú es dinámico y se autocensura:** una subcategoría sólo aparece si tiene al menos un producto (`components/SiteHeader.vue:122-130`, `composables/useProducts.ts:189-190`). Por eso hay rótulos en `megaBase` —`'Kegel'`, `'Accesorios'`— que nunca se ven: no tienen subcategoría declarada, así que se filtran solos. Para que una subcategoría nueva aparezca en el menú hacen falta **dos** cosas: darla de alta en `composables/useProducts.ts` y meter su `label` **exacto** en el bloque que corresponda de `components/SiteHeader.vue:89-119`.

> ⚠️ **Cuidado con palabras clave demasiado comunes.** Hay un caso documentado: el submenú "Succionador De Clítoris" usaba `'clitoris'` y colaba vibradores normales, porque esa palabra aparece en las `features` de medio catálogo. Se cambió a `'succionador'` (`composables/useProducts.ts:107-109`). Cuando agregues una subcategoría por palabra clave, **cuenta cuántos productos te trae antes de publicarla**.

### Cómo verificar

1. `npm run test:unit` — el smoke cubre el conteo, que ninguna categoría quede vacía y que ningún producto apunte a una inexistente.
2. En dev, `/tienda` debe mostrar el chip de la categoría nueva con su conteo (`pages/tienda/index.vue:56`), y el mosaico del home debe traer su tesela.
3. Abre el mega-menú y confirma que el rótulo nuevo aparece y que al darle clic la colección trae exactamente lo que esperabas, no de más.
4. `/tienda/<slug-de-un-producto-de-esa-categoría>`: el breadcrumb debe mostrar el **nombre** de la categoría, no su slug.

---

## 4. Armar o cambiar un kit

Los kits son paquetes prearmados que se agregan al carrito de un clic. Viven en `data/kits.json`; hoy hay 4.

### Estructura

```json
{
  "slug": "primera-vez",
  "name": "Kit Primera Vez",
  "emoji": "🌱",
  "grad": "linear-gradient(150deg,#FF8A5C,#E8503A)",
  "blurb": "Para estrenarte sin nervios...",
  "items": ["tiny-teasers-nubby", "lubricantes-sunny"]
}
```

`items` es un arreglo de **slugs de producto**, no de objetos. `components/KitCard.vue:6` los resuelve contra el catálogo y el total es la suma de sus precios vigentes (`:7`), o sea con la campaña ya aplicada.

### Reglas que el smoke exige

`test/smoke/datos.test.ts:36-44`:

- **Cada kit necesita al menos 2 items.** Un "kit" de un solo producto no es un kit, es un producto.
- **Cada slug tiene que existir en `data/products.json`.**

Un typo aquí **no truena el build** — el propio archivo lo deja escrito en `test/smoke/datos.test.ts:7-8`: «un slug con typo aquí no truena el build, el producto simplemente desaparece del carrusel/kit en silencio». Peor todavía: `components/KitCard.vue:6` filtra los slugs que no resuelven, así que un kit de tres productos con un typo se publica como kit de dos, con el precio de dos, y nadie se entera.

> ⚠️ **Si borras o renombras un producto, revisa `data/kits.json`, `data/articles.json` (`relatedProducts`) y `data/reviews.json`.** Los tres apuntan al catálogo por slug y los tres degradan en silencio. `npm run test:unit` es lo único que los agarra.

### El texto del pie cambia solo según la campaña

`components/KitCard.vue:42-43`:

- Con `CAMPANA.activa` en `true` → "Precios con **-40%** ya aplicado".
- Con la campaña apagada y `MOSTRAR_CUPONES` en `true` → "+ aplica tu cupón **AMANTI15** al pagar".
- Con las dos apagadas → no sale ningún texto.

Hoy `MOSTRAR_CUPONES` es `false` (`utils/campana.ts:131`, porque `ANUNCIAR_CUPONES` está en `false` en `:124`), así que al apagar la campaña ese renglón simplemente desaparece. **No pongas el descuento en el `blurb` a mano**: se queda pegado el día que la campaña se apague.

### Cómo verificar

1. `npm run test:unit`.
2. En dev, abre la página de kits: el kit debe listar todos sus productos con su foto y su precio, y el "Total del kit" debe cuadrar con la suma.
3. Dale "Añadir kit al carrito" y revisa el carrito: deben entrar **todos** los productos, no menos.

---

## 5. Publicar un artículo del blog

El blog ("Eroteca") se alimenta de `data/articles.json`. Hoy hay 14 artículos.

### Estructura de un artículo

Un objeto en el arreglo `articles`. El primero del archivo (`data/articles.json:3-16`) sirve de plantilla:

| Campo | Para qué |
|---|---|
| `slug` | La URL: `/blog/<slug>`. Único |
| `title` | Encabezado del hero y de la tarjeta |
| `category` | Texto libre; los chips de filtro se arman solos con las categorías que existan (`pages/blog/index.vue:8`) |
| `emoji` | La ilustración de la portada de la tarjeta |
| `c1` y `c2` | Los dos colores del degradado de la portada (`pages/blog/index.vue:48`) |
| `readTime` | Texto, p. ej. `"6 min"` |
| `excerpt` | Resumen de la tarjeta y `meta description` de la página (`pages/blog/[slug].vue:10`) |
| `body` | El cuerpo, como arreglo de bloques |
| `relatedProducts` | Arreglo de slugs de producto para el carrusel del final |
| `relatedCategory` | Slug de categoría, como respaldo del carrusel |

El `body` se pinta en `pages/blog/[slug].vue:26-30` con tres formas de bloque y nada más:

```json
{ "h2": "Un subtítulo" }
{ "p": "Un párrafo." }
{ "ul": ["punto uno", "punto dos"] }
```

Un bloque que no traiga `h2` ni `ul` se pinta como párrafo, y el primero recibe la clase `lead`.

El carrusel de productos relacionados resuelve en este orden: los slugs de `relatedProducts`, luego la categoría de `relatedCategory`, y si aún no llega al mínimo se rellena con destacados y más vendidos (`composables/useProducts.ts:165-178`). Siempre devuelve entre 3 y 8, así que nunca se ve vacío — **y por eso un typo no se nota**: el hueco lo tapa el relleno.

### Pasos

1. Agrega el objeto al arreglo `articles` de `data/articles.json`.
2. **Decide si va destacado.** `/blog` toma `articles[0]` como artículo destacado y lista `articles.slice(1)` en la cuadrícula (`pages/blog/index.vue:10-15`). Poner el nuevo **al principio del arreglo** lo vuelve el destacado; ponerlo al final lo deja como una tarjeta más.
3. Revisa que los slugs de `relatedProducts` existan en `data/products.json` y que `relatedCategory` sea uno de los 10 slugs de categoría.
4. Agrega la URL a `public/sitemap.xml`:
   ```xml
   <url><loc>https://amanti.mx/blog/mi-articulo</loc></url>
   ```
   Hoy el sitemap sólo lista 6 artículos (`public/sitemap.xml:156-161`) contra los 14 del JSON, así que este paso viene arrastrando deuda.

### Cómo verificar

1. `npm run test:unit`. `test/smoke/datos.test.ts:19-34` exige: al menos 12 artículos, **slugs únicos** (un slug repetido rompe el ruteo de `/blog/<slug>`), `title`/`excerpt`/`body`/`category` presentes en todos, y que cada `relatedProducts` y `relatedCategory` apunte a algo que existe.
2. No hay ningún conteo que actualizar: tanto el smoke (`test/smoke/datos.test.ts:16-20`) como el e2e (`test/e2e/blog.spec.ts:27-30`) leen el número desde `data/articles.json` en vez de clavarlo, precisamente para que publicar no obligue a tocar tests. El comentario de `:15-18` lo dice: la Eroteca crece con el plan editorial y clavar el conteo obligaría a tocar el test cada semana sin comprobar nada más.
3. En dev: `/blog` debe mostrar el artículo (destacado o en la cuadrícula), el chip de su categoría debe existir, y `/blog/<slug>` debe cargar con hero, cuerpo y carrusel de productos.

---

## 6. Apagar la campaña del 40%

**Esta es la más delicada del manual. Léela completa antes de tocar nada.**

### Qué es la campaña

Un solo booleano en `utils/campana.ts:43`:

```ts
export const CAMPANA: CampanaCfg = {
  activa: true,
  ...
}
```

El comentario que abre el archivo (`utils/campana.ts:1-15`) explica por qué vive en código y no en una variable de entorno: el precio que ve el cliente y el precio que se le cobra tienen que salir del mismo cálculo. Si el interruptor viviera en el entorno, el navegador y el servidor podrían leer valores distintos durante un despliegue y acabarías enseñando 40% y cobrando el precio completo. Un flag en el código viaja en el mismo bundle para los dos lados: o está encendido en todos, o en ninguno.

También hay que saber esto: **la campaña no se apaga sola.** `utils/campana.ts:28-35` deja por escrito que la fecha de fin acordada era el 30 de septiembre de 2026 y que, si nadie viene a ponerlo en `false`, la tienda sigue regalando el 40% indefinidamente y nada avisa.

### Qué cambia solo al apagarla

- Todos los precios vuelven a los de lista y el precio tachado desaparece, en tienda, ficha, buscador, carrito, cobro de Mercado Pago, pedidos guardados y feed de Google (`utils/campana.ts:10-15`, `:170-176`).
- Desaparece el bloque "VENTA ESPECIAL / 40% OFF" de la portada y el hero vuelve a ser lo primero (`pages/index.vue:82-98`).
- El banner de temporada muere aunque sus fechas siguieran vivas, porque cuelga de `CAMPANA.activa` a propósito: anuncia el mismo 40% y no puede quedarse prometiendo un descuento que la tienda ya no da (`utils/campana.ts:56-58`, `:112`).
- Las tarjetas de kits dejan de decir "Precios con -40% ya aplicado" (`components/KitCard.vue:42`).

### ⚠️ Advertencia 1: apagarla vuelve a encender los cupones en el servidor

```ts
export const CUPONES_ACEPTADOS = !CAMPANA.activa
```
`utils/campana.ts:138`

Mientras la campaña está encendida, el servidor **rechaza** cualquier cupón: el catálogo ya trae el 40% y un `AMANTI15` encima dejaría la venta en 49% de descuento sin que nadie lo haya decidido (`utils/campana.ts:133-138`, y el rechazo en `server/utils/coupons.ts:56`).

En el momento en que pongas `activa: false`, ese candado se suelta. Los cupones que sigan `active` en Supabase vuelven a funcionar para quien ya los tenga. No se van a *anunciar* —`MOSTRAR_CUPONES` sigue en `false` porque `ANUNCIAR_CUPONES` está apagado desde `utils/campana.ts:124`— pero la caja de cupón reaparece en el carrito (`pages/carrito.vue:351`) y el servidor los honra.

Si no quieres eso, hay que desactivarlos en Supabase antes de apagar la campaña. **Cuáles cupones están vivos hoy no se puede saber leyendo el repo**: viven en la base, y el `create table` de esa tabla tampoco está en `supabase/`.

### ⚠️ Advertencia 2: el feed de Google y la campaña se apagan el MISMO día

El feed toma sus precios del mismo `aplicarCampana()` que la tienda (`server/routes/feeds/google.xml.get.ts:42`). Con la campaña encendida manda dos etiquetas: `g:price` con el precio de **lista** y `g:sale_price` con el **rebajado**, que va al revés de como el sitio guarda las cosas (`server/routes/feeds/google.xml.get.ts:134-149`). Con la campaña apagada manda una sola etiqueta y ningún tachado (`:153-155`).

Hay además una etiqueta opcional, `g:sale_price_effective_date`, que se llena desde la variable `NUXT_PROMO_VIGENCIA` (`server/routes/feeds/google.xml.get.ts:55`, `:150-152`). Vacía, no se manda.

El comentario de `utils/campana.ts:37-41` deja escrito el riesgo exacto: si el feed caduca la promoción el 30 de septiembre y el interruptor del sitio sigue encendido, **Google anuncia el precio de lista mientras el sitio cobra el rebajado**. Eso es discrepancia de precio y Merchant Center suspende por eso. Los dos tienen que apagarse el mismo día, o ninguno.

### Pasos

1. **Antes de tocar el código, revisa `NUXT_PROMO_VIGENCIA` en Vercel.** Si trae un rango con fecha de fin, o la borras, o haces que su fin coincida exactamente con el día en que vas a apagar el interruptor. *(Qué valor tiene hoy no se puede verificar desde el repo.)*
2. En `utils/campana.ts:43`, cambia `activa: true` por `activa: false`.
3. `npm run test:unit`. Debe seguir en verde: los tests están escritos para **seguir** al interruptor, no para clavar su estado — `test/unit/products.test.ts:58-63` comprueba que `onSale()` esté vacío sin campaña y traiga el catálogo completo con ella, y `test/unit/campana.test.ts:147` comprueba que los cupones se acepten si y sólo si no hay campaña.
4. Commit y despliegue.

### Qué revisar después, en orden, para confirmar que no quedó discrepancia

Haz esto **el mismo día**, idealmente en los minutos siguientes al despliegue:

1. Abre `/tienda/<un-slug-cualquiera>` en producción y anota el precio que ves. Debe ser el de lista, sin nada tachado.
2. Abre `/feeds/google.xml?v=1` (el parámetro es para esquivar el CDN) y busca ese mismo slug. Debe traer **un solo** `<g:price>` igual al de la ficha y **ningún** `<g:sale_price>`.
3. Mete ese producto al carrito y llega al resumen. El total tiene que usar ese mismo precio. Esto no es redundante: el precio que se cobra sale de `server/utils/orderItems.ts:21-22`, que es un módulo distinto del que pinta la ficha, y el comentario de `:18-20` explica que si la campaña se aplicara sólo en la vista, el cliente vería 40% menos y Mercado Pago le cobraría completo.
4. Recuerda el caché del feed: `s-maxage=86400` (`server/routes/feeds/google.xml.get.ts:183`). Google puede seguir viendo el XML viejo hasta 24 horas aunque tú ya veas el nuevo. **La ventana en que Google anuncia un precio y la tienda cobra otro es justo ésa.** No hay forma de forzar la revalidación desde el código; si el volumen lo amerita, pide a Google que vuelva a leer el feed desde Merchant Center.
5. En los días siguientes, revisa en Merchant Center los diagnósticos por "discrepancia de precio" sobre los productos afectados. *(Sin verificar desde el repo: no hay acceso a ese panel desde aquí.)*
6. Si en algún punto ves que el feed y la ficha discrepan, la salida rápida es volver a encender el interruptor y desplegar: eso re-alinea los dos lados en un solo cambio.

### Para volver a encenderla

`activa: true` y desplegar. Si quieres cambiar el porcentaje, `descuento: 0.4` es la fracción (`utils/campana.ts:46`) y el texto "40% OFF" se deriva solo de ahí (`CAMPANA_PCT`, `utils/campana.ts:141`), así que no hay que perseguir textos por el sitio.

---

## 7. Cambiar el costo de envío o el umbral de envío gratis

Son **dos cosas distintas** y viven en lugares distintos a propósito.

### (a) El costo — vive en variables de entorno

El monto no está en el código. Sale de `NUXT_ENVIO_COSTO` (`server/utils/costoEnvio.ts:23`). El comentario de `server/utils/costoEnvio.ts:9-11` explica por qué: es una decisión comercial, y cuando la muevan debe bastar con cambiar la variable en Vercel, sin desplegar y sin depender del desarrollador.

Pero son **dos variables que tienen que coincidir**:

| Variable | Quién la lee | Qué hace |
|---|---|---|
| `NUXT_ENVIO_COSTO` | El servidor (`server/utils/costoEnvio.ts:23`) | **Autoritativa**: es lo que se cobra de verdad |
| `NUXT_PUBLIC_ENVIO_COSTO` | El navegador, vía `runtimeConfig.public.envioCosto` (`nuxt.config.ts:121-125`) | Sólo pinta: el resumen del carrito y el mensaje de WhatsApp (`stores/cart.ts:140`) |

`nuxt.config.ts:123-124` lo dice sin rodeos: *"El servidor lee `NUXT_ENVIO_COSTO` (sin PUBLIC) y ESE es el autoritativo: este solo pinta. Los dos deben tener el mismo valor."*

Ninguna de las dos está en `.env.example` (ver receta 0.1).

> ⚠️ **Si las dos no coinciden, el cliente ve un total y paga otro.** El comentario de `stores/cart.ts:136-139` insiste en lo mismo para el mensaje de WhatsApp: ese mensaje y el pedido que guarda `/api/order-whatsapp` son la misma venta, y si uno dice un total y la pantalla de quien surte dice otro, alguien acaba cobrando de menos.

> ⚠️ **Vacío o `0` significa envío gratis para todo el mundo** (`server/utils/costoEnvio.ts:22-25`). Eso es intencional: encender el cobro tiene que ser una decisión explícita. Pero significa que un typo (`"70 "`, `"$70"`, la variable borrada) no da error: regala el envío en cada pedido y no se nota hasta el corte del mes. Por eso `calcularEnvio` está escrito para cobrar ante una entrada inválida del subtotal (`server/utils/costoEnvio.ts:41-43`): equivocarse hacia "gratis" cuesta dinero.

**Pasos:** cambia las dos variables en Vercel al mismo valor entero → **dispara un despliegue nuevo** (`BITACORA.md:867-868`) → verifica.

### (b) El umbral — vive en el código, en dos constantes

| Constante | Archivo | Qué decide |
|---|---|---|
| `UMBRAL_ENVIO_GRATIS = 1000` | `server/utils/costoEnvio.ts:19` | Si de verdad se cobra el envío |
| `FREE_SHIPPING_THRESHOLD = 1000` | `stores/cart.ts:9` | Lo que dice el carrito y cuánto falta para el envío gratis |

**Las dos tienen que cambiar juntas.** `server/utils/costoEnvio.ts:18` lo marca con un comentario ("Igual que en `stores/cart.ts`") y `stores/cart.ts:59-63` explica la consecuencia de que difieran: una compra de $1,200 con cupón de $300 diría "Gratis" en el carrito y Mercado Pago cobraría el envío de todos modos.

Un detalle que hay que respetar al modificar la lógica: **el umbral se mide sobre el subtotal DESPUÉS del descuento**, no sobre el subtotal bruto, en los dos lados (`server/utils/costoEnvio.ts:29-34`, `stores/cart.ts:64-66`). Medirlo antes del cupón regalaría envíos a quien cruce el umbral con un cupón grande sin haber pagado esa cantidad. La comparación es `>=`: con subtotal exactamente igual al umbral, ya es gratis.

Además hay **siete textos con el monto escrito a mano** que hay que perseguir:

- `pages/index.vue:103` — "Envíos Gratis desde $1,000"
- `pages/carrito.vue:282` — igual
- `components/HeroEditorial.vue:67` — "🚚 Gratis desde $1,000"
- `pages/envios.vue:20` — "Envío gratis en compras desde $1,000 MXN"
- `pages/faq.vue:17` — dentro de la respuesta de tiempos de entrega
- `pages/tienda/[slug].vue:464` — "Envío Gratis desde $1,000", en el bloque de beneficios de la ficha
- `pages/tienda/[slug].vue:494` — dentro del texto de la pestaña "Info de Envíos" de la ficha

> ⚠️ **Los dos últimos son los que más se ven.** La ficha de producto es la página que la gente mira justo antes de comprar. Si sólo persigues los cinco primeros, el umbral queda bien en el carrito y mal en la ficha.

Y un test que clava el número: `test/unit/cart.test.ts:65` (`expect(FREE_SHIPPING_THRESHOLD).toBe(1000)`). Actualízalo o truena.

### Cómo verificar

1. `npm run test:unit` — `test/unit/costo-envio.test.ts` y `test/unit/cart.test.ts` cubren el cruce del umbral por los dos lados.
2. En el sitio, arma un carrito **justo debajo** del umbral nuevo: el resumen debe mostrar el costo de envío y sumarlo al total.
3. Sube un peso más para cruzar el umbral: debe decir "Gratis" y el total debe bajar exactamente ese costo.
4. Da "Ordenar por WhatsApp" y lee el mensaje que se genera: el renglón de Envío y el Total deben coincidir con lo que dice la pantalla (`stores/cart.ts:140-148`).
5. Si cambiaste las variables de entorno, repite el punto 2 en **producción** después del despliegue, no sólo en local: el valor autoritativo sólo existe en el servidor de Vercel.
6. Búsqueda de texto por `$1,000` en todo el repo, para confirmar que no quedó ningún renglón con el monto viejo.

---

## 8. Cambiar el número de WhatsApp

Son **dos lugares**, y el segundo es el que la gente olvida.

### Lugar 1: la variable

`NUXT_PUBLIC_WHATSAPP_PHONE`, en Vercel y en tu `.env` local. Formato: `52` + `1` + los 10 dígitos, sin `+` ni espacios ni guiones (`.env.example:4-7`, `SETUP.md:31`). En producción esta variable siempre gana.

### Lugar 2: el respaldo en el código

`nuxt.config.ts:114` trae un número cableado como valor por defecto de `runtimeConfig.public.whatsappPhone`.

**Este respaldo tiene que ser el número bueno también.** El comentario de `nuxt.config.ts:102-113` cuenta la historia y explica el riesgo: hasta el 31 de agosto de 2026 esa línea traía un número viejo; cuando cambió el de AMANTI sólo se actualizó la variable en Vercel y el respaldo se quedó atrás. Nadie lo notaba porque en producción la variable siempre gana (`BITACORA.md:311-317`).

Lo que estaba en juego: si esa variable llegara a faltar —alguien la borra, se crea un entorno nuevo, un despliegue de *preview* sin ella— todos los lugares que arman enlaces de WhatsApp caen a este respaldo **en silencio**, incluido `stores/cart.ts`, que es por donde se piden pedidos. Serían pedidos yéndose al número de un desconocido sin un solo error en ningún lado.

### Quién consume el número

No hay que tocar ninguno de éstos: todos leen `config.public.whatsappPhone`. Son ocho archivos (nueve construcciones de enlace, porque `contacto.vue` arma dos):

`components/BottomNav.vue:5` · `components/ChatWidget.vue:96` · `components/WhatsAppButton.vue:4` · `pages/garantias.vue:4` · `pages/terminos.vue:4` · `pages/contacto.vue:3-4` y `:23` · `pages/tienda/[slug].vue:242` · `stores/cart.ts:131`

### Pasos

1. Cambia `NUXT_PUBLIC_WHATSAPP_PHONE` en Vercel (todos los entornos, no sólo producción).
2. Cambia el respaldo en `nuxt.config.ts:114` **al mismo número**, commit.
3. Despliega. El cambio de variable no entra sin despliegue nuevo (`BITACORA.md:867-868`), y el cambio del respaldo obviamente tampoco.
4. Actualiza también tu `.env` local si vas a probar ahí.

### Cómo verificar

1. En producción, abre la ficha de cualquier producto y da "Pedir por WhatsApp": el enlace `wa.me/...` debe llevar el número nuevo.
2. Repite desde el carrito con productos dentro: ése es el que más importa.
3. Revisa el botón flotante y la barra inferior en móvil.

> **No cambies el número en los tests.** `test/e2e/flujo.spec.ts:44` espera `wa.me/5214431112233` porque Playwright inyecta ese número de mentiras al levantar el servidor (`playwright.config.ts:34`). Es un valor de prueba, no el de producción.

---

## 9. Rotar la URL de un webhook de GoHighLevel (y el secreto de reseñas)

### Cómo está armado

GoHighLevel no da un webhook global: genera una URL de *Inbound Webhook* distinta por cada workflow. Por eso aquí **el evento no viaja como un campo, el evento ES la URL a la que se manda** (`server/utils/ghl.ts:7-11`). Hay cinco, cada uno con su variable (`server/utils/ghl.ts:57-63`):

| Evento | Variable de entorno | A qué dispara |
|---|---|---|
| `compra_confirmada` | `NUXT_GHL_WEBHOOK_POSTCOMPRA` | Postcompra, reseña al día 10, cross-selling al día 21 |
| `carrito_abandonado` | `NUXT_GHL_WEBHOOK_CARRITO_ABANDONADO` | Secuencia de 1h / 24h / 48h |
| `reactivacion` | `NUXT_GHL_WEBHOOK_REACTIVACION` | Reactivación / recompra |
| `pedido_para_surtir` | `NUXT_GHL_WEBHOOK_AVISO_PEDIDO` | Mensaje de WhatsApp a quien surte |
| `pedido_enviado` | `NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` | Aviso al cliente con el número de guía |

Cada evento se enciende y se apaga **por separado**: `ghlConectado()` se pregunta por evento, no de forma global (`server/utils/ghl.ts:76-78`). Se puede tener postcompra conectado y carrito todavía no.

> ⚠️ **Las URLs no se commitean nunca.** Llevan el id de la cuenta de GoHighLevel y quien las tenga puede disparar el workflow —y generar cobro— sin más (`server/utils/ghl.ts:53-56`). Van sólo en `.env` y en las variables de entorno de Vercel. En este documento, en un ticket o en un chat va **el nombre de la variable, nunca el valor**.

> ⚠️ **Cada disparo cuesta dinero.** Estos triggers son premium y GoHighLevel los cobra **por uso** (`server/utils/ghl.ts:12-17`, `.env.example:47-49`). No pruebes a lo bruto: cada intento se paga. Esa misma restricción es la razón de que `carrito_abandonado` lleve un candado que lo limita a una vez por episodio de carrito en vez de las 8-10 que saldrían si se siguiera cada guardado (`server/api/cart-save.post.ts:33-45`).

### Pasos

1. En GoHighLevel, entra al workflow correspondiente y copia la URL nueva del Inbound Webhook.
2. En Vercel, reemplaza **sólo esa** variable. Verifica que estás en el nombre correcto de la tabla de arriba; no hay validación de forma.
3. Actualiza tu `.env` local si vas a probar ahí.
4. **Dispara un despliegue nuevo.** Sin él, la variable no entra (`BITACORA.md:867-868`).

### Cómo verificar (y por qué es más difícil de lo que parece)

La trampa: **si te equivocas de nombre de variable, no hay error.** Regla 1 del módulo: sin URL configurada, `emitirEventoGhl` devuelve `false` y no hace nada (`server/utils/ghl.ts:21-23`, `:91`). El sitio se comporta exactamente igual con GoHighLevel conectado o sin conectar. El evento simplemente deja de llegar, en silencio.

Así que hay que verificar activamente:

1. Dispara **un** evento real y de bajo costo. Para `pedido_enviado`, marcar un pedido como enviado desde `/pedidos` y luego deshacerlo sirve: el aviso sale sólo al marcar, nunca al deshacer (`server/api/pedido-enviado.post.ts:30-37`). Ver receta 10.
2. Confirma del lado de GoHighLevel que el workflow recibió el disparo.
3. Si no llegó, revisa los logs de la función en Vercel. Un fallo real deja rastro:
   - `[ghl] <evento>: GHL respondió <status>` → la URL existe pero GHL rechazó (`server/utils/ghl.ts:101`).
   - `[ghl] <evento>: no se pudo entregar — <mensaje>` → red caída, DNS, o se pasó del timeout de 4 segundos (`server/utils/ghl.ts:105-108`, `:66`).
   - **Silencio total** → la variable no está puesta, o está con otro nombre.
4. No repitas el disparo más de lo necesario. Cada uno se cobra.

### ⚠️ El caso aparte: `NUXT_RESENA_SECRET` NO se rota a la ligera

Esta variable no es una URL de webhook, pero vive en el mismo vecindario y tiene una trampa propia.

`NUXT_RESENA_SECRET` es la llave con la que el servidor **firma** los enlaces de reseña (`server/utils/resenaToken.ts:26-27`, `:39-43`). Esos enlaces viajan dentro del payload de `compra_confirmada`, en los campos `url_resena` y `urls_resena` (`server/utils/ghl.ts:192-199`), y son los que GoHighLevel mete en el correo del día 10.

El mecanismo: el enlace lleva una firma HMAC de (pedido + producto). Al volver, el servidor la recalcula con la misma llave y compara (`server/utils/resenaToken.ts:52-59`). Existe porque hasta el 27 de agosto de 2026 dejar reseña exigía iniciar sesión, y quien compra sin cuenta es la mayoría: sin esto, todos esos clientes llegaban a un "Inicia sesión" y se iban (`server/utils/resenaToken.ts:1-19`).

> ⚠️ **Si rotas ese secreto, todos los enlaces de reseña de los correos YA ENVIADOS dejan de validar.** Las firmas viejas se calcularon con la llave vieja; con la nueva no cuadran y `verificarResena` devuelve `false`. El cliente hace clic, llega a la ficha y se topa con que no puede reseñar. No hay migración ni periodo de gracia en el código. Rótala sólo si tienes motivo de seguridad, y asumiendo que pierdes la cola de correos en vuelo (la secuencia es de 10 días, así que esa cola es de al menos 10 días de compras).

> **Sin llave configurada, la reseña de invitado simplemente no existe** y el sitio se comporta como antes: `firmarResena` devuelve `null` y `urlResena` manda el enlace de siempre sin permiso (`server/utils/resenaToken.ts:21-22`, `:67-71`). Encenderlo es una decisión explícita, igual que el envío y que `/pedidos`.

---

## 10. Usar la pantalla `/pedidos`: marcar enviado, capturar la guía, deshacer

Ésta es la única interfaz de administración que tiene la tienda, y varias recetas mandan aquí sin explicarla.

### Qué es y para quién

`pages/pedidos.vue` es la pantalla de surtido. Está pensada para usarse **desde el teléfono**, para leerse de un vistazo y copiar la dirección de un toque (`pages/pedidos.vue:1-4`). Antes del 27 de agosto de 2026 no existía: los pedidos vivían sólo en la base de datos y nadie del equipo la abre (`server/api/pedidos.get.ts:3-4`).

### Cómo se entra

Con un PIN compartido, que sale de `NUXT_PEDIDOS_PIN` (`server/api/pedidos.get.ts:17`). No es autenticación de verdad y el código lo dice: es «lo mínimo razonable para algo que usa una persona desde su teléfono», y si se filtra se cambia la variable en Vercel (`server/api/pedidos.get.ts:6-11`). El PIN se guarda en el navegador para no teclearlo cada vez (`pages/pedidos.vue:30`, `:39-44`).

> **Sin PIN configurado, `/api/pedidos` responde 404 y la pantalla no abre** (`server/api/pedidos.get.ts:18`; lo mismo en `server/api/pedido-enviado.post.ts:12`). Es deliberado: esta pantalla expone nombre, teléfono y domicilio de clientes, y un descuido de configuración no puede terminar publicándolos. Por la misma razón lleva `noindex, nofollow` en el `<head>` (`pages/pedidos.vue:83-89`).
>
> **De dónde sale el PIN:** de la variable `NUXT_PEDIDOS_PIN` en Vercel. No está en el repo ni puede estarlo. *(Sin verificar desde el repo: qué valor tiene hoy y quién lo conoce.)*

### Qué muestra

Sólo pedidos en estado `paid` y `refunded` (`server/api/pedidos.get.ts:29-33`): lo pendiente no se surte, y mostrarlo invitaría a mandar algo que nadie pagó. Trae los últimos 200, del más nuevo al más viejo.

De cada pedido: fecha, folio corto, monto, los artículos con su cantidad, la dirección en un bloque listo para copiar (`pages/pedidos.vue:51-59`), el correo del cliente **fuera** de ese bloque —porque eso se pega en una guía de envío y ahí no pinta nada (`pages/pedidos.vue:152-157`)— y el aviso de regalo si lo es.

Por defecto oculta los ya enviados; el contador de arriba dice cuántos faltan (`pages/pedidos.vue:46-49`).

### Marcar un pedido como enviado

1. Captura el **número de guía** en el campo del pie. Es opcional (`pages/pedidos.vue:168`).
2. Dale **"Marcar enviado"**.

Eso hace `POST /api/pedido-enviado`, que escribe `shipped_at` y `tracking` en la fila de `orders` (`server/api/pedido-enviado.post.ts:22-26`) y **dispara el evento `pedido_enviado` a GoHighLevel** con los datos del cliente, la guía y la lista de artículos (`:37-55`).

La guía puede ir vacía y eso está contemplado: se manda `null` explícito, no cadena vacía, para que la plantilla del correo pueda elegir entre «ya salió, en cuanto tengamos la guía te la pasamos» y el mensaje con número, sin pintar un hueco (`server/utils/ghl.ts:210-214`, `:231-232`).

### Deshacer

El botón **"Deshacer"** existe porque marcar de más pasa, y sin él habría que entrar a la base a corregirlo (`server/api/pedido-enviado.post.ts:20-21`). Limpia `shipped_at` y `tracking`.

> **Deshacer NO manda ningún aviso.** El disparo está condicionado a `!body.deshacer` (`server/api/pedido-enviado.post.ts:37`), y el comentario de `:30-31` explica por qué: «un "ya va en camino" seguido de nada es peor que no avisar». Esto es justo lo que vuelve a `pedido_enviado` el evento más barato para probar una URL de GoHighLevel recién rotada (receta 9): marcar y deshacer cuesta **un** disparo, no dos.

> ⚠️ **Esta pantalla no toca el estado del pago.** Eso es autoridad exclusiva del webhook de Mercado Pago (`server/api/pedido-enviado.post.ts:4-5`). Si un pedido aparece aquí, ya está pagado; si no aparece, el problema es anterior (receta 11, paso 3).

### Pedidos sin dirección

Un pedido sin dirección no se puede surtir. La API lo marca con la bandera `sinDireccion` (`server/api/pedidos.get.ts:55`) y la tarjeta lo grita en amarillo: "⚠️ Sin dirección de envío. Hay que pedírsela al cliente antes de mandar nada" (`pages/pedidos.vue:139-143`). Se avisa fuerte a propósito, para que no se descubra al momento de empacar.

---

## 11. "Hice un pedido y no llegó el aviso" — qué revisar, en orden

Ésta es la queja más común y casi nunca significa lo mismo. Revisa en este orden y no te saltes pasos.

### Paso 1: ¿de cuál de los tres avisos hablamos?

Son tres, van a destinatarios distintos y se configuran por separado. Confundirlos hace perder horas.

| Aviso | Evento | Variable | Quién lo recibe | Cuándo sale |
|---|---|---|---|---|
| "Entró un pedido, hay que surtirlo" | `pedido_para_surtir` | `NUXT_GHL_WEBHOOK_AVISO_PEDIDO` | Quien surte | Al confirmarse el pago (`server/utils/avisoPedido.ts:77-91`) |
| Comprobante / postcompra | `compra_confirmada` | `NUXT_GHL_WEBHOOK_POSTCOMPRA` | El cliente | Al confirmarse el pago (`server/api/mp-webhook.post.ts:198`) |
| "Tu pedido ya salió" | `pedido_enviado` | `NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` | El cliente | **A mano**, cuando alguien lo marca en `/pedidos` (`server/api/pedido-enviado.post.ts:37-55`) |

El tercero **no se dispara solo**. Si la queja es "compré y nunca me dijeron que ya iba en camino", puede que simplemente nadie haya marcado el pedido como enviado en `/pedidos` (receta 10).

Hay un antecedente que explica por qué los dos primeros se preguntan por separado: el bloque entero colgaba de `ghlConectado('compra_confirmada')`, así que si la URL de postcompra no estaba puesta, el aviso a quien surte **tampoco salía**, aunque su propia URL sí estuviera — y sin ruido en los logs, porque no era un error: simplemente nunca se llamaba (`server/api/mp-webhook.post.ts:150-160`).

### Paso 2: ¿el pedido quedó pagado?

Abre `/pedidos` con el PIN (receta 10). Esa pantalla muestra **sólo** pedidos en estado `paid` y `refunded` (`server/api/pedidos.get.ts:29-33`).

- **Si el pedido aparece** → el pago sí se confirmó. Salta al paso 4.
- **Si no aparece** → el pago nunca se registró. No hay aviso que buscar: el problema está antes. Paso 3.

### Paso 3: si no está pagado — el webhook de Mercado Pago

El registro correcto está documentado en `server/api/mp-webhook.post.ts:10-12`: en el panel de MP, *Tus integraciones → tu app → Webhooks*, URL `https://<dominio>/api/mp-webhook`, suscrito al evento **"Pagos"**, y el secreto copiado a `NUXT_MP_WEBHOOK_SECRET`.

El handler ignora notificaciones a propósito en varios casos. Todos devuelven 200 con un motivo, así que búscalo en los logs de la función:

| Motivo | Qué pasó | Línea |
|---|---|---|
| Firma inválida (401) | El `x-signature` no cuadra con `NUXT_MP_WEBHOOK_SECRET` | `:71`, `:77-79` |
| `no-payment` / `no-payment-id` | No era notificación de pago | `:51-52` |
| `ok: true, noChange: true` | El pago va en `pending` o `in_process`: todavía no se actualiza nada | `:20-28`, `:102` |
| `order-not-found` | El `external_reference` no corresponde a ningún pedido | `:107` |
| `transition-not-allowed` | P. ej. un `rejected` tardío sobre un pedido ya pagado. Nunca revierte un pago confirmado | `:36-40`, `:112-116` |
| `order-has-no-items` | El pedido no tiene renglones; no se marca pagado | `:118-125` |
| `idempotent` | Reintento de MP, o perdió la carrera contra otra entrega simultánea | `:110`, `:136` |

Si `NUXT_MP_ACCESS_TOKEN` falta, el handler responde 400 y **ningún** pago se confirma (`server/api/mp-webhook.post.ts:87`). Y si falta `SUPABASE_SERVICE_ROLE_KEY`, todo pago con Mercado Pago devuelve HTTP 500 (`.env.example:38-41`).

> Un detalle que confunde: `GET /api/mp-webhook` existe pero **no procesa nada** (`server/api/mp-webhook.get.ts:14-18`). Está sólo para que la prueba de conectividad del panel de MP no reciba 404. Que responda `ok` no prueba que las notificaciones reales funcionen: ésas llegan por POST.

### Paso 4: está pagado pero no llegó nada

El aviso se emite en un bloque que **nunca tumba el pedido** y del que no se espera respuesta (`server/api/mp-webhook.post.ts:161-214`, y la regla 2 en `server/utils/ghl.ts:25-29`). Eso es correcto —un correo que no sale se arregla, un pago que no se registra es otro tamaño de problema— pero significa que el fallo es silencioso. Revisa así:

**a. ¿Está puesta la variable de ESE evento?** Sin URL, el emisor devuelve `false` y no imprime nada (`server/utils/ghl.ts:91`). Silencio total en los logs = variable ausente o mal nombrada.

**b. Busca los logs de entrega.** `[ghl] <evento>: GHL respondió <status>` (`server/utils/ghl.ts:101`) o `[ghl] <evento>: no se pudo entregar` (`server/utils/ghl.ts:107`). El timeout es de 4 segundos (`server/utils/ghl.ts:66`), corto a propósito para no bloquear al cliente.

**c. `[mp-webhook] no se pudo avisar a GHL:`** (`server/api/mp-webhook.post.ts:212`) es distinto: significa que falló la lectura de Supabase, no GoHighLevel.

**d. Si el correo llegó pero salió mal.** Si dice "Hola ," o el contacto aparece en GHL sin persona: el nombre y el teléfono salen de `shipping_address` (`server/api/mp-webhook.post.ts:197`, `:201-202`), y el correo sale de la cuenta del usuario o, en compras de invitado, del que la persona tecleó en el carrito (`server/api/mp-webhook.post.ts:177-182`). Un pedido sin dirección no trae ninguno de los tres, y el propio payload lo deja escrito (`server/utils/ghl.ts:178-181`). Ese respaldo del correo de invitado se agregó después de un caso real: alguien pagó, no le llegó nada, y volvió a levantar el mismo pedido dos veces en los dos minutos siguientes — sin acuse, quien ya pagó cree que no pagó, y el siguiente clic es pagar otra vez (`server/api/mp-webhook.post.ts:170-176`).

**e. Si el enlace de reseña del correo del día 10 no funciona.** Los campos `url_resena` y `urls_resena` del payload llevan una firma HMAC (`server/utils/ghl.ts:192-199`). Si alguien rotó `NUXT_RESENA_SECRET`, los enlaces de los correos ya enviados dejan de validar. Ver la advertencia al final de la receta 9.

**f. Si el pedido no trae dirección.** El aviso lo marca explícito con "⚠️ SIN DIRECCIÓN — hay que pedírsela al cliente" (`server/utils/avisoPedido.ts:68`) y `/pedidos` lo marca con la bandera `sinDireccion` (`server/api/pedidos.get.ts:55`). No es un fallo del aviso: el pedido de verdad no se puede surtir.

**g. Del lado de GoHighLevel.** El sitio sólo publica en la URL; el workflow tiene que estar escuchando ese Inbound Webhook y activo. El campo `evento` que va dentro del cuerpo existe **sólo para depurar** (`server/utils/ghl.ts:10`): GHL no lo usa para enrutar, el enrutamiento es la URL.

### Paso 5: ¿fue un pedido por WhatsApp?

Si el cliente ordenó por WhatsApp y no con tarjeta, ese pedido nace en estado `pending` (`server/api/order-whatsapp.post.ts:1-5`) y **no dispara ningún evento de GoHighLevel**: no pasa por el webhook de Mercado Pago. No es una falla, es como está diseñado — la venta se cierra en la conversación. Efecto secundario que hay que tener presente: **ese pedido tampoco sale en `/pedidos`**, porque esa pantalla filtra por `paid` y `refunded`.

### Paso 6: si la queja es sobre carrito abandonado

Por diseño se avisa **una sola vez por episodio de carrito** (`server/api/cart-save.post.ts:33-45`, regla en `server/utils/ghl.ts:138-146`). Si ya existe una fila sin recuperar para ese correo, no se vuelve a avisar: sólo se dispara en la transición de "sin carrito abandonado" a "con carrito abandonado". Y si la tabla `abandoned_carts` no se puede leer, ante la duda **no** se dispara (`server/api/cart-save.post.ts:68-73`), porque equivocarse hacia "mandar de más" aquí significa cobrar de más y molestar al cliente.

---

## Apéndice A: dónde vive cada cosa

| Quiero cambiar… | Toco… |
|---|---|
| Un producto, su precio de lista, su categoría | `data/products.json` (arreglo `products`, desde `:74`) |
| Si un producto está agotado | `"agotado": true` en `data/products.json` |
| Las fotos de un producto | Archivos en `public/products/` + campo `images` (o `node scripts/sync-fotos.mjs`, con la advertencia de la receta 1) |
| Las categorías | `data/products.json:2-73` **y** el conteo en `test/smoke/catalog.test.ts:17-19` |
| Las subcategorías del mega-menú | `composables/useProducts.ts:76-137` **y** los rótulos en `components/SiteHeader.vue:89-119` |
| Un kit | `data/kits.json` |
| Un artículo del blog | `data/articles.json` |
| Las reseñas curadas de un producto | `data/reviews.json` (llave = slug del producto) |
| La campaña del 40% | `utils/campana.ts:43` |
| El banner de temporada y sus fechas | `utils/campana.ts:77-85` |
| Si se anuncian cupones | `utils/campana.ts:124` |
| El umbral de envío gratis | `server/utils/costoEnvio.ts:19` **y** `stores/cart.ts:9` **y** los 7 textos de la receta 7 **y** `test/unit/cart.test.ts:65` |
| El costo de envío | Variables `NUXT_ENVIO_COSTO` y `NUXT_PUBLIC_ENVIO_COSTO` en Vercel |
| El número de WhatsApp | Variable `NUXT_PUBLIC_WHATSAPP_PHONE` **y** el respaldo de `nuxt.config.ts:114` |
| Las URLs de GoHighLevel | Las cinco variables de `server/utils/ghl.ts:57-63`, en Vercel |
| El botón "Pagar con tarjeta" (Stripe) | Variable `NUXT_PUBLIC_STRIPE_ENABLED` (`nuxt.config.ts:119-120`, `pages/carrito.vue:20`, `:430`) |
| El webhook del chat EROS | Variable `NUXT_N8N_CHAT_WEBHOOK`; el default está cableado en `nuxt.config.ts:99` y lo usa `server/api/chat.post.ts:7` |
| La vigencia de la promo en el feed de Google | Variable `NUXT_PROMO_VIGENCIA` |
| El PIN de la pantalla de pedidos | Variable `NUXT_PEDIDOS_PIN` |
| La llave de firma de reseñas de invitado | Variable `NUXT_RESENA_SECRET` (leer la advertencia de la receta 9) |
| El esquema de Supabase | `supabase/*.sql` |
| Las URLs del sitemap | `public/sitemap.xml` (estático, a mano) |
| Redirecciones desde el sitio viejo de Wix | `vercel.json` |

## Apéndice B: todas las variables de entorno

Sólo nombres y dónde se leen. **Ningún valor va nunca en un documento.**

### Del servidor (privadas)

| Variable | Dónde se lee | ¿Está en `.env.example`? |
|---|---|---|
| `NUXT_MP_ACCESS_TOKEN` | `nuxt.config.ts:90`, `server/api/mp-webhook.post.ts:87` | Sí (`:11`) |
| `NUXT_MP_WEBHOOK_SECRET` | `nuxt.config.ts:92` | Sí (`:15`) |
| `NUXT_STRIPE_SECRET_KEY` | `nuxt.config.ts:94` | Sí (`:20`) |
| `NUXT_STRIPE_WEBHOOK_SECRET` | `nuxt.config.ts:96` | Sí (`:24`) |
| `NUXT_N8N_CHAT_WEBHOOK` | `nuxt.config.ts:98-99`, `server/api/chat.post.ts:7` | **No** (tiene default cableado) |
| `SUPABASE_URL` | `nuxt.config.ts:12` (módulo `@nuxtjs/supabase`) | Sí (`:35`) |
| `SUPABASE_KEY` | `nuxt.config.ts:12` | Sí (`:36`) |
| `SUPABASE_SERVICE_ROLE_KEY` | `server/utils/supabaseAdmin.ts` | Sí (`:41`) |
| `NUXT_GHL_WEBHOOK_POSTCOMPRA` | `server/utils/ghl.ts:58` | Sí (`:50`) |
| `NUXT_GHL_WEBHOOK_CARRITO_ABANDONADO` | `server/utils/ghl.ts:59` | Sí (`:51`) |
| `NUXT_GHL_WEBHOOK_REACTIVACION` | `server/utils/ghl.ts:60` | Sí (`:52`) |
| `NUXT_GHL_WEBHOOK_AVISO_PEDIDO` | `server/utils/ghl.ts:61` | Sí (`:54`) |
| `NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` | `server/utils/ghl.ts:62` | Sí (`:56`) |
| `NUXT_ENVIO_COSTO` | `server/utils/costoEnvio.ts:23` | **No** |
| `NUXT_PEDIDOS_PIN` | `server/api/pedidos.get.ts:17`, `server/api/pedido-enviado.post.ts:11` | **No** |
| `NUXT_PROMO_VIGENCIA` | `server/routes/feeds/google.xml.get.ts:55` | **No** |
| `NUXT_RESENA_SECRET` | `server/utils/resenaToken.ts:27` | **No** |

### Del navegador (prefijo `NUXT_PUBLIC_`)

| Variable | Dónde se lee | ¿Está en `.env.example`? |
|---|---|---|
| `NUXT_PUBLIC_WHATSAPP_PHONE` | `nuxt.config.ts:114` | Sí (`:7`) |
| `NUXT_PUBLIC_SITE_URL` | `nuxt.config.ts:116`; también server-side en `server/utils/ghl.ts:165` y `server/api/cart-save.post.ts:83` | Sí (`:32`) |
| `NUXT_PUBLIC_PUBLIC_BASE_URL` | `nuxt.config.ts:118` | Sí (`:31`) |
| `NUXT_PUBLIC_STRIPE_ENABLED` | `nuxt.config.ts:119-120` | Sí (`:27`) |
| `NUXT_PUBLIC_ENVIO_COSTO` | `nuxt.config.ts:121-125` | **No** |

> Todo lo que lleva el prefijo `NUXT_PUBLIC_` **viaja al navegador**. Nunca pongas un secreto ahí. `.env.example:18-19` y `:38` lo dejan escrito para Stripe y para la `service_role`.

### Sólo para tests (nunca en producción)

| Variable | Para qué | Dónde |
|---|---|---|
| `E2E_PORT` | Pisa el puerto 3457 de Playwright | `playwright.config.ts:6` |
| `SB_URL`, `SB_ANON`, `SB_SVC` | Sin ellas se saltan los e2e de cupones, pedidos y cuentas | `test/e2e/coupons.spec.ts:17` y compañía |
| `MP_WEBHOOK_TEST_MODE` | Deja simular pagos en el webhook. **Sólo fuera de producción**: `playwright.config.ts:41-45` fuerza `NODE_ENV=test` justamente porque en Vercel `NODE_ENV=production` deshabilita el bypass aunque la variable existiera | `playwright.config.ts:45` |

## Apéndice C: lo que no se puede verificar desde el repo

Estas cosas hay que confirmarlas entrando a los paneles; no las des por hechas leyendo código:

- **Qué variables de entorno están realmente cargadas en Vercel**, con qué valor y en qué entornos (producción / preview / development). El repo dice qué nombres lee el código, no qué hay puesto.
- **Si el despliegue se dispara solo al hacer push a `master`** o si alguien corre el CLI, y si el panel ofrece promover un despliegue anterior para revertir.
- **El `create table` original de `orders` y de `order_items`**, y el de la tabla de cupones: no están en `supabase/`. El esquema **esperado** de las demás sí vive en el repo (`supabase/all.sql`, `abandoned-carts.sql`, `reviews.sql`, `wishlist.sql`, más los `alter` de `orders-envio.sql`, `orders-gift.sql`, `resenas-invitado.sql` y `addresses-colonia.sql`), pero **si la base de producción coincide con esos archivos tampoco se puede saber leyendo el repo**.
- **Qué cupones están activos en Supabase.**
- **Qué workflows existen en GoHighLevel**, si están activos y qué hacen con el payload.
- **El estado de Merchant Center**: productos aprobados, suspendidos o con discrepancia de precio.
- **Quién conoce el PIN de `/pedidos`** y qué valor tiene hoy.
- **Si `SETUP.md` sigue siendo exacto: no lo es.** Describe un catálogo de 8 productos en 5 categorías (`SETUP.md:88`), afirma que `compareAt` es 0 en todo el catálogo y que no hay rebajas por producto (`SETUP.md:40`), y lista 6 artículos de blog (`SETUP.md:96`). Hoy hay 152 productos en 10 categorías, 14 artículos, y la campaña del 40% llena `compareAt` en todos. **Trata `SETUP.md` como histórico y este manual como vigente.**
