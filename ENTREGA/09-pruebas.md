# Pruebas y calidad

Esta sección explica qué prueba el proyecto, cómo se corre cada suite, cuáles se saltan solas y
—sobre todo— en cuáles **no** se puede confiar. Lo último importa tanto como lo primero: hay
pruebas aquí que pasan aunque el servicio del que dependen esté caído, hay partes del sitio donde
se cobra dinero que no tienen una sola prueba, y hay pruebas que hoy están apagadas y que, el día
que se prendan, van a salir rojas sin que nadie haya roto nada.

Todo lo que sigue sale de leer el repo en `C:\Users\guill\dev\Amanti\Amanti-real`.

---

## 1. De un vistazo

| Suite | Corredor | Archivos | Dónde vive | Necesita servidor |
|---|---|---|---|---|
| Unitarias | Vitest | 24 | `test/unit/` | No |
| Smoke de datos | Vitest | 2 | `test/smoke/` | No |
| End-to-end | Playwright | 23 specs + 1 ayudante | `test/e2e/` | Sí, el build de producción |

La configuración de Vitest (`vitest.config.ts:12`) mete **las dos primeras en la misma corrida**:
`include: ['test/unit/**/*.test.ts', 'test/smoke/**/*.test.ts']`. No hay un comando separado para
el smoke; cuando corres `npm run test:unit` también corre el smoke.

El entorno de Vitest es `happy-dom` (`vitest.config.ts:11`) con `globals: true`, y los alias `~` y
`@` apuntan a la raíz del repo (`vitest.config.ts:8`), que es lo que permite que un test escriba
`import data from '~/data/products.json'`.

**No hay CI.** No existe carpeta `.github/` en el repo: nadie corre esto automáticamente al hacer
push. Las pruebas se corren a mano, en la máquina de quien hace el cambio.

**No hay typecheck ni linter.** Los únicos scripts de `package.json:5-14` son `dev`, `build`,
`generate`, `preview`, `postinstall`, `test`, `test:unit` y `test:e2e`. No hay `lint` ni un
`nuxi typecheck` cableado. Si quieres esa red, hay que ponerla.

### Los otros dos documentos del repo

Esta sección no es lo único escrito. En la raíz hay dos archivos que conviene abrir antes:

- **`BITACORA.md`** (818 líneas) — el registro de qué se hizo, qué se decidió y **por qué**, con
  fechas. Casi todas las trampas de la §6 están ahí con su medición. Es la fuente de la que sale
  buena parte de esta sección.
- **`SETUP.md`** — el arranque local (`SETUP.md:10-23`), la tabla de variables de entorno
  (`SETUP.md:27-41`) y los pasos para activar Stripe (`SETUP.md:44-61`).

⚠️ **`SETUP.md` está parcialmente desactualizado y engaña si lo lees en frío.** Tres puntos
concretos:

1. Dice que el catálogo trae «8 productos AMANTI en 5 categorías» (`SETUP.md:88`). Hoy el smoke
   exige **152 productos y 10 categorías** (`test/smoke/catalog.test.ts:14` y `:18`).
2. Dice «Sin rebajas por producto … `compareAt` = 0 en todo el catálogo» (`SETUP.md:40`). Con la
   campaña encendida, `aplicarCampana` escribe `compareAt` con el precio de lista
   (`utils/campana.ts:175`), así que la UI de rebaja sí está viva.
3. Habla del puerto 3000 (`SETUP.md:15`, `:22`). Las e2e corren en el **3457** (ver §2.6).

Trátalo como referencia de arranque y de Stripe, no como descripción del estado actual.

---

## 2. El entorno y los comandos exactos

### 2.1 El entorno base de un clon nuevo

Antes de cualquier prueba, un clon recién bajado necesita cuatro cosas. Ninguna está automatizada.

**Gestor de paquetes: npm.** En la raíz hay `package-lock.json` con `"lockfileVersion": 3`
(`package-lock.json:3`), y no hay `yarn.lock` ni `pnpm-lock.yaml`. Usa `npm install` (o `npm ci`
si quieres respetar el lock al pie de la letra). Cambiar de gestor te va a mover versiones
transitivas, y aquí eso tiene consecuencias (ver el punto de `@supabase/supabase-js` más abajo).

**Versión de Node: 20.19+ o 22.12+.** `package.json` **no** declara `engines`, así que el piso hay
que sacarlo de las dependencias instaladas:

| Paquete | `engines.node` declarado |
|---|---|
| `nuxt` 3.21.6 | `^20.19.0 \|\| >=22.12.0` |
| `vitest` 4.1.8 | `^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0` |
| `@playwright/test` 1.60.0 | `>=18` |
| `@supabase/supabase-js` 2.108.1 | `>=20.0.0` |

La intersección es **Node 20.19+ o 22.12+**. Node 22 LTS es la apuesta segura. Que no haya
`engines` ni `.nvmrc` en el repo significa que nada te va a avisar si arrancas con un Node viejo:
vas a ver un error de sintaxis o de módulo que no se parece a nada de lo que describe esta sección.
Vale la pena agregar el `engines` como primer commit.

**El `.env`.** `.gitignore:5-7` ignora `.env` y `.env.*` pero deja pasar `.env.example`, así que un
clon nuevo **no trae `.env`**. `SETUP.md:12-16` dice el orden: `npm install`, `cp .env.example .env`,
editar, `npm run dev`. `.env.example` lista los nombres (WhatsApp, Mercado Pago, Stripe, Supabase,
los cinco webhooks de GoHighLevel) con sus explicaciones; los valores hay que pedirlos aparte,
porque por diseño no viven en el repo.

**El navegador de Playwright.** `@playwright/test` es una devDependency (`package.json:25`), pero
el único `postinstall` del proyecto es `nuxt prepare` (`package.json:10`). Es decir: **`npm install`
nunca baja el binario de Chromium.** En un clon nuevo hay que correr, una sola vez:

```bash
npx playwright install chromium
```

Sin eso `npm run test:e2e` truena aunque el build esté perfecto, con un error sobre el ejecutable
del navegador que no tiene nada que ver con el sitio.

### 2.2 ⚠️ Una dependencia que el proyecto usa y no declara

`test/e2e/account-auth.spec.ts:2`, `test/e2e/coupons.spec.ts:2` y `test/e2e/orders.spec.ts:2` hacen:

```ts
import { createClient } from '@supabase/supabase-js'
```

**Ese paquete no está en `package.json`**, ni en `dependencies` ni en `devDependencies`
(`package.json:15-29`), ni en las dependencias de la raíz del lock (`package-lock.json:6-24`). Hoy
resuelve de forma transitiva: `@nuxtjs/supabase` lo pide (`package-lock.json:2774`,
`"@supabase/supabase-js": "^2.106.0"`) y npm lo deja plano en `node_modules` en la versión 2.108.1
(`package-lock.json:5040-5042`).

Funciona por accidente de instalación, no por diseño. El día que `@nuxtjs/supabase` cambie de
versión, lo anide, o alguien instale con otro gestor, esos tres specs **ni siquiera compilan** y el
error va a apuntar a un import que se ve perfectamente normal. Lo correcto es declararlo:

```bash
npm i -D @supabase/supabase-js
```

Es un cambio de una línea y quita una bomba de tiempo.

### 2.3 Unitarias + smoke

```bash
npm run test:unit      # = vitest run
```

Corre en segundos y no necesita nada levantado: no toca red, no toca base de datos, no necesita
build. Es lo primero que deberías correr siempre.

Para un solo archivo o un solo caso —con 26 archivos lo vas a necesitar seguido:

```bash
npx vitest run test/unit/cart.test.ts          # un archivo
npx vitest run -t "umbral de envío gratis"     # por nombre del test o del describe
npx vitest run test/unit/ui-state.test.ts      # el caso de la §6.5
npx vitest                                     # modo watch, sin el "run"
```

Correr `ui-state.test.ts` solo no es un capricho: es el caso de control que distingue una regresión
real de la contención de CPU (§6.5).

### 2.4 End-to-end

**Antes de nada, hay que compilar.** Playwright levanta el servidor con
`command: node .output/server/index.mjs` (`playwright.config.ts:31`). Ese archivo es la salida de
`npm run build`. Si no has compilado, o si compilaste hace tres cambios, la suite e2e corre contra
código viejo o simplemente no arranca.

```bash
npm run build          # genera .output/ — SIN un server de producción levantado (ver §6.4)
npm run test:e2e       # = playwright test
```

Para un solo archivo o una sola prueba:

```bash
npx playwright test test/e2e/carrito-extras.spec.ts
npx playwright test -g "carrito vacío"
```

### 2.5 Todo junto

```bash
npm test               # = vitest run && playwright test  (package.json:11)
```

Ojo: `npm test` **no compila**. El `&&` encadena Vitest y Playwright, nada más. Si el `.output/`
no está al día, esto te da un verde que no significa nada.

### 2.6 El puerto

Playwright escucha en el **3457**, no en el 3000 ni en el 3010. El comentario de
`playwright.config.ts:3-5` explica por qué: en la máquina donde se desarrolló, el 3010 cae dentro
del rango que Windows reserva para Hyper-V/WSL, node truena con `EACCES` antes de escuchar,
Playwright no podía levantar su servidor y **ningún e2e corría**. Se puede pisar con la variable
`E2E_PORT` (`playwright.config.ts:6`).

Este cambio no es cosmético: la bitácora (`BITACORA.md:274-276`) cuenta que al pasar del 3010 al
3457 y volver a correr la suite "salieron dos pruebas rotas que llevaban días tapadas". Una suite
que no arranca se ve igual que una suite que pasa si nadie mira la salida.

### 2.7 Las e2e que tocan Supabase

Tres specs sólo corren si les pasas credenciales por el shell (detalle en §5):

```bash
SB_URL=... SB_ANON=... SB_SVC=... npx playwright test
```

En PowerShell:

```powershell
$env:SB_URL="..."; $env:SB_ANON="..."; $env:SB_SVC="..."; npx playwright test
```

**Antes de correr esto, lee la §5 y la §6.7 completas.** Esas pruebas escriben y borran filas en la
base real a la que apunte `SB_URL`.

### 2.8 Depurar un rojo que no escribiste tú

Esto es lo primero que vas a necesitar cuando heredes una prueba roja, y el repo no te ayuda por
omisión:

**No queda reporte.** El reporter es sólo `list` (`playwright.config.ts:20`): imprime en la
terminal y no deja nada en disco. Si quieres el reporte navegable:

```bash
npx playwright test --reporter=html
npx playwright show-report
```

**Ver la prueba correr.** `headless: true` está fijo en la config (`playwright.config.ts:23`), pero
la línea de comandos gana:

```bash
npx playwright test test/e2e/flujo.spec.ts --headed        # con navegador visible
npx playwright test test/e2e/flujo.spec.ts --debug         # paso a paso, con el inspector
npx playwright test --ui                                   # el modo UI: time-travel, watch, picker
```

`--ui` es con mucho el más rentable para un rojo ajeno: te deja rebobinar el DOM cuadro por cuadro
y ver exactamente qué había en pantalla cuando falló el clic.

**El trace.** `trace: 'off'` (`playwright.config.ts:24`). Préndelo sólo para la corrida que estás
investigando:

```bash
npx playwright test test/e2e/kits.spec.ts --trace on
npx playwright show-trace test-results/<carpeta-del-test>/trace.zip
```

**Dónde caen los artefactos.** La config no fija `outputDir`, así que Playwright usa su valor por
omisión, `test-results/`. Eso lo confirma el `.gitignore:19-21`, que ignora `test-results`,
`playwright-report` y `.playwright` justo bajo el comentario `# test artifacts`.

**Para un intermitente**, dos banderas que valen oro:

```bash
npx playwright test test/e2e/ficha.spec.ts --repeat-each=5   # ¿falla siempre o a veces?
npx playwright test --retries=0                              # ver el rojo real, sin el reintento que lo disfraza de flaky (§6.6)
npx playwright test --workers=1                              # descartar contención entre workers
```

---

## 3. Qué cubre cada grupo

### 3.1 `test/unit/` — la lógica pura

24 archivos. Todos importan funciones puras (nada de Supabase, nada de auto-imports de Nuxt) y
verifican la regla de negocio directamente.

| Archivo | Qué cubre |
|---|---|
| `analytics.test.ts` | Payloads de GA4 y Meta Pixel (`view_item`, `search`, `add_to_cart`, `begin_checkout`, `purchase`) y que sin consentimiento sea un no-op silencioso que nunca lanza |
| `aviso-pedido.test.ts` | El texto del aviso que se le manda a quien surte: dirección en una línea, aviso fuerte si no hay dirección, marca de modo regalo |
| `base-url.test.ts` | `baseParaPasarela`: en Vercel, un `localhost` en la URL base es configuración rota y se sustituye por el dominio público |
| `buscar.test.ts` | `coincideBusqueda` y `textoBuscable`: búsqueda por frase, sin acentos, todas las palabras, sin importar el orden |
| `campana.test.ts` | `bannerVigente` (día de calendario en hora de México), `precioCampana`, `aplicarCampana`, y que el catálogo del navegador y el del servidor coincidan slug por slug |
| `cart.test.ts` | Store del carrito, umbral de envío gratis en $1,000, y `whatsappOrderUrl` |
| `checkout-payer.test.ts` | Qué correo y nombre van al comprador de la preferencia de Mercado Pago |
| `costo-envio.test.ts` | `calcularEnvio`: el umbral se mide sobre lo que el cliente **realmente** paga |
| `coupons.test.ts` | `normalizeCode`, `computeDiscount`, `validateCoupon` (expirado, inactivo, agotado, mínimo) |
| `envio.test.ts` | `normalizarEnvio` y `correoValido`: rechaza direcciones sin calle o sin CP |
| `feed-precio.test.ts` | El feed de Google: `price` de lista, `sale_price` rebajado, y que el `sale_price` sea EXACTAMENTE lo que cobra el sitio |
| `gclid.test.ts` | Captura y persistencia del `gclid` de Google Ads |
| `ghl.test.ts` | GoHighLevel: `ghlConectado` por evento, `emitirEventoGhl` que nunca lanza, `debeAvisarCarrito`, `payloadCompra`, `payloadEnvio` |
| `gtag.test.ts` | `gtagPush` empuja un objeto `arguments` y **nunca** un Array |
| `nombre-resena.test.ts` | Nombre público de una reseña, con tope de 60 caracteres |
| `orders.test.ts` | Resolución autoritativa de precios por slug, rechazo de agotados, `computeTotal`, `buildOrderRows` |
| `personalizacion.test.ts` | `scoreProduct` del quiz |
| `phone.test.ts` | `cleanMxPhone` / `isMxPhone10` |
| `products.test.ts` | Filtros de catálogo, `relatedForArticle` del blog, formato de precio |
| `resena-token.test.ts` | Firma de permiso de reseña: no sirve para otro producto ni para otro pedido |
| `subcategories.test.ts` | Taxonomía, filtrado real por subcategoría, menú dinámico |
| `swipe.test.ts` | `swipeStep` y `stepIndex` de la galería móvil |
| `ui-state.test.ts` | `useCartUI`, `useInstallPrompt`, `useDiscreet` |
| `wishlist.test.ts` | Store de favoritos |

Tres de estos existen porque algo se rompió en producción y costó dinero. Vale la pena leerlos
como documentación:

- **`gtag.test.ts`** existe por el bug del Array. La bitácora lo cuenta
  (`BITACORA.md:403-405`): `test/unit/analytics.test.ts` mockeaba `window.gtag` con un `vi.fn()` y
  verificaba el *payload*, nunca el *vehículo*. `gtag.js` sólo obedece entradas que son un objeto
  `arguments`; con Arrays normales todo se ve bien y no llega nada. `view_item`, `add_to_cart`,
  `begin_checkout`, `purchase` y la conversión de Ads iban al mismo agujero. Se sacó el empujador a
  `utils/gtag.ts` con prueba propia que falla si alguien vuelve a empujar un Array.
- **`buscar.test.ts:20`** se llama literalmente «la regresión que costó la venta». La búsqueda la
  hizo **Nancy, que es quien surte los pedidos**, no una clienta: un cliente le preguntó por
  WhatsApp si había lubricantes de coco, ella buscó «Lubricante coco» en el sitio, la tienda
  devolvió cero y sí había producto (`BITACORA.md:264-267`; el propio test lo nombra así en
  `buscar.test.ts:25`, «la búsqueda exacta que hizo Nancy no puede volver a dar cero»). El costo
  comercial fue doble, porque además al grupo ya se le había dicho que el buscador sí encontraba.
- **`ghl.test.ts:139`** cubre «el candado que evita que nos cobren de más»: `debeAvisarCarrito` no
  puede volver a avisar sobre el mismo carrito abandonado.

### 3.2 `test/smoke/` — integridad del catálogo y de los datos

Dos archivos, y son la red que impide que un typo en un JSON degrade la tienda en silencio.

`test/smoke/catalog.test.ts` valida `data/products.json`:
- 152 productos exactos y 10 categorías exactas (`catalog.test.ts:14`, `:18`)
- slugs únicos y en kebab-case URL-safe, porque van directo a `/tienda/[slug]`
- **cada imagen declarada existe de verdad en `public/`** (`catalog.test.ts:34-43`) — comprueba el
  archivo en disco, no sólo la cadena
- `compareAt` es 0 o mayor que `price`, «si no, el badge rebaja miente»
- todos tienen `emoji` y `bg` (el placeholder sin foto depende de ambos), `rating` entre 1 y 5,
  `brand`, `subtitle`, descripción y al menos una característica

`test/smoke/datos.test.ts` valida la **integridad referencial** entre `data/articles.json`,
`data/kits.json`, `data/reviews.json` y el catálogo. El comentario de cabecera dice el porqué
(`datos.test.ts:7-8`): «un slug con typo aquí no truena el build — el producto simplemente
desaparece del carrusel/kit en silencio».

Un detalle deliberado que conviene respetar: los artículos **no** tienen conteo exacto, sólo
`>= 12` (`datos.test.ts:20`). El comentario explica que la Eroteca crece con el plan editorial y
clavar el número obligaría a tocar el test cada semana sin comprobar nada más. Los productos sí
tienen conteo exacto (152). Si das de alta un producto, `catalog.test.ts:14` se pone rojo y hay
que subir el número a mano — es a propósito, para que nadie meta o borre productos sin enterarse.

### 3.3 `test/e2e/` — el navegador de verdad

23 specs. Suman **78 pruebas**: 62 que corren siempre y 16 que se saltan sin credenciales
(la bitácora registra exactamente esa corrida: 62 verdes, 0 rojos y 16 saltados,
`BITACORA.md:25-28`).

| Spec | Qué cubre |
|---|---|
| `paginas.spec.ts` | 10 páginas clave montan sin error de JS + reset de contraseña, quiz de 4 pasos, PDP inexistente (soft 404) |
| `flujo.spec.ts` | Home → tienda → ficha → carrito, badge, total y botón de WhatsApp |
| `ficha.spec.ts` | Ficha de producto: contenido, galería con lightbox, sin overflow a 390px |
| `busqueda.spec.ts` | Pop de búsqueda en el home: resultados, estado vacío, sin overflow a 390px |
| `busqueda-analytics.spec.ts` | Que la búsqueda llegue al `dataLayer` con término y número de resultados |
| `subcategoria.spec.ts` | Una subcategoría muestra SÓLO sus productos; el menú oculta las vacías |
| `kits.spec.ts` | Listado de kits, añadir un kit mete sus items al carrito, home tiene la sección |
| `carrito-extras.spec.ts` | Carrito vacío, `.freeship`, `.paytrust`, mensaje de envío gratis |
| `regalo.spec.ts` | Modo regalo: campos y persistencia tras recargar |
| `personalizacion.spec.ts` | El quiz alimenta «Elegidos para ti»; la ficha alimenta «Vistos recientemente» |
| `responsive.spec.ts` | Móvil a 393px: burger/drawer, filtros bottom-sheet, CTA de WhatsApp sin recorte |
| `galeria-swipe.spec.ts` | Swipe táctil real vía CDP: navega, sincroniza indicadores, no abre el lightbox, no da la vuelta, y el swipe vertical sigue siendo scroll |
| `hover-foto.spec.ts` | Crossfade a la segunda foto al pasar el mouse |
| `discreto.spec.ts` | Modo discreto: franja visible con salida obvia, difumina lo sensible pero **nunca** la página completa, persiste al recargar |
| `compliance.spec.ts` | Age gate y banner de cookies, y qué garantiza «Rechazar» bajo Consent Mode v2 |
| `blog.spec.ts` | Hub del blog y un artículo: hero, contenido, sin overflow a 390px |
| `pwa.spec.ts` | Manifest, apple-touch-icon, assets 200, y que la barra de instalar no aparezca sin `beforeinstallprompt` |
| `formularios.spec.ts` | Contacto: validación y armado del enlace de WhatsApp |
| `account.spec.ts` | `/cuenta` sin sesión: login, registro, exigencia de Términos, error en español |
| `chat.spec.ts` | Proxy `/api/chat` y widget EROS, incluido abrirlo con `?chat=1` / `#chat` |
| `account-auth.spec.ts` | **(env-gated)** Perfil, CRUD de direcciones, pedidos |
| `orders.spec.ts` | **(env-gated)** Checkout, webhook de Mercado Pago, pedido por WhatsApp |
| `coupons.spec.ts` | **(env-gated)** Validación de cupones y pedido con descuento |

Configuración relevante de `playwright.config.ts`:

- **`timeout: 45_000`** (línea 13, con su comentario en 11-12): la página `/tienda` optimiza 143
  imágenes con `ipx` en el primer load del servidor frío. En producción van por CDN de Vercel, así
  que esto es un costo puramente local.
- **`fullyParallel: false`** (línea 14) y **`workers: 2`** (línea 17, comentario en 15-16): tope de
  2 trabajadores para reducir la contención cuando varios specs golpean `/tienda` en frío. No lo
  subas a la ligera; el comentario dice que así la suite es determinista.
- **`retries: 1`** (línea 19): un reintento, para absorber hipos de los tests que tocan Supabase
  (rate-limit de auth). Ojo con lo que esto esconde: una prueba que falla la primera vez y pasa la
  segunda se reporta como `flaky`, no como roja. Si ves `flaky` en la salida, no lo ignores.
- **Un solo proyecto, `chromium` desktop** (línea 29). La cobertura móvil no viene de un proyecto
  aparte sino de `responsive.spec.ts`, que fija el viewport con `setViewportSize(393)`. La razón
  está escrita (comentario en 26-28): forzar a todos los specs a un layout móvil escondería
  controles (por ejemplo los filtros colapsados) que las pruebas de escritorio necesitan tocar.
- **`trace: 'off'`** (línea 24) y **`reporter: [['list']]`** (línea 20). Para depurar, §2.8.

---

## 4. El ayudante de hidratación

`test/e2e/hidratacion.ts` es un archivo de 14 líneas que vale leer entero antes de escribir
cualquier e2e nuevo.

```ts
export async function esperarHidratacion(page: Page) {
  await expect(page.locator('.eros-launcher')).toHaveCount(1, { timeout: 15_000 })
}
```

La señal de «la app ya montó» es el botón flotante del chat EROS, porque
`components/ChatWidget.vue` lo pinta dentro de `<ClientOnly>` y el widget vive en `app.vue`: sólo
existe en el DOM cuando Vue ya hidrató. Antes de eso los botones que vienen del SSR **ya se ven**,
pero un clic sobre ellos puede caer cuando todavía no tienen handler, y el test falla sin que haya
bug.

Se mide con `toHaveCount` y no con `toBeVisible` porque abrir el chat lo esconde con `v-show`.

**Advertencia de mantenimiento, ya escrita en el archivo (`test/e2e/hidratacion.ts:10-11`):** si
algún día se quita el chat del sitio, esto truena con un timeout sobre `.eros-launcher` en todos
los specs que lo usan. La señal se cambia ahí, en un solo lugar.

---

## 5. Cuáles se saltan y qué necesitan para no saltarse

Tres specs se apagan solos cuando no hay credenciales. La condición es idéntica en los tres:

| Spec | Línea | Pruebas |
|---|---|---|
| `test/e2e/account-auth.spec.ts` | `:14` | 4 |
| `test/e2e/coupons.spec.ts` | `:17` | 7 |
| `test/e2e/orders.spec.ts` | `:14` | 5 |

```ts
test.skip(!SB_URL || !SB_ANON || !SB_SVC, 'requiere SB_URL/SB_ANON/SB_SVC')
```

Las tres variables se leen del shell, **no** de `.env`, y tienen nombres cortos que no coinciden
con los del sitio:

| Variable | Qué es | Dónde se usa |
|---|---|---|
| `SB_URL` | URL del proyecto de Supabase | `account-auth.spec.ts:17`, `coupons.spec.ts:20`, `orders.spec.ts:17` |
| `SB_ANON` | Llave pública (anon) | Sólo se comprueba su presencia en el `test.skip` |
| `SB_SVC` | Llave `service_role` | Crea el cliente admin y se pasa al servidor de pruebas |

⚠️ **Ninguna de estas tres está en `.env.example`.** Ese archivo lista `SUPABASE_URL`,
`SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y las de Mercado Pago, Stripe y GoHighLevel, pero no
`SB_URL` / `SB_ANON` / `SB_SVC`. Son sólo de las pruebas y hay que saberlo de antemano — por eso
queda escrito aquí.

### Lo que `SB_SVC` le hace al servidor de pruebas

`playwright.config.ts:30-46` levanta el servidor con un entorno propio:

| Variable que inyecta | Valor | Para qué |
|---|---|---|
| `PORT` | `3457` (o `E2E_PORT`) | Puerto del servidor de pruebas |
| `NUXT_PUBLIC_WHATSAPP_PHONE` | Un número ficticio | Los tests verifican el enlace `wa.me` contra ese número |
| `SUPABASE_SERVICE_ROLE_KEY` | Toma `SB_SVC` del shell | Sin ella los endpoints de orden responden 500 |
| `NUXT_MP_ACCESS_TOKEN` | Token dummy inválido | Deja pasar el check y ejercita la creación del pedido; la llamada real a Mercado Pago falla con 401 y el pedido queda en `pending` |
| `NODE_ENV` | `test` | **Requisito del bypass del webhook** |
| `MP_WEBHOOK_TEST_MODE` | `1` | Permite simular pagos mandando `__test_secret` |

El diseño del modo de prueba del webhook está bien pensado y conviene entenderlo: el bypass sólo
se activa **fuera de producción**, y por eso se fuerza `NODE_ENV: 'test'` aquí. En Vercel,
`NODE_ENV` vale `production` y el bypass queda deshabilitado aunque la variable
`MP_WEBHOOK_TEST_MODE` llegara a existir (`playwright.config.ts:41-45`). Son dos candados, no uno.

### ⚠️ Qué esquema necesita el Supabase de pruebas (y qué NO trae el repo)

Aquí hay un hueco serio. El repo **sí** trae SQL, en `supabase/` (8 archivos), pero **no alcanza
para levantar un proyecto desde cero**.

Lo que sí está:

| Archivo | Qué crea |
|---|---|
| `supabase/all.sql` | El consolidado: `leads`, `wishlist_items`, `reviews`, `abandoned_carts` (con RLS e índices) + el `add column gift` de `orders` |
| `supabase/wishlist.sql` | `wishlist_items` con sus políticas |
| `supabase/reviews.sql` | `reviews` con sus políticas |
| `supabase/abandoned-carts.sql` | `abandoned_carts` |
| `supabase/orders-gift.sql` | `alter table public.orders add column if not exists gift jsonb` |
| `supabase/orders-envio.sql` | Dos `alter table public.orders` (datos de envío) |
| `supabase/addresses-colonia.sql` | `alter table public.addresses` |
| `supabase/resenas-invitado.sql` | `alter table public.reviews` (user_id nullable, order_id) |

Lo que **no** está en ningún lado del repo: el `create table` de **`orders`**, **`order_items`**,
**`coupons`** y **`addresses`**. Los archivos de arriba dan por hecho que ya existen y sólo les
agregan columnas. Sin el DDL base, esos ALTER no corren y ninguna de las 16 pruebas env-gated
puede pasar.

Lo que las pruebas exigen de cada tabla, sacado de lo que leen y escriben:

| Tabla | Columnas que el código y los tests tocan | De dónde sale |
|---|---|---|
| `orders` | `id` (uuid con default), `user_id` (uuid, **nullable**), `status`, `total`, `currency`, `payment_method`, `mp_payment_id`, `coupon_code`, `discount_amount`, `created_at`, `gift` | `orders.spec.ts:21`, `:57-64`, `:88-93`, `:103`; `coupons.spec.ts:110`; `supabase/orders-gift.sql` |
| `order_items` | `order_id`, `product_slug`, `product_name`, `image_url`, `unit_price`, `quantity`, `line_total` | `server/utils/orderItems.ts:94-104` (`buildOrderRows`), `orders.spec.ts:66-70`, `account-auth.spec.ts:103-105` |
| `coupons` | `code`, `type`, `value`, `min_subtotal`, `active`, `expires_at`, `max_uses`, `used_count` | `coupons.spec.ts:26-34` (la siembra) y la interfaz `CouponRow` en `server/utils/coupons.ts:9-18` |
| `addresses` | Etiqueta, calle, ciudad, estado, CP, colonia, bandera de predeterminada | `account-auth.spec.ts:57-90` (CRUD por UI), `supabase/addresses-colonia.sql` |

Además hace falta que la llave `service_role` pueda crear y borrar usuarios de auth
(`admin.auth.admin.createUser` / `deleteUser`, `account-auth.spec.ts:18` y `:25`).

**Esto es trabajo pendiente y hay que hacerlo antes de poder correr esas 16 pruebas.** La salida
razonable: sacar el DDL real del proyecto de Supabase de producción (o del de pruebas, si existe)
con `supabase db dump`, y meterlo al repo junto a los demás `.sql`. Mientras no exista, un dev
nuevo simplemente no puede crear el entorno de pruebas leyendo el repo.

### Un salto adicional, dentro de `orders.spec.ts`

Dos pruebas se saltan por una razón distinta, que no es de entorno sino de esquema
(`orders.spec.ts:76` y `:139`):

```
'orders.user_id es NOT NULL — corre: ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;'
```

El `beforeAll` (`orders.spec.ts:20-22`) hace una sonda: intenta insertar un pedido con `user_id`
nulo y, si pasa, marca `guestOk = true` y borra la fila. Si la columna sigue siendo `NOT NULL`,
**los pedidos de invitado no funcionan en esa base** y esas dos pruebas se saltan en vez de
ponerse rojas. Si ves esas dos saltadas, no es un problema de la prueba: es que la base necesita
el `ALTER`.

---

## 6. Trampas conocidas

### 6.1 Nada de `networkidle` — y 17 navegaciones que todavía no se normalizan

Es la trampa más importante de este repo y la que más tiempo costó.

`waitUntil: 'networkidle'` espera a que no haya peticiones de red en vuelo. En este sitio **eso
depende de terceros y a veces nunca llega**. El diagnóstico está medido y escrito en
`test/e2e/regalo.spec.ts:35-38`:

> En una corrida quedaron abiertas más de 45 s peticiones a `challenges.cloudflare.com` (en lo
> medido llegan junto con el formulario de GoHighLevel del pie); minutos después la misma página
> llegó a idle en 1 a 13 s.

Es el captcha Turnstile del formulario de GoHighLevel incrustado en el pie de página, atribuido
por frame contra producción (`BITACORA.md:238-240`). El sitio no controla ese iframe, así que el
tiempo hasta «red inactiva» no es una propiedad del sitio: es una propiedad de Cloudflare ese día.

**Ningún spec usa `networkidle` hoy.** La palabra sólo aparece en comentarios, explicando por qué
no se usa.

**El patrón bueno**, el que sigue la mayoría de las navegaciones: `waitUntil: 'domcontentloaded'`
más **una señal real del DOM**, la que corresponda a lo que la prueba va a tocar:

| Señal | Dónde | Por qué esa |
|---|---|---|
| `esperarHidratacion(page)` | Genérica | El launcher de EROS sólo existe ya hidratado |
| `.giftbox` visible | `regalo.spec.ts:40` | Sólo se pinta hidratado y con el carrito restaurado |
| `.emptybox` visible | `carrito-extras.spec.ts:19-20` | Antes se ve «Cargando tu carrito…» (bandera `ready` de `pages/carrito.vue`) |
| `.freeship` visible | `carrito-extras.spec.ts:54-55` | El resumen sólo se pinta ya hidratado |
| Filas de `.carttable tbody tr` | `kits.spec.ts:57-58` | Sólo existen con el carrito restaurado de `localStorage` |
| `localStorage.amanti_recent` contiene el slug | `ficha.spec.ts:22-26`, `personalizacion.spec.ts:56-59` | La ficha escribe esa clave al montarse (`onMounted`): garantiza que la galería ya tiene handlers antes del clic |

Los comentarios registran en cuántas corridas falló cada caso, y son la prueba de que esto no fue
una corazonada: en la ficha «no llegó en 3 de 3 corridas» (`ficha.spec.ts:18`), en `/kits` «falló 2
veces» (`kits.spec.ts:36`), en la subcategoría «no llegó en 2 de 2» (`subcategoria.spec.ts:23`).

⚠️ **Pero el trabajo quedó a medias, y conviene saberlo.** Quedan **17 llamadas a `page.goto()` sin
opciones**, que por lo tanto usan el valor por omisión de Playwright, que es **`'load'`** y no
`domcontentloaded`:

| Spec | Líneas |
|---|---|
| `flujo.spec.ts` | 15, 24, 39, **52** |
| `responsive.spec.ts` | 18, 33, 48, **50** |
| `account.spec.ts` | 13, 32 |
| `account-auth.spec.ts` | 37 |
| `compliance.spec.ts` | 11, 74 |
| `coupons.spec.ts` | 91 |
| `orders.spec.ts` | 35 |
| `formularios.spec.ts` | 15 |
| `paginas.spec.ts` | 49 |

`'load'` espera el evento `load` del frame principal, que incluye sus iframes. Las dos marcadas en
negrita entran a **`/carrito`**, que es justo la página donde se midió el problema del iframe de
GoHighLevel/Cloudflare. Hoy no han fallado, pero están esperando por la razón equivocada. Es deuda
pendiente de normalizar, y esas dos son las primeras de la lista.

Si escribes un e2e nuevo y lo ves intermitente, **no le subas el timeout**: pon
`waitUntil: 'domcontentloaded'` y busca la señal del DOM que de verdad marca el estado que
necesitas.

### 6.2 Hay que marcar el modal de bienvenida como visto, o el overlay se come los clics

`components/WelcomeModal.vue:37-42` abre el modal con un `setTimeout` de **6000 ms** desde que
monta, condicionado a que exista la cookie `amanti_age_ok=1`. Es decir: aparece en medio de la
prueba, no al principio.

El componente marca «ya visto» en **dos** almacenes (`WelcomeModal.vue:12-21`): la cookie
`amanti_welcome_seen` y la clave `amanti_welcome_seen` de `localStorage`. El comentario explica por
qué son dos: los navegadores in-app (WhatsApp, Instagram) y el modo privado suelen borrar
`localStorage` entre visitas, y el modal «seguía pidiendo el correo» aunque ya se hubiera dado.
Con que **uno** de los dos diga `'1'`, el modal no se muestra (`WelcomeModal.vue:33-36`).

Los specs aprovechan eso y ponen sólo el de `localStorage`, con `addInitScript` para que corra
antes de que la página cargue:

```ts
await page.addInitScript(() => localStorage.setItem('amanti_welcome_seen', '1'))
```

Sin esa línea, el overlay abre a los 6 segundos y se traga el clic que caiga después. El error que
da Playwright es `wmodal-wrap subtree intercepts pointer events` (`BITACORA.md:235-237`), y es de
los que parecen bug del sitio y no lo son.

⚠️ **Todo spec nuevo tiene que poner esa marca.** **22 de los 23 specs ya la ponen.** El único que
no la tiene es **`test/e2e/subcategoria.spec.ts`**, cuyo `beforeEach` (líneas 5-10) sólo pone las
cookies de edad y consentimiento. Y no le hace falta por una razón muy concreta que su propio
comentario deja escrita (`subcategoria.spec.ts:13`): «Solo navega y cuenta (sin clicks → no depende
de overlays)». Un modal que tapa la pantalla no molesta a una prueba que nunca hace clic.

**Cuidado con copiar ese spec como plantilla.** Es el más corto y el más tentador para arrancar uno
nuevo; en cuanto le agregues un solo clic vas a toparte con la intercepción sin entender de dónde
salió. Si lo copias, agrégale el `addInitScript`.

`compliance.spec.ts` **sí** pone la marca, pero de otra forma: en la línea 7, **dentro de la
primera prueba**, no en un `beforeEach`. Lo que ese spec omite a propósito son las cookies de edad
y consentimiento, y su comentario de la línea 3 lo dice: «SIN beforeEach de cookies: aquí validamos
los overlays en su estado inicial». Necesita la marca del modal justamente porque esa prueba acepta
el age gate a media corrida —lo cual crea la cookie `amanti_age_ok`— y a los 6 segundos el modal de
bienvenida se abriría encima. Su segunda prueba (`compliance.spec.ts:73-77`) no la pone y tampoco la
necesita: nunca acepta el age gate, así que la condición del `setTimeout` jamás se cumple.

Hay un detalle cosmético que confunde al leer: las cookies se registran con
`url: 'http://localhost:3010'` (por ejemplo `flujo.spec.ts:7-8`) aunque el servidor escuche en el
3457. Es un resto del puerto viejo. Las cookies se ámbitan por dominio (`localhost`) y no por
puerto, así que sigue funcionando; pero si algún día alguien cambia eso a un dominio distinto, se
rompe en silencio.

### 6.3 `reuseExistingServer: true` puede darte un verde sobre código viejo

`playwright.config.ts:48`. Si ya hay algo escuchando en el 3457, Playwright **no levanta nada** y
corre contra ese proceso.

Dos consecuencias, y las dos muerden:

1. **Corres contra el build anterior.** Cambiaste el código, no recompilaste (o recompilaste pero
   el servidor viejo sigue vivo), y la suite pasa verde sobre la versión de antes.
2. **El bloque `env` de `playwright.config.ts:32-46` no se aplica.** Esas variables sólo se
   inyectan cuando Playwright *arranca* el proceso. Si reutilizas un servidor que levantaste a mano
   con `node .output/server/index.mjs`, ese proceso no tiene `SUPABASE_SERVICE_ROLE_KEY`, ni
   `NODE_ENV=test`, ni `MP_WEBHOOK_TEST_MODE`, ni el teléfono de prueba. Resultado: los endpoints
   de pedido responden 500, el bypass del webhook de Mercado Pago no existe, y los tests que
   verifican el enlace de WhatsApp fallan contra el número real.

**Antes de una corrida que importe, baja lo que esté en el 3457 y deja que Playwright levante el
servidor él mismo.**

### 6.4 El build revienta si el servidor de producción está levantado

`npm run build` falla con `EPERM ... unlink libvips-42.dll` cuando hay un
`node .output/server/index.mjs` corriendo, porque ese proceso tiene cargada la DLL de `sharp`
(`BITACORA.md:221-223`). Y lo peor: **el `.output/` queda a medias**, así que la siguiente corrida
de e2e prueba un build corrupto.

Orden correcto: bajar el servidor → `npm run build` → `npm run test:e2e`.

### 6.5 Una corrida de pruebas con un build en paralelo miente

Registrado con caso de control (`BITACORA.md:217-220`): la suite unitaria dio 4 rojos y luego 2,
todos con `Test timed out in 5000ms` en `test/unit/ui-state.test.ts`. Corriendo ese archivo solo,
sin el build compitiendo, pasó los 4 en 5 segundos, y la corrida limpia terminó 261/261.

**No había regresión: había contención de CPU.** Si ves timeouts en `ui-state.test.ts`, lo primero
que hay que preguntarse es qué más está corriendo en la máquina, no qué se rompió. El caso de
control es una línea: `npx vitest run test/unit/ui-state.test.ts` (§2.3).

### 6.6 `retries: 1` convierte rojos en `flaky`

Ya se dijo arriba, pero merece su propio renglón porque es fácil pasarlo por alto en la salida del
reporter `list`. Una prueba marcada `flaky` **falló** y pasó al reintento. Trátala como un rojo
pendiente de diagnóstico, no como un verde. Para verlo sin disfraz: `npx playwright test --retries=0`.

### 6.7 ⚠️ `coupons.spec.ts` borra cupones de la base real

Esta es la más peligrosa del repo. `test/e2e/coupons.spec.ts` ejecuta, con la llave
`service_role` (que se salta RLS), esto **dos veces** — al sembrar y al limpiar
(`coupons.spec.ts:25` y `:38`):

```ts
await admin.from('coupons').delete().like('code', 'QA%')
```

Borra **todo cupón cuyo código empiece con `QA`**, no sólo los que sembró la prueba. Si el negocio
llegara a crear un cupón con un código que empiece así, esta suite lo destruye sin avisar.

Y el `SB_URL` que le pases decide contra qué base corre. **Si apuntas a la base de producción,
esta prueba crea usuarios, crea pedidos, borra cupones y borra pedidos en producción.** Lo mismo
vale para `orders.spec.ts` y `account-auth.spec.ts`, que crean y borran usuarios de auth y filas de
`orders` / `order_items`.

Regla dura: **estas tres pruebas se corren contra un proyecto de Supabase de pruebas, nunca contra
el de producción.**

### 6.8 ⚠️ Las e2e con credenciales tienen precios clavados y la campaña está encendida

Esto no ha explotado todavía porque esas 16 pruebas llevan semanas saltándose, pero va a explotar
en cuanto alguien les pase las credenciales. Lo verifiqué leyendo el código, no corriéndolo.

`utils/campana.ts:42-47` tiene hoy `CAMPANA.activa: true` con `descuento: 0.4`. Y la campaña **se
aplica del lado del servidor, en el mismo lugar del que sale el precio que se cobra**
(`server/utils/orderItems.ts:18-22`):

```ts
const catalog = aplicarCampana((productsData as any).products as any[])
```

Además, `CUPONES_ACEPTADOS = !CAMPANA.activa` (`utils/campana.ts:138`), y `validateCoupon` rechaza
**todos** los cupones mientras la campaña esté encendida, para que no se apilen los descuentos
(`server/utils/coupons.ts:61-67`).

Con la campaña encendida, los precios de lista pasan a: `vibrating-g` 921 → **553**, `denzel`
400 → **240**. Ahora mira lo que esperan esas pruebas:

| Prueba | Qué espera | Qué hace el servidor hoy |
|---|---|---|
| `orders.spec.ts:63` | `o.total` = 2242 | 553×2 + 240 = **1346** |
| `orders.spec.ts:69` | `unit_price: 921` | **553** |
| `orders.spec.ts:80` | Busca el pedido de invitado con `.eq('total', 400)` | El total es **240**: la consulta devuelve 0 filas y `expect(orders.length).toBe(1)` falla |
| `orders.spec.ts:175` | El texto `$ 1,200` (400×3) en «Mis pedidos» | **720** |
| `coupons.spec.ts:55-58` | `valid: true`, `discount: 150` | `valid: false` — la campaña bloquea todos los cupones |
| `coupons.spec.ts:61-65` | `valid: true`, `discount: 100` | `valid: false` |
| `coupons.spec.ts:75-81` | `valid: true`, `discount: 500` al alcanzar el mínimo | `valid: false` |
| `coupons.spec.ts:112-114` | `discount_amount: 50`, `total: 750` | El pedido con cupón se rechaza |

**Son 7 de las 16, no las 16.** Las otras nueve pasan sin problema, y saber cuáles te ahorra
diagnosticar de más:

- `coupons.spec.ts:67` (expirado, inactivo y agotado se rechazan), `:83` (código inexistente) y
  `:123` (cupón inválido al crear pedido → 400) esperan **rechazo**, y con la campaña encendida
  siguen siendo rechazos. Pasan por la razón equivocada, pero pasan.
- `orders.spec.ts:86` (el webhook de Mercado Pago) inserta sus pedidos a mano con la `service_role`
  y nunca pasa por el catálogo, así que la campaña no lo toca.
- Las 4 de `account-auth.spec.ts` siembran los datos a mano igual (`account-auth.spec.ts:100-105`) y
  no dependen de ningún precio del catálogo.

Un matiz: `orders.spec.ts:75` sólo corre si `guestOk` es verdadero. Si la base todavía tiene
`orders.user_id` como `NOT NULL`, esa prueba se salta en lugar de ponerse roja y vas a ver 6 rojas
y 2 más saltadas (§5).

**Por qué esto no es un bug del sitio sino una prueba mal escrita:** existe la forma correcta de
hacerlo y está a la vista en el mismo repo. `test/e2e/flujo.spec.ts:54-58` importa `precioVigente`
de `utils/campana` y calcula el esperado con ella, con el comentario explicando el razonamiento:
clavar 921 o 553 «deja el test rojo en cuanto alguien prenda o apague la venta».

**Las tres salidas, de la peor a la mejor:**

1. **Apagar la campaña** (`utils/campana.ts:43`, `activa: false`) y recompilar. Hace pasar todo hoy
   y no toca una línea de los tests. ⚠️ **Pero ése es el interruptor de producción**: cambia los
   precios de toda la tienda, del feed de Google y del cobro real. Si lo usas para depurar, que sea
   local, y **nunca lo commitees**. La cabecera de `utils/campana.ts:1-15` explica por qué el flag
   vive en el código y no en el entorno: el navegador y el servidor tienen que leer el mismo valor
   o acabas enseñando 40% y cobrando el precio completo.
2. **Inyectar una `CampanaCfg` de prueba.** Todas las funciones de `utils/campana.ts` aceptan la
   configuración como parámetro (`bannerVigente` :107, `precioCampana` :147, `precioVigente` :159,
   `aplicarCampana` :170), y lo mismo pasa en el servidor: `validateCoupon` recibe `aceptados` como
   cuarto parámetro (`server/utils/coupons.ts:56`) y `resolveItems` recibe un `Catalog` como segundo
   (`server/utils/orderItems.ts:54`). Es la salida limpia **para las unitarias** —y de hecho es
   como están escritas—, pero **no sirve para estas e2e**: el spec y el sitio corren en procesos
   distintos, el servidor se levanta ya compilado (`playwright.config.ts:31`) y desde el test no hay
   forma de inyectarle nada.
3. **Calcular el esperado con `precioVigente`**, como `flujo.spec.ts:58`. Es la única que arregla el
   problema de verdad en las e2e, porque deja las pruebas correctas con la campaña encendida y
   apagada. Para las cuatro de cupones hay que decidir aparte: mientras `CUPONES_ACEPTADOS` sea
   false no hay descuento que probar, así que lo honesto es saltarlas explícitamente con un
   `test.skip(!CUPONES_ACEPTADOS, '...')` que diga por qué, en lugar de dejarlas rojas.

**Dónde está anotada esta deuda: en ningún lado más que aquí.** `BITACORA.md:79-80` registra la
*otra* deuda de pruebas (el `pushState` de `busqueda-analytics` y la dependencia de n8n en `chat`),
pero no dice nada de este desalineamiento. La única mención de las variables `SB_*` en toda la
bitácora es `BITACORA.md:28`, y sólo para decir que las 16 saltadas las piden. Si arreglas esto,
anótalo en `BITACORA.md`.

---

## 7. Pruebas en las que hoy NO se puede confiar

El dev nuevo necesita esto con nombre y apellido. Son cinco.

### 7.1 `busqueda-analytics.spec.ts`, cuarta prueba — pasa en falso

`test('cambiar un filtro con la búsqueda puesta no vuelve a mandar el mismo evento')`,
`busqueda-analytics.spec.ts:82-95`.

La prueba navega con:

```ts
await page.evaluate(() => window.history.pushState({}, '', '/tienda?q=lubricante&sort=precio-asc'))
```

Un `history.pushState` llamado a mano **no notifica a vue-router**. El componente nunca reacciona,
nunca re-evalúa la búsqueda, y por tanto nunca podría mandar un segundo evento — ni aunque el bug
que la prueba busca existiera. La aserción `expect(await searches(page)).toHaveLength(1)` se cumple
trivialmente.

Está registrado como deuda conocida en `BITACORA.md:79-80`. Las otras tres pruebas de ese archivo
sí valen: leen el `dataLayer` real y el comentario de cabecera (`busqueda-analytics.spec.ts:8-12`)
explica que se lee el `dataLayer` y no un espía de `window.gtag` precisamente porque ahí es donde
se escondió el bug del Array.

### 7.2 `chat.spec.ts`, «POST con message y sessionId → 200 y response string no vacío» — pasa en falso

`chat.spec.ts:14-22` afirma que la respuesta es un string no vacío. Pero
`server/api/chat.post.ts:29-32` degrada con gracia: si n8n está caído, sin credencial o se pasa del
timeout de 30 s, **devuelve un texto de respaldo** («Justo ahora no puedo responder. Escríbenos por
WhatsApp…») con `degraded: true`.

Ese respaldo es un string no vacío. La prueba pasa igual con el agente vivo que con el agente
muerto. Lo único que detectaría es que la URL del webhook no esté configurada, porque entonces el
handler lanza un 503 (`chat.post.ts:8`).

Para que sirviera de algo tendría que afirmar `expect(json.degraded).toBeFalsy()`.

### 7.3 `chat.spec.ts`, «abre el panel, muestra saludo y responde a un mensaje» — depende de un tercero

`chat.spec.ts:33-74`. Espera dos mensajes del bot con un timeout de 35 segundos. El
`components/ChatWidget.vue` llama a `/api/chat`, que reenvía al agente EROS en n8n. Si n8n tarda,
la prueba tarda; si n8n contesta mal, el widget pinta el texto de respaldo y la prueba **igual**
cuenta dos mensajes del bot, así que también pasa en falso respecto al contenido.

Está registrado en `BITACORA.md:79-80` como deuda: «el del widget en `chat.spec.ts` depende de la
respuesta real de n8n».

⚠️ **Dato importante para el dev nuevo:** el webhook de n8n no es opcional ni está vacío por
omisión. `nuxt.config.ts:99` trae una **URL de n8n en la nube escrita como valor por omisión** en
`runtimeConfig.n8nChatWebhook` (sobrescribible con `NUXT_N8N_CHAT_WEBHOOK`). Eso significa que
correr la suite e2e **manda tráfico real a ese servicio de terceros**, en cada corrida, aunque no
hayas configurado nada. Si eso no es deseable, hay que apuntar esa variable a otro lado antes de
correr.

### 7.4 Las 16 env-gated — verdes por omisión

`account-auth.spec.ts` (4), `coupons.spec.ts` (7) y `orders.spec.ts` (5) se saltan sin credenciales.
Un `npm test` sin `SB_*` termina en verde **sin haber probado nada** del checkout de Mercado Pago,
del webhook de pagos, de los cupones, del alta de pedidos ni del panel de cuenta.

Y cuando sí las corras, hoy 7 de las 16 salen rojas por los precios clavados (§6.8).

### 7.5 ⚠️ Stripe no tiene una sola prueba, y correr las 16 tampoco lo arregla

Esto es lo que más fácil se pasa por alto, porque la §7.4 da la impresión de que las 16 env-gated
son «la parte donde se cobra dinero». No lo son del todo.

El repo tiene dos endpoints de cobro con tarjeta, `server/api/stripe-checkout.post.ts` y
`server/api/stripe-webhook.post.ts`, documentados en `SETUP.md:44-61`. **Ni una sola prueba,
unitaria o e2e, los menciona**: la palabra «stripe» no aparece en ningún archivo de `test/`. Las 16
env-gated cubren Mercado Pago, el pedido por WhatsApp y los cupones; Stripe queda fuera aunque las
corras todas.

Dicho sin rodeos: hoy el cobro con tarjeta se despliega a ciegas. `SETUP.md:50-58` da el
procedimiento manual (modo prueba de Stripe, `stripe listen` hacia el webhook local, tarjeta
`4242 4242 4242 4242`, verificar que el pedido pase a `paid`); mientras no haya pruebas, ése es el
único control que existe y hay que hacerlo a mano en cada cambio que toque esa ruta.

Otros endpoints del servidor sin prueba directa, por si hay que priorizar:

| Endpoint | Estado |
|---|---|
| `server/api/stripe-checkout.post.ts` | Sin cobertura |
| `server/api/stripe-webhook.post.ts` | Sin cobertura |
| `server/api/cart-save.post.ts` | Sin cobertura. Sólo se le menciona en comentarios de `ghl.test.ts:9` y `:148`, que advierten que se llama 8-10 veces por comprador y que por eso existe el candado `debeAvisarCarrito` |
| `server/api/pedido-enviado.post.ts` | Sin cobertura (y es el que hoy no tiene webhook cargado en producción, `BITACORA.md:41-45`) |
| `server/api/resena.post.ts` | Sin cobertura del endpoint. La lógica pura sí está probada en `resena-token.test.ts` y `nombre-resena.test.ts` |
| `server/api/catalog.get.ts` | Sin cobertura |
| `server/api/pedidos.get.ts` | Sin llamada directa. Se ejercita de refilón por la UI de «Mis pedidos» (`account-auth.spec.ts:108`, `orders.spec.ts:172`), que son env-gated |

---

## 8. Orden recomendado antes de publicar un cambio

0. **Sólo en un clon nuevo:** `npm install`, `cp .env.example .env` (y llenarlo), y
   `npx playwright install chromium` (§2.1). Sin lo último, el paso 5 truena sin importar qué tan
   bien esté el código.
1. **`npm run test:unit`.** Segundos, sin dependencias. Si esto no está verde, no sigas.
   - Si ves `Test timed out in 5000ms` en `ui-state.test.ts`, revisa si hay un build u otra cosa
     comiéndose la CPU antes de creerte el rojo (§6.5). El caso de control:
     `npx vitest run test/unit/ui-state.test.ts`.
2. **Si tocaste `data/*.json`,** el smoke ya corrió junto con el paso 1. Si diste de alta o de baja
   un producto, actualiza a mano el conteo de `test/smoke/catalog.test.ts:14` y el de categorías en
   `:18`; es intencional que te obligue.
3. **Baja cualquier servidor de producción que esté corriendo** (§6.4) y también lo que esté en el
   3457 (§6.3).
4. **`npm run build`.** Que termine sin errores; si truena con `EPERM ... libvips-42.dll`, vuelve
   al paso 3 y repite — el `.output/` quedó a medias.
5. **`npm run test:e2e`.** Los 62 que no están gated. Revisa la salida buscando `flaky`, no sólo
   `failed`. Para depurar un rojo, §2.8.
6. **Si tocaste checkout, pagos, pedidos, cupones o el panel de cuenta:** corre además las 16
   env-gated **contra un Supabase de pruebas**, nunca contra producción (§6.7), y con la §6.8
   presente: **7 de esas 16 van a salir rojas hoy por precios clavados** mientras la campaña esté
   encendida. Las 4 de `account-auth` y las tres de rechazo de cupones sí pasan, así que un rojo
   ahí sí es tuyo.
7. **Si tocaste Stripe:** no hay prueba automática que te cubra (§7.5). Toca el procedimiento manual
   de `SETUP.md:50-58`, en modo prueba, verificando que el pedido llegue a `paid`.
8. **Si tocaste precios, la campaña o el feed:** `test/unit/campana.test.ts` y
   `test/unit/feed-precio.test.ts` son los que cuidan que lo que se muestra sea lo que se cobra, y
   que Merchant Center no anuncie un precio que el sitio no respeta. Léelos, no sólo los corras.

Y una regla que no es un comando: **si una prueba nueva sale intermitente, no le subas el timeout.**
Busca la señal real del DOM (§6.1). Todo el trabajo del 10 de septiembre de 2026 consistió en eso,
y el resultado fue pasar de 46 verdes / 7 rojos / 9 intermitentes a 62 verdes / 0 rojos / 0
intermitentes sin arreglar un solo bug del sitio (`BITACORA.md:227-232`).

---

## 9. Lo que no está verificado desde el repo

- **Si alguna de estas suites corre en algún lado que no sea la máquina del desarrollador.** No hay
  `.github/` ni otra configuración de CI en el repo; sin verificar si existe un corredor externo
  (Vercel Checks, algún hook) configurado fuera del código.
- **Qué proyecto de Supabase se ha usado hasta hoy para las e2e con credenciales**, es decir, qué
  valor concreto de `SB_URL` se ha pasado. No está en el repo ni debe estarlo.
- **El esquema real de `orders`, `order_items`, `coupons` y `addresses`.** El repo no trae su
  `create table` (§5), así que las columnas listadas ahí están deducidas de lo que el código escribe
  y lee, no de un DDL. Tipos, defaults, constraints, índices y políticas RLS: sin verificar.
- **Si `orders.user_id` es nullable en la base actual.** La prueba lo detecta en tiempo de
  ejecución con una sonda (`orders.spec.ts:20-22`); desde el repo no se puede saber.
- **Si `npm run build` y `npm run dev` arrancan sin un `.env`.** `nuxt.config.ts:88-127` da un valor
  por omisión a cada clave de `runtimeConfig`, y el módulo `@nuxtjs/supabase` lee `SUPABASE_URL` /
  `SUPABASE_KEY` (comentario en `nuxt.config.ts:8-14`), pero si el build aborta o sólo degrada
  cuando faltan no se puede saber leyendo. Sin verificar: no se corrió el build. La instrucción
  segura es copiar `.env.example` a `.env` antes, como dice `SETUP.md:12-16`.
- **La versión exacta de Node con la que se ha estado trabajando.** El piso (20.19+ / 22.12+) sale
  de los `engines` de las dependencias instaladas, que sí son archivos del repo; la versión concreta
  de la máquina de desarrollo no está declarada en ningún lado del proyecto.
- **Qué variables de entorno están cargadas hoy en Vercel.** Sin verificar desde el repo; la
  bitácora tiene una nota al 15/09/2026 al respecto (`BITACORA.md:41-45`), pero es un registro de
  una revisión manual, no algo comprobable leyendo código.
- **Si las 16 pruebas env-gated fallan hoy tal como predice la §6.8.** El razonamiento sale de leer
  `utils/campana.ts`, `server/utils/orderItems.ts` y `server/utils/coupons.ts` contra lo que
  afirman los specs; **no se corrieron** para confirmarlo. En particular, los precios de lista de
  `vibrating-g` (921) y `denzel` (400) se dedujeron de lo que los propios tests esperan, no de
  abrir `data/products.json`.
- **La última corrida completa registrada** es del 10/09/2026 (62 verdes, 0 rojos, 16 saltados) y
  una parcial del 14/09/2026 (261 unitarias en 26 archivos, 21 e2e de los specs tocados ese día),
  según `BITACORA.md:25-28`. Desde el repo no se puede saber si el estado sigue siendo ese hoy.

---
