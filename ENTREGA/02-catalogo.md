# Catálogo, precios y campaña

Esta sección cubre de dónde salen los productos, cómo se dan de alta, cómo se filtran y se buscan, y —lo más delicado— cómo se calcula el precio que se **muestra** y el que se **cobra**. Si sólo vas a leer una parte, lee ["La campaña"](#6-la-campaña-descuento-global) y la [advertencia final](#7-advertencia-la-campaña-no-se-apaga-sola): ahí está el único punto de este módulo que puede costar dinero real.

Todas las rutas son relativas a la raíz del repo.

---

## Antes de empezar: cómo se corre esto

Es una app **Nuxt 3** (`nuxt ^3.21.2`, `package.json:18`), con Pinia para el carrito y `@nuxtjs/supabase` para cuentas y pedidos. No hay monorepo ni workspaces: `npm install` en la raíz y ya.

Los scripts declarados (`package.json:5-14`) son exactamente cuatro que vas a usar:

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta el servidor de desarrollo (`nuxt dev`). El puerto no está fijado en `nuxt.config.ts`, así que sale el default de Nuxt (3000) — mira lo que imprima la consola |
| `npm run build` | Compila a `.output/` |
| `npm run test:unit` | `vitest run`. Es lo que vas a correr el 95% de las veces |
| `npm run test:e2e` | `playwright test` |
| `npm test` | `vitest run && playwright test`, en serie. Si vitest truena, Playwright ni corre |

**Trampa del e2e:** Playwright **no** levanta `nuxt dev`. Su `webServer.command` es `node .output/server/index.mjs` (`playwright.config.ts:31`), o sea el servidor **ya compilado**. Si no corriste `npm run build` antes, los e2e fallan al arrancar y parece que están rotos. Además:

- El puerto es 3457, pisable con `E2E_PORT` (`playwright.config.ts:6`). El comentario explica por qué no es 3010: en la máquina de Memo ese puerto cae en el rango que reserva Windows (Hyper-V/WSL) y Node truena con `EACCES` antes de escuchar, así que **ningún** e2e corría.
- `reuseExistingServer: true` (`:48`): si ya tienes algo escuchando en ese puerto, Playwright lo usa en vez de levantar el suyo. Cuidado con dejar un servidor viejo corriendo y creer que probaste tu cambio.
- Los tests que tocan pedidos están condicionados a que le pases la llave de servicio de Supabase por el shell como `SB_SVC` (`playwright.config.ts:36-37`). Sin ella esos endpoints responden 500 y esos tests se saltan. **Nunca la escribas en el archivo de configuración.**
- Los navegadores de Playwright se instalan aparte (`npx playwright install`) — sin verificar desde el repo, no hay script que lo haga por ti.

---

## 1. La fuente de verdad: `data/products.json`

No hay CMS, ni base de datos de productos, ni panel de administración. **El catálogo es un archivo JSON versionado en el repo.** Para cambiar el catálogo se edita el archivo, se hace commit y se despliega.

El archivo tiene exactamente dos llaves de primer nivel:

| Llave | Contenido (estado actual del repo) |
|---|---|
| `categories` | 10 categorías |
| `products` | 152 productos |

Las 10 categorías son: `vibradores` (40 productos), `dildos` (30), `bdsm` (19), `masturbadores` (15), `hombre` (11), `parejas` (10), `anal` (8), `retardantes` (8), `arneses` (6), `lubricantes` (5).

Los conteos no son casualidad: `test/smoke/catalog.test.ts:12-19` los clava (`expect(products.length).toBe(152)` y `toBe(10)`). **Si das de alta un producto, ese test truena hasta que actualices el número.** Es a propósito: obliga a que un cambio de catálogo pase por una revisión consciente en vez de colarse en un commit grande.

Ese mismo archivo lo consumen cinco superficies distintas, todas importando el JSON directamente:

| Superficie | Archivo | Para qué |
|---|---|---|
| Toda la web (tienda, ficha, buscador, home) | `composables/useProducts.ts:1` | Render |
| Carrito persistido | `stores/cart.ts:2` | Re-precio del carrito guardado |
| Cobro (el precio autoritativo) | `server/utils/orderItems.ts:5` | Lo que se le cobra a Mercado Pago |
| API pública / agente EROS | `server/api/catalog.get.ts:5` | Recomendaciones del chatbot |
| Feed de Google Merchant | `server/routes/feeds/google.xml.get.ts:18` | Google Shopping |

### El catálogo se resuelve UNA vez, al cargar el módulo

Esto explica por qué "desplegar" aparece en cada instrucción de esta sección. En las cinco superficies, la transformación del catálogo corre en el ámbito del módulo, no por petición:

- `composables/useProducts.ts:40` — `const products = aplicarCampana(data.products as Product[])`
- `stores/cart.ts:25-27`
- `server/utils/orderItems.ts:21`
- `server/api/catalog.get.ts:8`
- `server/routes/feeds/google.xml.get.ts:42`

Consecuencia práctica: **un cambio en `data/products.json` o en `CAMPANA.activa` no entra hasta que hay un build y un deploy nuevos.** No basta reiniciar el proceso en caliente, no hay caché que caduque sola, no hay endpoint de "recargar catálogo". El JSON se compila dentro del bundle. En local, `nuxt dev` sí recarga al guardar el archivo; en producción es build + deploy o nada.

### Campos de un producto

Estos son los campos que trae un producto **en el JSON en disco**. La interfaz de TypeScript vive en `composables/useProducts.ts:4-24`; la del feed, que declara los campos extra, en `server/routes/feeds/google.xml.get.ts:21-38`.

> **Lee esto antes que la tabla.** Los significados de `price` y `compareAt` que siguen valen para el **archivo**. Con la campaña encendida, el catálogo que consume todo el código de UI y de cobro ya viene transformado y **el significado está invertido**: `price` trae el precio rebajado y `compareAt` el de lista (`utils/campana.ts:170-176`). Está explicado a detalle en §6. Si depuras un precio, primero fíjate si estás mirando el JSON o el catálogo ya pasado por `aplicarCampana()`.

| Campo | Tipo | ¿Obligatorio? | Qué es (en el JSON) |
|---|---|---|---|
| `slug` | `string` | Sí | Identificador. Va directo a la URL `/tienda/<slug>` y es la llave con la que el servidor busca el precio. Debe ser kebab-case URL-safe |
| `name` | `string` | Sí | Nombre visible |
| `brand` | `string` | Sí | Marca. `AMANTI Select` es la marca de la casa; el resto son fabricantes (`pages/tienda/index.vue:27-28`) |
| `category` | `string` | Sí | Uno de los 10 slugs de `categories`. Un valor que no exista ahí rompe el smoke |
| `price` | `number` | Sí | **Precio de LISTA en MXN**, antes de campaña |
| `compareAt` | `number` | Sí | Precio "antes" para tachar. Hoy vale `0` en los 152 productos |
| `rating` | `number` | Sí | 1 a 5. Las estrellas se truncan a 5 |
| `emoji` | `string` | Sí | Placeholder cuando no hay foto |
| `bg` | `string` | Sí | Color/gradiente CSS de fondo de la miniatura |
| `subtitle` | `string` | Sí | Frase corta; también es la meta-description de la ficha |
| `badge` | `string` | Sí (está en los 152) | No lo pinta ninguna de las superficies de esta sección. El que se dibuja es `badges` (plural) |
| `hot` | `boolean` | Sí | "Más vendidos". Alimenta el chip 🔥 y `bestsellers()` |
| `featured` | `boolean` | Sí | "Novedades". Alimenta el chip 🆕 y `featured()` |
| `badges` | `string[]` | Sí | Los círculos con ícono de la ficha (`pages/tienda/[slug].vue:399-402`) |
| `description` | `string` | Sí | Texto largo. Se parte en párrafos por `\n\n` (`pages/tienda/[slug].vue:482`) |
| `features` | `string[]` | Sí | Características; se pintan como chips con ícono deducido por palabra clave |
| `images` | `string[]` | En la práctica sí | Rutas absolutas que empiezan con `/products/`. Hoy los 152 tienen al menos una |
| `feedTitle` | `string` | No (149 de 152 lo traen) | Título optimizado para Google. Sustituye a `name` sólo en el feed |
| `feedDescription` | `string` | No | Descripción optimizada para Google |
| `feedId` | `string` | No (1 producto) | Sustituye el `g:id` cuando el slug pasa de 50 caracteres, que es el tope de Google |
| `excludeFromFeed` | `boolean` | No (5 productos) | Saca el producto del feed **sin** quitarlo de la tienda |
| `agotado` | `boolean` | No (**0 productos hoy**) | Se acabó la existencia. Ver §3 |

Las fotos viven en `public/products/` con el patrón `<slug>_<n>.jpg` (por ejemplo `/products/lubricantes-sunny_1.jpg`). La primera imagen del arreglo es la principal; la segunda es la que aparece con crossfade al pasar el mouse en la tarjeta (`components/ProductCard.vue:40-41`); la ficha muestra hasta 4 miniaturas pero el lightbox navega todas (`pages/tienda/[slug].vue:151-156, 374`).

Los cinco productos con `excludeFromFeed: true` son `mister-happy-5-5`, `jock-6`, `parker-vibrador`, `pink-pussycat-honey` y `royal-honey-vip`. **El repo no dice por qué se excluyó cada uno** — sin verificar desde el repo.

---

## 2. Cómo se da de alta un producto

1. **Agrega el objeto** al arreglo `products` de `data/products.json` con todos los campos obligatorios de la tabla de arriba.
2. **Pon las fotos** en `public/products/` con el patrón `<slug>_<n>.jpg` y deja que el script las cablee: `node scripts/sync-fotos.mjs` recorre `public/products/`, empareja por prefijo de slug y **reescribe el campo `images` de cada producto** en `data/products.json` (`scripts/sync-fotos.mjs:1-2, 12-19`). Al terminar imprime cuántos productos quedaron con foto y la lista de los que quedaron sin ninguna. Puedes escribir `images` a mano, pero entonces te toca a ti no equivocarte en el nombre del archivo.
3. **Actualiza el conteo** en `test/smoke/catalog.test.ts:14` (`toBe(152)` → el número nuevo).
4. **Corre `npm run test:unit`** (vitest). El smoke de catálogo valida, producto por producto:
   - slug único y en kebab-case URL-safe (`test/smoke/catalog.test.ts:21-25, 72-75`);
   - `name`, `price > 0` y `category` existente (`:27-32`);
   - **cada imagen declarada existe de verdad en `public/products/`** (`:34-43`) — esto atrapa el typo en el nombre del archivo, que si no se ve como un hueco en la tienda y nadie se entera;
   - las imágenes empiezan con `/products/` (`:77-80`);
   - `compareAt` es 0 o mayor que `price`, porque si no el badge "rebaja" miente (`:52-55`);
   - `emoji` y `bg` presentes (`:57-60`), `rating` entre 1 y 5 (`:62-65`), y `brand`, `subtitle`, `description` y al menos una `feature` (`:67-70`);
   - toda categoría declarada tiene al menos un producto (`:45-48`).
5. Si el producto va a aparecer en un kit, en un artículo del blog o con reseñas curadas, revisa `test/smoke/datos.test.ts`: valida integridad referencial entre `kits.json`, `articles.json`, `reviews.json` y los slugs del catálogo. **Un slug con typo ahí no truena el build: el producto simplemente desaparece del carrusel en silencio** (comentario en `test/smoke/datos.test.ts:7-8`).

No hay paso de "publicar": el despliegue es la publicación. Y recuerda §1 — hasta que no haya deploy, el producto nuevo no existe para nadie.

### Las otras herramientas de catálogo y fotos

Hay tres scripts en `scripts/` que tocan el catálogo y que nadie te va a mencionar si no los lees aquí:

| Script | Qué hace | Cómo se corre |
|---|---|---|
| `scripts/sync-fotos.mjs` | Reescribe `images` de todos los productos a partir de lo que haya en `public/products/`, emparejando por prefijo de slug (`:12-17`) | `node scripts/sync-fotos.mjs` |
| `scripts/match-fotos.py` | Empareja fotos crudas de `fotos_raw/` con productos y las copia a `public/products/`. **Es conservador a propósito: sólo asigna cuando la foto coincide con UN solo producto** (`:1-3`). Normaliza nombres sin acentos ni signos (`:12-17`) y admite dos mapas de rescate: `scripts/alias-fotos.json` para typos de carpeta y `scripts/manual-fotos.json` para identificación visual archivo→slug (`:28-42`). Tope de 5 fotos por producto (`:10`) | `python scripts/match-fotos.py` (seco) o `--apply` para escribir |
| `scripts/gen-inventario.py` | Genera `AMANTI_Inventario_Maestro.xlsx` desde `data/products.json`, con miniaturas de 80×80 embebidas sacadas de `<slug>_1.jpg` (`:1, 24, 30-40`). Es el archivo que se comparte con quien surte | `python scripts/gen-inventario.py` |

Los dos de Python piden dependencias externas (`openpyxl` y `Pillow` en el de inventario, `scripts/gen-inventario.py:5-9`). **No hay `requirements.txt` ni entorno declarado en el repo** — sin verificar desde el repo cuál era el intérprete que se usaba.

**Dar de alta una categoría nueva** es más caro de lo que parece. Además de agregarla a `categories`, hay que darla de alta en la taxonomía de subcategorías (`composables/useProducts.ts:76-137`) y en el mega-menú (`components/SiteHeader.vue:89-119`). Hay precedente documentado: "Lencería" está comentada en el menú porque la categoría no existía en el catálogo y el rótulo mandaba a la tienda completa — "dildos bajo Lencería" (`components/SiteHeader.vue:106-113`).

---

## 3. La bandera de `agotado`

**No hay inventario.** No hay conteo, no hay decremento al vender, no hay sincronización con nadie. Hay una bandera booleana que se prende a mano en `data/products.json` cuando Nancy avisa que se acabó algo (`composables/useProducts.ts:22`, `server/utils/orderItems.ts:27-29`). Para marcar un producto agotado se le agrega `"agotado": true` y se despliega; para reactivarlo se quita la bandera.

**Hoy ningún producto la trae**: el campo no aparece en ninguno de los 152.

La bandera aplica en estos puntos, y cada uno hace algo distinto:

| Superficie | Archivo | Qué hace |
|---|---|---|
| Ficha de producto | `pages/tienda/[slug].vue:444-446` | Cambia el botón por "Agotado por ahora" (deshabilitado) y el de WhatsApp por "Avísame cuando vuelva" |
| Barra de compra fija (móvil) | `pages/tienda/[slug].vue:577-578` | Mismo cambio de botón |
| Acción de agregar de la ficha | `pages/tienda/[slug].vue:249` | `addToCart()` corta en seco (`if (!p || p.agotado) return`). El comentario de `:247-248` dice por qué existiendo ya el cambio de botón: **esa misma función la llama también la barra pegada de abajo** |
| JSON-LD de la ficha | `pages/tienda/[slug].vue:312` | `schema.org/OutOfStock` en vez de `InStock` |
| **Cobro** | `server/utils/orderItems.ts:67-72` | **Rechaza el pedido con HTTP 409** y el mensaje "…se agotó. Quítalo del carrito para continuar." |
| Feed de Google | `server/routes/feeds/google.xml.get.ts:132` | `g:availability = out_of_stock` |
| API pública / EROS | `server/api/catalog.get.ts:31` | `inStock: false` |

(El comentario de `server/api/catalog.get.ts:24-25` habla de "las otras tres superficies" y de "las cuatro": agrupa con otro criterio, contando sólo ficha, feed, `resolveItems` y la propia API. No te confunda; la lista de arriba es la de puntos reales en el código.)

Dos cosas que vale la pena entender del porqué:

**El rechazo vive en el servidor, no sólo en la vista.** El comentario en `server/utils/orderItems.ts:62-66` lo explica: alguien puede traer la página abierta desde antes, tener un carrito guardado en `localStorage`, o entrar por el enlace directo de un anuncio de Google. Si el rechazo viviera nada más escondiendo el botón, esa persona pagaría por algo que no se le puede enviar — y **devolver un cobro cuesta más que perder la venta**.

**La API del chatbot fue la última en respetarla, y es la peor para equivocarse.** El comentario en `server/api/catalog.get.ts:24-30` cuenta que esta superficie se quedó fuera cuando se agregó la bandera el 31-ago-2026: las demás sólo *muestran* algo que ya no hay, pero ésta le dice al agente de chat que lo *recomiende*, o sea que la tienda le ofrece a alguien, en una conversación, algo que no le puede enviar.

> **Trampa conocida 1 — el grid.** La tarjeta del grid (`components/ProductCard.vue`) **no** mira `agotado`: la palabra no aparece en todo el archivo. No pinta ninguna etiqueta y su botón "Añadir 🛍️" (`:12-23, 61`) agrega al carrito sin revisar nada. O sea que un producto agotado sigue siendo agregable desde `/tienda` y desde los carruseles de relacionados.

> **Trampa conocida 2 — el carrito guardado.** `stores/cart.ts` tampoco mira `agotado`: la bandera no aparece en ningún lado del archivo. Lo único que hace con el catálogo es **re-preciar** (`:25-27` y `refreshPrices()` en `:121-126`), y persiste `items` y `gift` en `localStorage` (`:166`). Resultado: alguien que metió el producto al carrito **antes** de que lo marcaras agotado lo sigue viendo, con precio y todo, y sigue sumando al total —incluido el umbral de envío gratis— hasta que le da a pagar y el servidor le contesta 409.

Ninguna de las dos es un agujero de dinero: el cobro sí está tapado. Pero las dos son fricción real de conversión, y la segunda es la peor porque el cliente ya se comprometió mentalmente con la compra. **Si vas a marcar varios productos agotados a la vez, tapa primero la tarjeta del grid y el carrito.**

---

## 4. Categorías, subcategorías y el caso "Oral"

### Cómo funciona la taxonomía

Las **categorías** son datos: viven en `data/products.json` y cada producto pertenece a exactamente una vía su campo `category`.

Las **subcategorías** son *código*: viven en un arreglo en `composables/useProducts.ts:76-137` y no existen en el JSON. Una subcategoría es una regla de filtrado con cuatro campos (`composables/useProducts.ts:48-57`):

- `slug` — el id estable que viaja en la URL como `?sub=…`
- `label` — el rótulo visible, que **debe coincidir exactamente** con el texto del mega-menú en `components/SiteHeader.vue:89-119`, porque el menú resuelve por rótulo (`components/SiteHeader.vue:87`)
- `category` — la categoría (o categorías) a la que pertenece
- `keywords` — opcional (`:56`)

La regla de pertenencia está en `matchesSub()` (`composables/useProducts.ts:68-73`):

1. El producto tiene que estar en alguna de las categorías de la subcategoría.
2. Si la subcategoría **no** tiene `keywords`, entra toda la categoría.
3. Si **sí** tiene, además el producto debe mencionar alguna de esas palabras en `name`, `subtitle` o `features` — comparando sin acentos y en minúsculas (`composables/useProducts.ts:60-61`).

Ojo con un detalle: `matchesSub` **no mira `description`**. El buscador sí (§5). Es una diferencia real y a propósito: las subcategorías quieren precisión de taxonomía y la descripción trae demasiado ruido.

Hay un ejemplo bonito de esa calibración en `composables/useProducts.ts:107-109`: la subcategoría "Succionador De Clítoris" busca la palabra `succionador`, **no** `clitoris`, porque "clítoris" aparece en las `features` de vibradores normales (el comentario nombra "Salvajita Rosa") y los colaba en ese submenú. Lo detectó el QA de julio de 2026.

### El menú es dinámico

Una subcategoría sólo aparece en el mega-menú si tiene al menos un producto (`components/SiteHeader.vue:122-130`, vía `bySubcategory()`). Por eso "Calzón Vibrador" está definida pero no se ve: hoy tiene 0 productos. Eso está fijado en `test/unit/subcategories.test.ts:83-90` y verificado en navegador real en `test/e2e/subcategoria.spec.ts:35-45`.

La consecuencia práctica: **puedes definir subcategorías por adelantado sin ensuciar el menú.** Aparecen solas el día que entre un producto que las cumpla.

### "Oral": la subcategoría que cruza categorías, y por qué su enlace no lleva `?cat=`

`Oral` es la única subcategoría transversal del catálogo (`composables/useProducts.ts:87`):

```ts
{ slug: 'oral', label: 'Oral', category: ['lubricantes', 'parejas'], keywords: ['oral'] }
```

La pidió César el 14-sep-2026 junto con el artículo de intimidad oral (`composables/useProducts.ts:83-86`). El problema que resuelve: los productos que la gente busca como "oral" **están catalogados en dos categorías distintas**. Hoy caen cuatro:

| Producto | slug | `category` |
|---|---|---|
| Lubricantes Sunny | `lubricantes-sunny` | `lubricantes` |
| Antojo Piña Colada | `dickalicious-pina-colada` | `lubricantes` |
| Chispas BJ Bang Sandía | `bj-bang-sandia` | `parejas` |
| Chispas BJ Bang Cereza | `bj-bang-cereza` | `parejas` |

Con `category` como un solo string, esa agrupación **no se podía armar**: o perdías las chispas o perdías los lubricantes. Por eso el campo acepta `string | string[]` (`composables/useProducts.ts:51-55`) y existe el helper `subCats()` que siempre lo normaliza a arreglo (`:64-65`).

**Y por eso su enlace NO puede llevar el parámetro de categoría.** El mecanismo:

- El generador de enlaces del menú tiene un caso especial (`components/SiteHeader.vue:138-140`): si `sub.category` es un arreglo, devuelve `/tienda?sub=oral` **a secas**. Cualquier otra subcategoría con keywords devuelve `/tienda?cat=X&sub=Y` (`:141-142`).
- La tesela "Oral" del home hace lo mismo a mano: `to: '/tienda?sub=oral'` (`pages/index.vue:26`). El comentario de `pages/index.vue:20-23` aclara que "Oral" no es una categoría de `product.category` pero el cliente la quería visible en el mosaico (César, 14-sep-2026), así que se pinta como una tesela más.
- La página de tienda, al recibir `?sub=` sin `?cat=`, intenta derivar la categoría — pero **sólo si la subcategoría vive en una sola** (`pages/tienda/index.vue:35-40`: `typeof subDef?.category === 'string'`). Si es transversal, deja el filtro de categorías vacío a propósito.

La razón dura está en cómo se encadenan los filtros en `pages/tienda/index.vue:60-67`: primero se recorta por categoría (línea 62) y **después** por subcategoría (64-67). Es una intersección. Si el enlace trajera `?cat=lubricantes`, el primer filtro ya habría tirado las dos Chispas BJ Bang antes de que corriera `matchesSub`, y la página de sexo oral enseñaría la mitad de sus productos. Si trajera `?cat=parejas`, pasaría lo contrario.

Hay un tercer lugar donde el mismo cuidado importa: la vitrina de fotos del banner de colección (`pages/tienda/index.vue:151-158`). Ahí la subcategoría **manda sobre** la categoría; sin eso, como "Oral" a propósito no fija `?cat=`, la vitrina caía al "o del catálogo completo" y enseñaba vibradores en la página de sexo oral.

Lo que sostiene todo esto en los tests: `test/unit/subcategories.test.ts:62-80` exige que `bySubcategory('oral')` traiga productos de **más de una** categoría, que incluya nominalmente `bj-bang-sandia`, `bj-bang-cereza` y `lubricantes-sunny`, y que **siga filtrando** (no arrastre completas las dos categorías que cruza).

> **Si agregas otra subcategoría transversal**, basta con poner `category: ['a','b']`: el enlace del menú y la derivación de categoría en `/tienda` ya la tratan bien solas. Lo que **no** se resuelve solo es un enlace escrito a mano en otra página; ahí acuérdate de no ponerle `?cat=`.

---

## 5. El buscador

Toda la lógica de coincidencia vive en un solo archivo, `utils/buscar.ts`, y tiene prueba propia. El comentario de cabecera (`utils/buscar.ts:1-26`) explica por qué, y conviene leerlo entero antes de tocarlo: **la versión anterior le costó una venta a AMANTI y nadie se enteró hasta que se revisaron las grabaciones de sesión.**

La versión vieja hacía un solo `includes()` de la frase completa (`utils/buscar.ts:9-14`). Con eso «coco» encontraba Lubricantes Sunny, pero «Lubricante coco» devolvía **cero**, porque esa frase exacta no aparece junta en ninguna ficha aunque las dos palabras sí estén. El 1-sep-2026 **un cliente** le preguntó a Nancy por WhatsApp si había lubricantes **de chocolate y de coco**; ella buscó en el sitio (`/tienda?q=Lubricante+coco`, sesión grabada a las 13:46), no encontró nada y 45 minutos después mandó nota de voz al grupo diciendo que no estaban. Sí estaban (`utils/buscar.ts:16-19`).

Cómo funciona hoy:

- **`normalizar()`** (`utils/buscar.ts:29-34`): pasa a minúsculas y quita acentos con `NFD` + borrado de diacríticos. Se aplica **de los dos lados** — la consulta y el texto del producto. Es una tienda mexicana y medio catálogo lleva ñ o tilde; quien teclea "pina colada" o "bellami tentacion" desde el celular espera encontrarlo (`:24-26`).
- **`textoBuscable()`** (`utils/buscar.ts:46-54`): concatena `name`, `subtitle`, `brand`, `category` y `description`. Los cinco, a propósito. Antes había **dos** buscadores con campos distintos: el de la tienda miraba `description` pero no `category`, y el desplegable del encabezado —el que más se usa desde el celular— miraba `category` pero no `description`. Como los sabores viven en la descripción, en el desplegable «coco» no encontraba nada ni escribiéndolo solo (`:39-44`).
- **`coincideBusqueda()`** (`utils/buscar.ts:62-70`): parte la consulta en palabras por espacios y exige **todas** (Y lógica, no O). El criterio: quien escribe más palabras está *afinando* la búsqueda, no ampliándola. Una consulta vacía o de puros espacios coincide con **todo** — es el estado "sin filtro", no "sin resultados"; si devolviera cero, la tienda se vería vacía al borrar el texto del buscador.

Las dos superficies consumen el mismo comparador: la tienda (`pages/tienda/index.vue:73`) y el desplegable instantáneo del encabezado, que además exige 2 caracteres mínimo y corta a 6 resultados (`components/SiteHeader.vue:62-71`).

Detalle de analítica que conviene no romper: el evento de búsqueda de GA4 se dispara en `/tienda` (`pages/tienda/index.vue:91-99`) y no en la cabecera, porque **toda** búsqueda escrita acaba en `/tienda?q=` — así también cuenta la que llega por un enlace pegado o al recargar. El caso en que alguien elige un resultado del desplegable sin pasar por `/tienda` se registra aparte (`components/SiteHeader.vue:73-78`).

`test/unit/buscar.test.ts` fija toda la regresión, incluido un test curioso que vale la pena entender antes de borrarlo: **"nadie vende chocolate todavía"** (`:80-87`). No es un bug: chocolate no está en el catálogo. El test truena el día que alguien lo dé de alta, y el comentario dice explícitamente que entonces hay que avisarle a Nancy, que tiene **un cliente** esperándolo desde el 1-sep-2026 (`:81-83`).

---

## 6. La campaña (descuento global)

### Dónde vive el interruptor

`utils/campana.ts:42-47`:

```ts
export const CAMPANA: CampanaCfg = {
  activa: true,                 // ← el interruptor
  nombre: 'AMANTI sin filtros',
  gancho: '40% de descuento en toda la tienda',
  descuento: 0.4,               // fracción: 0.4 = 40%
}
```

Eso es todo. **Para encender: `activa: true` y desplegar. Para apagar: `activa: false` y desplegar.** No hay que tocar el catálogo, ni recalcular precios, ni editar `data/products.json`. Los precios vuelven solos a los de lista y el tachado desaparece (`utils/campana.ts:10-15`). Y sí, hace falta desplegar: ver §1, el catálogo se resuelve al cargar el módulo.

### El descuento se calcula en un solo lugar

Hay exactamente una función que hace la aritmética, `precioCampana()` (`utils/campana.ts:147-150`): multiplica por `1 - descuento` y redondea al peso. Y exactamente una que transforma un catálogo completo, `aplicarCampana()` (`utils/campana.ts:170-176`):

```ts
if (!cfg.activa) return items
return items.map((p) => ({ ...p, price: precioCampana(p.price, cfg), compareAt: p.price }))
```

Fíjate en el intercambio: **`price` baja al precio de venta y `compareAt` guarda el de lista**. Eso es deliberado, porque la tienda ya sabía tachar `compareAt` cuando es mayor que `price` desde antes de que existiera la campaña — esa UI ya estaba en `components/ProductCard.vue:7, 58-59` y en `pages/tienda/[slug].vue:139-141`. La campaña no tuvo que tocar ni un componente: se metió en la capa de datos y toda la UI de "rebaja" se encendió sola.

Dos detalles que importan al mantenerlo:

- Con la campaña apagada devuelve **la misma lista**, sin copiar ni tocar nada (`utils/campana.ts:174`). Es intencional y está fijado en el test con `toBe` de identidad (`test/unit/campana.test.ts:86-89`). Sirve para que apagar la campaña sea literalmente un no-op, no una transformación que pueda tener bugs propios.
- **Nunca muta la lista original** (`test/unit/campana.test.ts:97-101`), porque el mismo JSON importado lo comparten cinco módulos.

Las cinco superficies llaman a esa misma función:

| Superficie | Llamada |
|---|---|
| Web completa | `composables/useProducts.ts:40` |
| Carrito persistido | `stores/cart.ts:25-27` |
| Cobro (autoritativo) | `server/utils/orderItems.ts:21` |
| API pública / EROS | `server/api/catalog.get.ts:8` |
| Feed de Google | `server/routes/feeds/google.xml.get.ts:42` |

Existe además `precioVigente()` (`utils/campana.ts:159-161`), que devuelve el precio que el sitio cobra **hoy** para un precio de lista dado: con la campaña encendida el rebajado, apagada el de lista. Hoy sólo la usan los tests (`test/unit/orders.test.ts:8-9`, `test/e2e/flujo.spec.ts:57`), y es justo para lo que sirve: **una prueba que compara contra un número duro se rompe el día que se apague la campaña; una que usa `precioVigente(921)` no.** Si escribes tests nuevos que toquen precios, úsala.

No la confundas con `precioCampana()`: ésa siempre calcula el descuento, es pura aritmética y **no mira el interruptor** (`utils/campana.ts:155-158`).

### Por qué el flag vive en código y no en variable de entorno

Está escrito en la cabecera del archivo (`utils/campana.ts:3-8`), y es la decisión de diseño más importante del módulo:

> El precio que ve el cliente y el precio que se le cobra TIENEN que salir del mismo cálculo. Si el interruptor viviera en el entorno, el navegador y el servidor podrían leer valores distintos durante un despliegue y acabaríamos enseñando 40% y cobrando el precio completo. Un flag en el código viaja en el mismo bundle para los dos lados: o está encendido en todos, o en ninguno.

Dicho de otro modo: una variable de entorno se puede cambiar sin desplegar, y esa es justamente la propiedad que aquí es peligrosa. Con un flag en código, el bundle del cliente y el del servidor se compilan juntos y **no existe un estado intermedio** en el que uno crea que hay campaña y el otro no.

**No muevas este flag a una variable de entorno.** Si alguien te lo pide para "poder apagarla sin desplegar", el costo de esa comodidad es la posibilidad de mostrar un precio y cobrar otro.

### Por qué el precio que se cobra sale del mismo cálculo que el que se muestra

Ésta es la invariante central del módulo. El comentario de `server/utils/orderItems.ts:2-3` la enuncia: **la fuente de verdad de precios e imágenes es el catálogo del servidor, nunca el precio que mande el cliente.** `resolveItems()` (`server/utils/orderItems.ts:54-86`) ignora `i.price` del carrito y toma el precio autoritativo por slug de `priceBySlug` (`:22`), que es el catálogo ya pasado por `aplicarCampana()`. Un slug desconocido o una cantidad inválida devuelven 400. Eso cierra el agujero de manipulación de precios.

Y por eso `aplicarCampana()` se llama **ahí también**, en el mismo lugar del que sale el precio que se cobra (`server/utils/orderItems.ts:18-21`): si se aplicara sólo en la vista, el cliente vería 40% menos y Mercado Pago le cobraría el precio completo.

Lo que impide que alguien rompa esa paridad sin darse cuenta es un test explícito (`test/unit/campana.test.ts:114-124`): recorre el catálogo del navegador slug por slug y exige que `priceBySlug[slug]` del servidor coincida exactamente. Su comentario lo dice sin rodeos: *"Si alguien agrega la campaña en la vista y olvida el servidor (o al revés), este test truena antes de que un cliente pague de más."* La cabecera del archivo remata: el riesgo que cubren esos tests no es que el banner se vea feo, es que el sitio **enseñe un precio y cobre otro**.

El carrito persistido cierra el mismo hueco por su lado (`stores/cart.ts:23-27, 118-126`): un carrito guardado en `localStorage` hace semanas se re-precia contra el catálogo vigente, para que no muestre un precio obsoleto distinto al que se va a cobrar. (Re-precia, nada más: no revisa `agotado`, ver la trampa 2 de §3.)

### Los pedidos ya creados NO se recalculan

`buildOrderRows()` guarda un **snapshot** de cada línea: `unit_price` y `line_total` se escriben con el número con el que se cobró (`server/utils/orderItems.ts:94-104`). Encender o apagar la campaña después no toca ni una fila de `order_items`.

Es lo correcto y no hay que "arreglarlo" el día del apagado: un pedido de septiembre tiene que seguir diciendo lo que la persona pagó en septiembre. Si alguien te pide "actualizar los pedidos viejos al precio nuevo", es casi seguro un malentendido — pregúntale qué quiere ver antes de tocar nada.

### Qué más se apaga y se enciende con el flag

La campaña arrastra más cosas de las que parece:

| Consecuencia | Dónde | Por qué |
|---|---|---|
| **Los cupones dejan de aceptarse en el servidor** | `utils/campana.ts:138` (`CUPONES_ACEPTADOS = !CAMPANA.activa`), aplicado en `server/utils/coupons.ts:56, 61-67` y en la caja de cupón del carrito (`pages/carrito.vue:351`) | El catálogo ya trae el 40%; un `AMANTI15` encima dejaría la venta en 49% de descuento sin que nadie lo haya decidido |
| **Los cupones dejan de anunciarse** | `utils/campana.ts:131` (`MOSTRAR_CUPONES = ANUNCIAR_CUPONES && !CAMPANA.activa`) | Dos descuentos encimados confunden y se restan entre sí. El cupón **no se borra**: sigue vivo en Supabase y funcionando para quien ya lo tenga (`utils/campana.ts:120-123`) |
| **…pero apagar la campaña NO los vuelve a anunciar** | `ANUNCIAR_CUPONES = false` (`utils/campana.ts:124`) | Es un **segundo interruptor, independiente de la campaña**. Lo puso César el 12-ago: bajar del sitio todo anuncio, banner o comunicación de descuentos hasta que den luz verde al relanzamiento (`:120-123`). Como `MOSTRAR_CUPONES` es la **Y** de los dos, mientras éste siga en `false` el sitio no anuncia `AMANTI15` aunque la campaña se apague |
| Bloque "VENTA ESPECIAL" en el home, antes del hero | `pages/index.vue:86-96` | El cliente lo pidió pegado a la barra de búsqueda (mockup del 25-ago-2026) |
| Banner de temporada (imagen con fecha) | `utils/campana.ts:107-115` | Va atado a `CAMPANA.activa` a propósito: anuncia el mismo 40%, así que no puede quedarse prometiendo un descuento que la tienda ya no da |
| Textos "-40%" en kits y en la pantalla de cuenta | `components/KitCard.vue:42`, `components/account/AccountAuth.vue:104` | Usan `CAMPANA_PCT` (`utils/campana.ts:141`), derivado del mismo `descuento`, para que nunca digan un porcentaje distinto al que se aplica |
| Precio tachado en Google Shopping | `server/routes/feeds/google.xml.get.ts:147-155` | Ver la advertencia |

Los seis lugares que hoy están mudos por `MOSTRAR_CUPONES`, para que sepas qué reaparecería si algún día se prende `ANUNCIAR_CUPONES`: home (`pages/index.vue:111, 121`), hero editorial (`components/HeroEditorial.vue:32`), kits (`components/KitCard.vue:43`), pantalla de cuenta (`components/account/AccountAuth.vue:105`), carrito (`pages/carrito.vue:286`) y ficha de producto (`pages/tienda/[slug].vue:345`).

También hay un patrón de contraste útil en el mismo archivo: **el banner de temporada SÍ caduca solo.** Tiene `desde`/`hasta` como días de calendario en hora de México, ambos inclusive (`utils/campana.ts:60-85`), y `diaMx()` calcula el día con `America/Mexico_City` explícito y **no** con el reloj del servidor, porque en Vercel el reloj está en UTC y entre las 18:00 y la medianoche de México el servidor ya cree que es el día siguiente (`utils/campana.ts:87-104`). Está probado a la medianoche exacta en `test/unit/campana.test.ts:31-70`. Si alguna vez necesitas otra pieza promocional con fecha de corte, **copia este patrón, no el booleano manual.**

(Como dato del estado del repo: `BANNER_TEMPORADA` sigue con `activo: true` pero su ventana era 15 y 16 de septiembre de 2026 (`utils/campana.ts:78-80`), así que ya caducó solo y no se está mostrando. Eso es exactamente lo que tenía que pasar.)

---

## 7. ADVERTENCIA: la campaña no se apaga sola

**Esto es lo más importante de esta sección.**

`CAMPANA.activa` es un booleano manual **sin caducidad**. No hay cron, no hay fecha, no hay alerta. El comentario del código lo dice con todas sus letras (`utils/campana.ts:28-35`):

> **FECHA ACORDADA DE FIN: 30 de septiembre de 2026.** El equipo lo decidió en el grupo el 31-ago-2026. […] NO se apaga solo. Esto es un booleano y alguien tiene que venir a ponerlo en `false`. Si el 1 de octubre nadie lo hace, la tienda sigue regalando el 40% indefinidamente y nada avisa.

Y no es un problema cosmético: como el mismo cálculo alimenta el cobro (`server/utils/orderItems.ts:21-22`), **cada venta después de esa fecha se cobra 40% abajo de lista, de verdad, en Mercado Pago.** No hay ningún reporte ni ninguna alerta que lo señale. La única forma de notarlo es que alguien mire el precio.

### Qué hay que hacer

El 30 de septiembre de 2026 (o la fecha que el equipo acuerde):

1. Poner `activa: false` en `utils/campana.ts:43`.
2. **Desplegar.** No es opcional ni cosmético: el catálogo se resuelve al cargar el módulo (§1), así que sin build y deploy nuevos no cambia nada en producción.
3. Verificar en producción que un producto cualquiera muestre su precio de lista y que `/feeds/google.xml` ya no traiga `<g:sale_price>`.

Qué se acomoda solo al hacerlo: el bloque de venta del home desaparece, el tachado se apaga en la tienda y en el feed, y **los cupones vuelven a ACEPTARSE en el servidor** (`CUPONES_ACEPTADOS`, `utils/campana.ts:138`).

**Anunciarse NO.** Hay un segundo interruptor independiente, `ANUNCIAR_CUPONES` (`utils/campana.ts:124`), hoy en `false` desde el 12-ago-2026 por la petición de César de bajar toda la comunicación de descuentos. Como `MOSTRAR_CUPONES` es la **Y** de los dos (`:131`), apagar la campaña deja el sitio en un estado donde el cupón **funciona pero no se anuncia en ninguna parte**: ni en el home, ni en los kits (`components/KitCard.vue:43`), ni en la cuenta (`components/account/AccountAuth.vue:105`), ni en el carrito, ni en la ficha. Para que los cupones vuelvan a anunciarse hay que **poner `ANUNCIAR_CUPONES` en `true` además de apagar la campaña**, y eso es una decisión de comunicación, no técnica: pregúntala antes.

### Por qué el feed de Google y la campaña se tienen que apagar EL MISMO DÍA

Google Merchant Center compara el precio que anuncia el feed contra el precio real de la página de destino. **Si no coinciden, suspende los productos por discrepancia de precio.** Todo el diseño del feed gira alrededor de eso.

El feed manda dos etiquetas cuando hay campaña (`server/routes/feeds/google.xml.get.ts:147-155`):

- `g:price` = `compareAt` = el precio de **lista**
- `g:sale_price` = `price` = el precio **rebajado**, que es exactamente el que cobra el sitio

Va al revés que el sitio (el sitio guarda el rebajado en `price`), y el porqué está en el comentario de `:134-146`: lo pidió Emilio el 26-ago-2026 porque el feed venía mandando el precio ya rebajado como si fuera el normal, Google no tenía forma de saber que había descuento y el anuncio salía sin tachado.

> **Ese cruce NO está protegido por ningún test.** `test/unit/feed-precio.test.ts` prueba la **regla de decisión** con una **copia local de la lógica** (`etiquetasDePrecio()`, `:26-31`) y lo declara en su propia cabecera: *"Se prueba la REGLA, no el XML"* (`:12`). El archivo **no importa** `server/routes/feeds/google.xml.get.ts`. Si alguien invierte las etiquetas directamente en el handler real (`:147-155`), la suite sigue verde y el feed sale mal. Hoy la única forma de detectarlo es a ojo: `npm run dev` y abrir `/feeds/google.xml`. Si vas a tocar esas líneas, lo correcto es escribir antes un test que importe el handler de verdad.

Ahora, la parte delicada. Google acepta una etiqueta opcional, `sale_price_effective_date`, que le dice cuándo termina la promoción. El código sabe emitirla (`server/routes/feeds/google.xml.get.ts:150-152`), pero **sólo si la variable de entorno `NUXT_PROMO_VIGENCIA` trae un valor**; vacía, no se manda (`:55`). El formato que acepta Google es ISO 8601 con offset, separado por diagonal (`:44-53`).

Y aquí el repo se contradice a sí mismo. Las dos citas son textuales:

| Archivo | Qué dice |
|---|---|
| `utils/campana.ts:37-41` | *"Por eso tampoco se le puso `sale_price_effective_date` al feed de Google: si el feed caducara el 30-sep y este interruptor siguiera encendido, Google anunciaría el precio de lista mientras el sitio cobra el rebajado. […] Los dos tienen que apagarse el mismo día o ninguno."* → **déjala vacía** |
| `server/routes/feeds/google.xml.get.ts:48-54` y `144-146` | *"Se llena desde NUXT_PROMO_VIGENCIA porque la fecha de fin es una decisión de campaña, no de código: cuando César y Emilio la muevan, se cambia la variable en Vercel sin desplegar"* y *"con ella Google sabe cuándo termina y no hay que acordarse de volver a tocar el feed el día que se apague la campaña"* → **está pensada para llenarse** |

**Ojo: los dos archivos dan consejos opuestos, y no hay ninguna decisión escrita en el repo que resuelva el empate.** Un dev que abra el archivo del feed va a leer justo lo contrario de lo que dice el de la campaña. Confírmalo con el equipo antes de tocar esa variable; mientras tanto, el estado de hecho es que la etiqueta sólo sale si la variable tiene valor, y desde el repo no se puede saber si lo tiene.

Los dos escenarios de ruptura, para que queden explícitos:

| Escenario | Qué ve Google | Qué cobra el sitio | Resultado |
|---|---|---|---|
| `NUXT_PROMO_VIGENCIA` con fecha de fin, pero `activa` sigue en `true` después de esa fecha | precio de lista ($835) | rebajado ($501) | Discrepancia → **suspensión** |
| `activa: false` desplegado, pero el feed se sirve de caché viejo | rebajado ($501) | lista ($835) | Discrepancia → **suspensión**, y además clics pagados que llegan a un precio más alto del anunciado |

Sobre el segundo: el feed manda `Cache-Control: public, max-age=3600, s-maxage=86400` (`server/routes/feeds/google.xml.get.ts:183`), o sea hasta **24 horas** de caché de CDN. Si el despliegue de Vercel purga esa caché o no, **no lo puedo verificar desde el repo** — asúmelo como que puede haber hasta un día de desfase y, después de apagar la campaña, **abre `/feeds/google.xml` y confirma con tus ojos que ya no trae `<g:sale_price>` antes de dar el cambio por hecho**.

Y sobre si cambiar `NUXT_PROMO_VIGENCIA` en Vercel surte efecto **sin redeploy**: lo único que el repo prueba es que el valor se lee **una vez, en el ámbito del módulo** (`server/routes/feeds/google.xml.get.ts:55`), no por petición. Es decir, dentro de una instancia ya arrancada nunca cambia. Si Vercel aplica o no una variable nueva a los despliegues existentes es del panel, no del repo: **sin verificar desde el repo**, y el comentario de `:48-51` que afirma "se cambia la variable en Vercel sin desplegar" es una afirmación que el código no respalda por sí solo. Para una operación que puede costar la suspensión de la cuenta, no lo asumas: cambia la variable, **vuelve a desplegar**, y confirma en el XML servido que la etiqueta aparece o desaparece como esperabas.

**Regla operativa:** campaña y feed son un solo interruptor con dos mitades. Si alguien va a llenar `NUXT_PROMO_VIGENCIA`, esa fecha tiene que ser **el mismo día** en que se despliega `activa: false`, ni uno antes ni uno después.

### Cómo mirar el feed antes de que lo mire Google

No hay ninguna prueba —ni unitaria ni e2e— que renderice el XML: `test/` no contiene ninguna referencia a la ruta del feed fuera del comentario de `test/unit/feed-precio.test.ts:20`. **El único control del feed es visual y manual.** Se hace así:

1. `npm run dev`
2. Abrir `http://localhost:<puerto>/feeds/google.xml` (el puerto lo imprime Nuxt al arrancar; por defecto 3000)
3. Revisar en un producto cualquiera: que `<g:price>` sea el de lista y `<g:sale_price>` el rebajado (nunca al revés), que `<g:availability>` diga lo que esperas, y que la etiqueta `<g:sale_price_effective_date>` esté o no esté según lo acordado
4. En producción, lo mismo contra la URL real después de cada deploy que toque precios

Nota: las URLs de `link` e `image_link` se derivan del dominio **desde el que se sirve** el feed (`server/routes/feeds/google.xml.get.ts:15-16, 105-111`), así que en local van a salir con `localhost`. Es correcto; no es un bug.

### Nota menor al apagar

Cuando la campaña se apague, la sección "especial" del home (`pages/index.vue:258`) **no** va a volver a aparecer, aunque su condición sea `!CAMPANA.activa`. La razón es que se alimenta de `onSale()[0]` (`pages/index.vue:19`), y `onSale()` filtra por `compareAt > price` (`composables/useProducts.ts:149`) — pero los 152 productos tienen `compareAt: 0` en el JSON. Sin campaña no hay ningún producto "en rebaja", así que ese bloque queda vacío en los dos estados. Ese acoplamiento está fijado en `test/unit/products.test.ts:58-63`: *"Fuera de campaña ningún producto trae precio 'antes': los descuentos viven en los cupones. Con la campaña encendida, en cambio, TODO está rebajado."* No es un bug que tengas que arreglar el día del apagado; sólo no te sorprendas.

---

## 8. Tests que cubren este módulo

Se corren con `npm run test:unit` (vitest). `npm test` corre eso y, si pasa, Playwright (`package.json:11`).

| Archivo | Qué protege |
|---|---|
| `test/unit/campana.test.ts` | Aritmética del descuento, caducidad del banner por fecha en hora de México, **paridad precio mostrado / precio cobrado** (`:114-124`), y que los cupones no se acepten ni se anuncien durante la campaña (`:147, 151`) |
| `test/unit/orders.test.ts` | Precio autoritativo del servidor (ignora el `price` del cliente), coerción de cantidades, y **el rechazo 409 por agotado**: carrito mixto, nombre del producto en el mensaje y catálogo sin la bandera (`:46-80`). Es el **único** test que ejercita ese rechazo |
| `test/unit/feed-precio.test.ts` | La **regla de decisión** de `g:price` / `g:sale_price`, con una copia local de la lógica (`:26-31`). **No ejercita el handler del feed** — ver la advertencia de §7 |
| `test/unit/buscar.test.ts` | La regresión que costó una venta: frases de varias palabras, acentos, consulta vacía, campos mirados |
| `test/unit/subcategories.test.ts` | Taxonomía consistente, filtrado real (no "toda la categoría"), transversal "Oral", menú dinámico |
| `test/unit/products.test.ts` | Filtros del composable, relacionados del blog, formato de precio, acoplamiento `onSale` ↔ campaña |
| `test/smoke/catalog.test.ts` | Integridad del JSON: conteos, slugs, imágenes que existen en disco, invariantes que la UI asume |
| `test/smoke/datos.test.ts` | Integridad referencial con `kits.json`, `articles.json` y `reviews.json` |
| `test/e2e/subcategoria.spec.ts` | En navegador real: la subcategoría filtra de verdad y el menú oculta las vacías |

**Lo que NO cubre ningún test:** el XML del feed (sólo la regla, en copia), la inversión de etiquetas hecha directamente en el handler, y que `ProductCard` y el carrito respeten `agotado` (no lo respetan, §3).

---

## 9. Lo que no se puede verificar desde el repo

- **Si la campaña está encendida en producción ahora mismo.** El repo dice `activa: true` (`utils/campana.ts:43`), pero no puedo confirmar qué commit está desplegado en Vercel.
- **Si `NUXT_PROMO_VIGENCIA` tiene valor en el panel de Vercel.** El código la lee de `process.env` en el ámbito del módulo (`server/routes/feeds/google.xml.get.ts:55`); el valor hay que abrirlo en Vercel y mirarlo.
- **Si cambiar esa variable en Vercel surte efecto sin volver a desplegar.** El comentario de `:48-51` lo afirma; el código no lo demuestra. Trátalo como que sí hace falta desplegar hasta que alguien lo compruebe contra el XML servido.
- **Cuál de los dos comentarios sobre `sale_price_effective_date` refleja la decisión vigente** (`utils/campana.ts:37-41` vs. `server/routes/feeds/google.xml.get.ts:48-54, 144-146`). Se contradicen y el repo no resuelve el empate.
- **El estado de la cuenta de Merchant Center**: si hay productos suspendidos, avisos de discrepancia de precio o de disponibilidad.
- **Si el 30-sep-2026 sigue siendo la fecha acordada.** Lo único que hay es la cita de la conversación en el comentario del 31-ago-2026 (`utils/campana.ts:28-31`); puede haberse movido después sin que nadie tocara el código.
- **Si ya hay luz verde para volver a anunciar cupones** (`ANUNCIAR_CUPONES`, `utils/campana.ts:124`). El comentario dice "hasta que den luz verde al relanzamiento"; si la dieron, no está escrito en el repo.
- **Si el despliegue de Vercel purga la caché de CDN del feed** (`s-maxage=86400`).
- **Por qué está excluido del feed cada uno de los cinco productos con `excludeFromFeed`.** El campo está documentado, los motivos caso por caso no.
- **Quién avisa cuando se agota un producto y por qué canal.** Los comentarios nombran a "Nancy" (`composables/useProducts.ts:22`, `server/utils/orderItems.ts:28-29`) pero no hay proceso escrito en el repo.
- **Con qué intérprete y dependencias se corrían los scripts de Python** (`scripts/match-fotos.py`, `scripts/gen-inventario.py`). No hay `requirements.txt` ni entorno declarado.
- **Si `npx playwright install` hace falta en una máquina limpia.** No hay script de setup que lo cubra en `package.json`.
