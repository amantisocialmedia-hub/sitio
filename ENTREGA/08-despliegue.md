# Despliegue y reversa

Esta sección cubre qué accesos hacen falta antes de poder tocar nada, cómo se arranca el proyecto en local, qué variables tienen que existir para que producción no se caiga, cómo sale el sitio a producción, cómo comprobar que un despliegue quedó bien, cómo echarlo para atrás cuando no, y las trampas del build y de las pruebas que ya costaron tiempo y están documentadas en la bitácora del proyecto.

## 1. El mapa en una pantalla

| Cosa | Valor | De dónde sale |
|---|---|---|
| Repositorio | `git@github.com:memorx/amanti-store.git` | `.git/config:9` (remote `origin`) |
| Rama de trabajo | `master` (no `main`) | `.git/config:11-13` |
| Proyecto en Vercel | `amanti-store-cake` | `BITACORA.md:4` |
| Producción | `https://amanti.mx` | `BITACORA.md:4`, `nuxt.config.ts:116` |
| Dominio alterno | `amanti-store-cake.vercel.app` | comentario en `server/routes/feeds/google.xml.get.ts:16` |
| CI propio | **No hay.** No existe carpeta `.github/` en el repo | verificado por búsqueda de archivos |
| Config de build en el repo | `vercel.json` **sólo trae `redirects`** (149 reglas). No hay `builds`, ni `framework`, ni `outputDirectory`, ni `installCommand` | `vercel.json` (única llave del objeto: `redirects`) |

La consecuencia de esa última fila es importante: **no hay nada en el repo que le diga a Vercel cómo construir el sitio**. Todo eso (framework detectado, comando de build, versión de Node, variables de entorno) vive en el panel de Vercel. Nuxt/Nitro se detecta solo y genera el preset de Vercel sin configuración extra; así está documentado desde el arranque del proyecto en `SETUP.md:79`.

`nuxt.config.ts` tampoco define un bloque `nitro`: no hay preset forzado ni `routeRules` (búsqueda de `routeRules` en todo el repo: cero resultados). El único punto donde el código se entera de que está corriendo en Vercel es la variable de entorno `VERCEL`, que la propia plataforma inyecta (`nuxt.config.ts:18` y `server/utils/baseUrl.ts:33`).

### Qué son esos 149 redirects

`vercel.json` es, casi en su totalidad, la migración de URLs del sitio viejo de Wix. Son dos grupos:

- **140 reglas `/product-page/<slug-viejo>` → `/tienda/<slug-nuevo>`**, todas con `statusCode: 301`. A veces el slug coincide (`vercel.json:4-7`, `sun-ring` → `sun-ring`) y a veces no (`vercel.json:8-11`, `convex-stimulus-3pz` → `trio-sensaciones`).
- **9 reglas de `/category/…`, mapeadas A MANO.** Seis van a `/tienda?cat=<categoría nueva>` y **el nombre de la categoría nueva NO se deriva del slug viejo**: `/category/exploración` → `?cat=dildos`, `/category/el-cuarto` → `?cat=bdsm`, `/category/estimuladores-1` → `?cat=vibradores`, `/category/bottle-500ml` → `?cat=parejas`, `/category/bottle350ml` → `?cat=vibradores`, `/category/wellnes` → `?cat=lubricantes` (`vercel.json:704-747`). Las otras tres van a `/tienda` **sin query**: `/category/all-products`, `/category/exploracion` (sin acento) y `/category/tienda`. Cada destino se decidió uno por uno; **no hay regla que los genere**.

Todo esto es SEO heredado: cada línea es un enlace que Google todavía tiene indexado o que alguien tiene guardado. **No las borres para "limpiar" el archivo, y sobre todo no intentes "regenerarlas" con un script** — el mapeo de categorías no es mecánico y un script lo destruiría en silencio. Se editan a mano y sólo entran en vigor con un despliegue nuevo, porque las resuelve el edge de Vercel a partir de este archivo, no el servidor de Nuxt.

> ⚠️ **Los redirects no se pueden probar en local, de ninguna forma.** Una búsqueda de `vercel.json` en todo el repo (fuera de `node_modules`) no devuelve un solo resultado: ningún código del proyecto lee ese archivo. Ni `npm run dev` ni `node .output/server/index.mjs` aplican una sola de esas 149 reglas. Sólo existen cuando el archivo está desplegado en Vercel. El procedimiento para probarlo antes de producción está en la sección 7.3.

## 2. Antes que nada: los accesos

Éste es el primer bloqueante real de la transferencia, y no se resuelve con el repo en la mano. Los comandos que aparecen más abajo (`vercel link`, `vercel env ls production`, `vercel ls`) y hasta el `git push` no sirven de nada sin cuenta con permisos en cada sistema. La lista de lo que hay que pedir, y de dónde sale la evidencia de que ese sistema existe:

| Acceso | Para qué | Evidencia en el repo |
|---|---|---|
| Cuenta con permiso de escritura en el repo `memorx/amanti-store` (GitHub) | Pushear; sin esto no hay despliegue posible, porque el despliegue se dispara con el push | `.git/config:8-13` |
| Cuenta en el proyecto de Vercel `amanti-store-cake` | `vercel link`, `vercel env ls`, ver/promover despliegues, editar variables | `BITACORA.md:4`, `BITACORA.md:602-603` |
| Proyecto de Supabase | Base de datos de cuentas y pedidos; correr los `.sql` de `supabase/` | `.env.example:34-41` |
| Cuenta de MercadoPago | Token de cobro y secreto del webhook | `.env.example:9-15`, `SETUP.md:32-33` |
| Cuenta de Stripe (si se usa) | Llave secreta y secreto del webhook | `.env.example:17-24`, `SETUP.md:44-58` |
| Cuenta de GoHighLevel | Las URLs de los webhooks de marketing | `.env.example:43-56` |
| Registrador / DNS del dominio `amanti.mx` | Apuntar el dominio, certificado, alias de producción | `nuxt.config.ts:116`, `public/robots.txt:8` |
| Cuenta de n8n donde vive el agente EROS | El chat del sitio pega contra un webhook de n8n | `nuxt.config.ts:97-99`, `server/api/chat.post.ts:7` |

**Sin verificar desde el repo:** quién es hoy el dueño de cada una de esas cuentas, si el proyecto de Vercel está bajo una cuenta personal o una organización, y si el repo pertenece a un usuario o a una organización de GitHub. Eso se pregunta y se transfiere en los paneles; no hay forma de leerlo aquí.

## 3. Arranque local desde cero

Está en `SETUP.md:12-16` y son tres comandos:

```bash
npm install
cp .env.example .env      # luego edita .env
npm run dev               # http://localhost:3000
```

Y el build de producción local (`SETUP.md:20-23`):

```bash
npm run build
node .output/server/index.mjs   # corre el build (puerto 3000)
```

> ⚠️ **`.env.example` trae un número de WhatsApp FICTICIO.** `.env.example:7` pone `NUXT_PUBLIC_WHATSAPP_PHONE=5214430000000`, y el propio archivo lo advierte en las líneas 5-6: *"OBLIGATORIA: el valor de abajo es un PLACEHOLDER ficticio — cambialo por el numero real antes de publicar o los enlaces de WhatsApp iran a un numero inexistente."* Si copias `.env.example` a `.env` y no lo tocas, todos los enlaces de pedido de tu entorno local apuntan a un número que no existe.

## 4. Las variables sin las cuales producción se cae

Esto es el mínimo obligatorio. No es la lista completa de variables (ver el aviso al final de la sección 9), es la lista de las que, si faltan, **rompen algo grave y muchas veces en silencio**.

| Variable | Qué pasa si falta | Dónde está documentado |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | **TODO pago con MercadoPago devuelve HTTP 500.** La usan checkout, el webhook de MP y la creación de pedidos | `.env.example:38-41`, `SETUP.md:38` |
| `SUPABASE_URL` y `SUPABASE_KEY` (anon) | No hay cuentas ni pedidos | `SETUP.md:36-37`, `.env.example:34-36` |
| `NUXT_PUBLIC_PUBLIC_BASE_URL` | Ver el aviso de abajo: es la que existe para que el sitio no le diga a MercadoPago que mande las notificaciones a `localhost` | `SETUP.md:34`, `server/utils/baseUrl.ts` |
| `NUXT_PUBLIC_WHATSAPP_PHONE` | Los enlaces de pedido caen al respaldo del código (`nuxt.config.ts:114`) | `SETUP.md:31`, `.env.example:4-7` |
| `NUXT_MP_ACCESS_TOKEN` | No se puede cobrar con MercadoPago | `SETUP.md:32` |
| `NUXT_MP_WEBHOOK_SECRET` | Se pierde la validación de firma HMAC de las notificaciones de pago (defensa en profundidad; el pago igual se re-verifica contra la API de MP) | `SETUP.md:33` |
| `NUXT_PUBLIC_SITE_URL` | Canonical, Open Graph y JSON-LD quedan mal | `SETUP.md:35` |

> ⚠️ **Lee `server/utils/baseUrl.ts` completo antes de tocar `NUXT_PUBLIC_PUBLIC_BASE_URL`.** Ese archivo existe por una sola razón, y la explica en su encabezado (`server/utils/baseUrl.ts:1-21`): el respaldo de `publicBaseUrl` en `nuxt.config.ts:118` es `http://localhost:3000`, y si la variable llegara a faltar en producción —*"alguien la borra, un entorno nuevo, un deploy de preview sin ella"*— ese respaldo tomaría el control y el sitio le diría a Mercado Pago que mande las notificaciones de pago a localhost. Lo que cuesta: **el cobro sí se hace, pero el webhook no llega nunca**; los pedidos se quedan en `pending` para siempre, nadie los marca como pagados, GHL no se entera, quien surte no sabe que hay algo que enviar, y el cliente que ya pagó aterriza en una página muerta. Todo eso sin un solo error en ningún lado. La defensa es la regla de `server/utils/baseUrl.ts:33`: corriendo en Vercel, un `localhost` se trata como configuración rota y se usa el dominio público. **Es un cinturón, no un permiso para no poner la variable.**

## 5. Cómo se despliega hoy

El flujo registrado es: commit en `master` → `git push` a `origin` → Vercel construye y publica en producción.

La evidencia concreta está en `BITACORA.md:668-669`, del 28/08/2026 (entrada que empieza en `BITACORA.md:471`):

> Commits `f98d4b2` (fix) y `8559ab6` (bitácora), push `fcc0d78..8559ab6`.
> **Despliegue de producción `z3wsvrs5c` en Ready** (23 s). La variable ya está viva.

> **Nota de navegación:** la bitácora va de lo nuevo a lo viejo, y hay varias entradas del mismo día. Si buscas contexto alrededor de una línea, ubica primero el encabezado `##` que la gobierna hacia arriba, no la fecha que te suene.

O sea: **un despliegue de producción de este sitio tardó 23 segundos en llegar a `Ready`**. Es un solo dato medido, no un promedio, pero da el orden de magnitud: esto se despliega en menos de un minuto, no en diez. Si un build se te va a cinco minutos, algo cambió.

Comando típico, entonces:

```bash
git add -A
git commit -m "fix: lo que sea"
git push origin master
```

Y de ahí se observa el resultado en el panel de Vercel o con `vercel ls`.

**Antes de pushear**, la compuerta local es la suite completa (`package.json:11`):

```bash
npm run test        # = vitest run && playwright test
```

> ⚠️ **Esa compuerta miente de tres maneras distintas, y hay que conocerlas las tres antes de confiar en un verde.** Están detalladas en la sección 11 (11.3, 11.4 y 11.5): Playwright puede estar probando un `.output` viejo, `retries: 1` esconde los tests intermitentes, y en una máquina recién clonada **los tests de pedidos y pagos ni siquiera se ejecutan**. Un verde recién clonado no significa que pedidos y pagos funcionen.

Ojo también con el orden y con las dos trampas de la sección 11: los e2e de Playwright corren contra el build de producción local, así que el `.output` tiene que estar recién construido y el servidor de producción tiene que estar **abajo** cuando corras `npm run build`.

## 6. Qué NO viaja al despliegue, y por qué

Antes de leer la lista, entiende qué archivo hace qué trabajo: **cinco de las seis entradas de `.vercelignore` ya están también en `.gitignore`**, así que en el flujo normal (push → Vercel) nunca habrían llegado de todos modos; ese archivo es el cinturón para cuando alguien despliega con `vercel deploy` desde el CLI. **La única entrada que hace trabajo real en el flujo por Git es `BITACORA.md`**, que sí vive en el repo.

`.vercelignore` (seis líneas, el archivo completo):

```
fotos_raw
node_modules
.nuxt
.output
.env
BITACORA.md
```

El porqué de cada una:

- **`fotos_raw`** (también en `.gitignore:8`) — los originales de las fotos de producto, sin procesar. Pesan y no los sirve nadie: lo que el sitio usa son las imágenes ya procesadas dentro de `public/`. Subirlas sólo infla el bundle y el tiempo de build.
- **`node_modules`** (también en `.gitignore:2`) — Vercel instala las dependencias él mismo a partir de `package-lock.json`. Subir la carpeta local sería subir binarios compilados para Windows a un runner de Linux.
- **`.nuxt` y `.output`** (también en `.gitignore:3-4`) — artefactos del build local. Vercel construye de cero; mandarle un `.output` de tu máquina es, en el mejor caso, ruido, y en el peor, un build a medias como el que describe la trampa de la DLL (sección 11.1).
- **`.env`** (también en `.gitignore:5`, junto con `.env.*` en `.gitignore:6` y la excepción `!.env.example` en `.gitignore:7`) — el archivo con los secretos reales. **Nunca sale de la máquina**, ni al repo ni al despliegue. Los valores de producción viven **sólo** en las variables de entorno del proyecto de Vercel.
- **`BITACORA.md`** — **ésta es la que importa.** Este archivo sí está en el repositorio (no aparece en `.gitignore`; de hecho `BITACORA.md:668` registra un commit suyo), así que sin `.vercelignore` sí acabaría dentro del bundle desplegado. Es documentación interna del proyecto, con nombres de personas, diagnósticos e historial de fallas. **Si alguna vez borras o reescribes `.vercelignore`, ésta es la línea que no se puede perder.**

`.gitignore` además mantiene fuera del repo la carpeta `.vercel` (`.gitignore:1`), las carpetas de trabajo (`_*/`, `_*.json` en `.gitignore:10-11`), los `*.xlsx` (`.gitignore:16`; hay un `AMANTI_Inventario_Maestro.xlsx` en la raíz que es archivo de trabajo, no del sitio) y los artefactos de pruebas (`test-results`, `playwright-report`, `.playwright` en `.gitignore:18-20`).

> **Nota práctica sobre `.vercel/`:** en la máquina de trabajo existe `.vercel/project.json`, que es lo que enlaza la carpeta con el proyecto de Vercel para poder usar el CLI. Como está en `.gitignore:1`, **cuando clones el repo esa carpeta no viene**: el primer `vercel env ls` o `vercel ls` va a fallar hasta que corras `vercel link` y selecciones el proyecto `amanti-store-cake` — y eso requiere tener ya el acceso de la sección 2.

## 7. Cómo verificar que un despliegue quedó bien

No basta con ver "Ready" en verde. Ready significa que el build compiló, no que el sitio sirve.

### 7.1 Códigos de respuesta en las rutas que importan

`SETUP.md:81` dice, textual: *"Verificar HTTP 200 en `/`, `/tienda`, `/tienda/luna-suave`, `/carrito`"*.

> ⚠️ **Ojo con ese checklist tal como está escrito: `luna-suave` ya no está en el catálogo.** Una búsqueda de `luna-suave` en toda la carpeta `data/` devuelve cero resultados. Si copias la línea de `SETUP.md` literal, vas a obtener un 404 y vas a creer que el despliegue está roto. Usa cualquier `slug` vivo de `data/products.json`, por ejemplo `tiny-teasers-nubby`.

Ampliado a lo que hoy existe:

```bash
for u in / /tienda /tienda/tiny-teasers-nubby /carrito /api/catalog /feeds/google.xml; do
  printf '%-32s -> ' "$u"
  curl -s -o /dev/null -w '%{http_code}\n' "https://amanti.mx$u"
done
```

Los seis deben dar `200`. `tiny-teasers-nubby` es un slug real del catálogo (`data/products.json`, que trae 152 productos y 10 categorías); si algún día se da de baja, toma cualquier otro `slug` de ese archivo. `/api/catalog` lo sirve `server/api/catalog.get.ts` y `/feeds/google.xml` lo sirve `server/routes/feeds/google.xml.get.ts`.

### 7.2 Que los redirects del edge sigan vivos

Esto comprueba que `vercel.json` se aplicó, que es una cosa distinta de que el sitio compile:

```bash
curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' \
  https://amanti.mx/product-page/sun-ring
```

Esperado: `301 -> https://amanti.mx/tienda/sun-ring` (regla en `vercel.json:4-7`).

Como las reglas de `/category/…` están mapeadas a mano, conviene probar por lo menos una de ésas también, porque son las que un script "regenerador" rompería sin avisar:

```bash
curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' \
  https://amanti.mx/category/bottle-500ml
# esperado: 301 -> https://amanti.mx/tienda?cat=parejas   (vercel.json:729-732)
```

### 7.3 Cómo probar un cambio de `vercel.json` ANTES de que toque producción

`vercel.json` es el archivo más peligroso de editar de todo el repo: no hay una sola prueba que lo cubra (nada en el código lo lee) y no se puede validar en local. El único lugar donde se puede comprobar antes de producción es un despliegue de Preview, porque **cada despliegue de Vercel se lleva su propia copia del archivo y arma su propia configuración de edge**; un Preview tiene sus redirects, independientes de los de producción.

El procedimiento:

1. Haz el cambio en una **rama** (no en `master`) y pushéala. Eso es lo que genera un despliegue de Preview en lugar de uno de producción.
2. Toma la URL del Preview (la da el panel, o `vercel ls`).
3. Corre contra esa URL exactamente los mismos `curl` de 7.2, sustituyendo el dominio. Compara el `redirect_url` esperado uno por uno.
4. Sólo entonces mergea a `master`.

> **Sin verificar desde el repo:** si los despliegues de Preview están habilitados en este proyecto de Vercel, y con qué variables de entorno corren. Es lo primero que hay que confirmar en el panel, y está ligado a dos avisos de este documento: el de **costo de GoHighLevel** (sección 9) y el de `NUXT_PUBLIC_PUBLIC_BASE_URL` (sección 4), que nombra explícitamente *"un deploy de preview sin ella"* como el caso que teme.

Si resulta que los Previews no están habilitados, entonces no hay ninguna red debajo de `vercel.json`: cada edición aterriza directo en producción y la única verificación posible es la de 7.2, ya en vivo, con la reversa de la sección 8 lista.

### 7.4 Que las variables de entorno estén donde crees

```bash
vercel env ls production
```

Es el comando que ya se usó para diagnosticar en producción (`BITACORA.md:601-604`, donde confirmó que `NUXT_GHL_WEBHOOK_AVISO_PEDIDO` estaba puesta desde hacía 15 h). Lista **nombres** y antigüedad, no valores. Sirve para contestar la pregunta que más veces salió en este proyecto: "¿el código no corre, o corre y le falta la variable?".

> ⚠️ **Una verificación que ya no sirve para lo que parece.** Se podría pensar en revisar el número de WhatsApp del HTML servido (`curl -s https://amanti.mx | grep -o 'wa.me/[0-9]*'`) para confirmar que `NUXT_PUBLIC_WHATSAPP_PHONE` llegó. **Ya no distingue nada**: desde el 31-ago-2026 el valor de respaldo en `nuxt.config.ts:114` es el mismo número bueno (`5214431230732`), justamente para que si la variable falta el sitio no mande pedidos a un número ajeno. El comentario de `nuxt.config.ts:104-113` explica lo que estaba en juego: los **nueve** lugares que arman enlaces de WhatsApp caerían al respaldo en silencio, incluido `stores/cart.ts`, que es por donde se piden pedidos, *"sin un solo error en ningún lado"*. El relato completo está en `BITACORA.md:309-317`. Sirve para confirmar que el número es el correcto; **no** sirve para confirmar que la variable existe. Para eso, `vercel env ls production`.

### 7.5 El feed de Google va con caché de CDN

`server/routes/feeds/google.xml.get.ts:183` manda `Cache-Control: public, max-age=3600, s-maxage=86400`. Es decir: **una hora en el navegador y un día en el CDN de Vercel**, a propósito, porque Google no necesita más frescura (comentario en la línea 182).

Consecuencia al verificar: si cambias el catálogo o los precios y pides el feed enseguida, es normal que te sirvan la versión vieja. No es que el despliegue haya fallado. Compara contra la hora del despliegue antes de asustarte, y si necesitas ver el contenido nuevo ya, pide el feed con un parámetro que rompa la caché.

### 7.6 ⚠️ El sitemap NO se genera solo: es un archivo estático y ya está desfasado

`public/sitemap.xml` es un archivo **versionado en el repo** que enumera las URLs una por una, a mano. No hay generador: una búsqueda de `sitemap` en todo el repo sólo devuelve `public/robots.txt:8` (`Sitemap: https://amanti.mx/sitemap.xml`), que no lo produce, nada más lo anuncia.

Los números de hoy:

- `public/sitemap.xml` tiene **159** etiquetas `<loc>`: 11 páginas fijas (`/`, `/tienda`, `/blog`, `/nosotros`, `/faq`, `/contacto`, `/envios`, `/pagos`, `/terminos`, `/privacidad`, `/garantias`, en las líneas 3-13) y **142** URLs `/tienda/<slug>`.
- `data/products.json` tiene **152** productos.

O sea que **el sitemap ya va 10 productos atrás del catálogo**. Es exactamente el mismo tipo de deuda que los 149 redirects: un archivo que hay que editar a mano y que nadie revisa.

La regla práctica: **cualquier despliegue que agregue, quite o renombre un producto deja `public/sitemap.xml` desincronizado**. Si agregas productos, agrega sus `<loc>`; si borras o renombras uno, quita o corrige el suyo, porque un sitemap que apunta a URLs muertas es una señal negativa para Google. Añade esta revisión al checklist de cualquier cambio de catálogo.

### 7.7 La verificación de verdad: contra el build, no contra los tests

La bitácora es explícita en que las pruebas verdes no son la prueba final. El 31/08 el aviso de envío se validó *"de verdad, no solo con pruebas"*: levantando el build de producción contra la base real, con un receptor de webhook propio, y comprobando también el caso negativo —que deshacer el envío no dispara nada— (`BITACORA.md:301-304`). Para cualquier cambio que toque pagos, pedidos o webhooks, ése es el estándar de la casa, y con más razón después de leer la sección 11.5.

## 8. Cómo se revierte

Hay dos caminos y conviene tener claro cuál usar.

### Camino rápido: volver a publicar el despliegue anterior desde Vercel

El panel de Vercel guarda todos los despliegues y permite promover uno anterior a producción sin reconstruir nada. Es la salida en segundos cuando producción está tumbada. *(Esto es funcionalidad de la plataforma; **sin verificar desde el repo** y no hay registro de haberla usado en la bitácora.)*

### Camino canónico: revertir el commit y pushear

```bash
git log --oneline -5              # identifica el commit malo
git revert <sha>                  # crea un commit que deshace el cambio
git push origin master            # dispara un despliegue nuevo
```

Se usa `git revert`, **no** `git reset --hard` + `push --force`. Razón dura: el despliegue de Vercel está atado a la historia de la rama; un force-push reescribe esa historia y deja al proyecto de Vercel apuntando a commits que ya no existen, lo cual convierte cualquier diagnóstico posterior ("¿qué código está sirviendo hoy?") en una adivinanza. Un `revert` deja registro de que hubo un problema y de qué se deshizo, que es justo lo que este proyecto necesita: el repo no tiene CI ni otro rastro del historial de producción más allá de la bitácora.

### ⚠️ Lo que una reversa NO deshace

Revertir el código no revierte:

1. **Las variables de entorno de Vercel.** Si el despliegue malo vino acompañado de una variable nueva o modificada, el revert del código no la toca. Hay que corregirla a mano y **volver a desplegar** (ver sección 9).
2. **Las migraciones de base de datos.** Los cambios de esquema de este proyecto son archivos `.sql` que se corren a mano contra Supabase: `supabase/all.sql`, `orders-envio.sql`, `resenas-invitado.sql`, `reviews.sql`, `wishlist.sql`, `abandoned-carts.sql`, `orders-gift.sql`, `addresses-colonia.sql`. La bitácora registra el día en que se corrieron dos de ellos (`BITACORA.md:870`). **No hay herramienta de migración ni rollback automático.** Si el cambio malo incluía SQL, el revert del código puede dejarte con un esquema que el código viejo no entiende. Piensa el orden antes de revertir.
3. **La configuración en sistemas de terceros** (GoHighLevel, Mercado Pago, Stripe, n8n, Google Merchant). Esos viven fuera y se deshacen a mano.
4. **`public/sitemap.xml` y `vercel.json` ya publicados en el edge** vuelven al estado del commit al que revertiste. Si el problema era justamente un redirect mal puesto, el revert sí lo arregla — pero sólo cuando el despliegue nuevo termine, no antes.

## 9. ⚠️ Trampa: una variable nueva de Vercel no entra hasta el siguiente despliegue

Está anotada literalmente en `BITACORA.md:867-868`:

> Ojo: en Vercel una variable nueva **sólo entra con un despliegue nuevo**; por eso hubo que hacer un commit vacío.

Por qué duele: agregas la variable en el panel, la ves listada con `vercel env ls production`, y el sitio sigue comportándose como si no existiera. Parece un bug del código y no lo es — el runtime que está sirviendo se construyó antes de que la variable existiera.

Cómo forzar el despliegue cuando no tienes ningún cambio de código que pushear:

```bash
git commit --allow-empty -m "chore: redeploy para tomar variables nuevas"
git push origin master
```

Ese es exactamente el recurso que se usó ese día. Alternativa sin tocar git: volver a desplegar el último commit desde el panel de Vercel (opción "Redeploy").

Está documentado una vez (`BITACORA.md:867-868`), y el riesgo es recurrente porque el proyecto suma variables sobre la marcha: **ese mismo día se pusieron cinco** (`BITACORA.md:865-867`: `NUXT_ENVIO_COSTO`, `NUXT_PUBLIC_ENVIO_COSTO`, `NUXT_PEDIDOS_PIN`, `NUXT_RESENA_SECRET`, `NUXT_GHL_WEBHOOK_AVISO_PEDIDO`).

> **Aviso relacionado:** `.env.example` **no es la lista completa** de variables de producción. Ahí no aparecen, por ejemplo, `NUXT_ENVIO_COSTO` / `NUXT_PUBLIC_ENVIO_COSTO` (documentadas en `nuxt.config.ts:121-125`), ni `NUXT_PEDIDOS_PIN`, ni `NUXT_RESENA_SECRET`, ni `NUXT_N8N_CHAT_WEBHOOK` (`nuxt.config.ts:97-99`). Si levantas un entorno nuevo copiando `.env.example`, te va a faltar. La lista real de lo que hay en producción sale de `vercel env ls production`, y por eso el acceso a Vercel de la sección 2 es bloqueante.

> ⚠️ **Y una que cuesta dinero de verdad.** El propio `.env.example:47-49` advierte, junto a las variables `NUXT_GHL_WEBHOOK_*`, que esos triggers de GoHighLevel son **premium y se cobran POR USO**, que no se pongan *"en entornos de prueba que disparen trafico real"*, y que quien tenga la URL puede disparar el workflow y generar cobro. Traducción para despliegues: **no copies las variables de GHL a un entorno de Preview** ni a un proyecto de staging donde corran pruebas automatizadas. Un e2e en bucle contra un entorno con esas URLs configuradas es una factura. La misma lógica aplica en la bitácora del 28/08, donde se decidió **no** disparar un script de prueba porque *"cada disparo se cobra"* (`BITACORA.md:583-584`); al final no hizo falta, porque entró un pedido real que hizo la prueba gratis (`BITACORA.md:595-599`).

> **Nota de diseño que conviene conocer antes de apagar algo:** `.env.example:45` dice que en GHL **vacío o ausente = ese evento queda apagado, y el resto sigue funcionando**. Es decir, borrar una variable `NUXT_GHL_WEBHOOK_*` es una forma legítima y segura de apagar un solo aviso sin tocar código — pero acuérdate de la trampa de arriba: **no surte efecto hasta el siguiente despliegue**.

## 10. ⚠️ El webhook de pagos tiene un bypass de modo prueba

Esto hay que saberlo, verificarlo y no romperlo. `server/api/mp-webhook.post.ts:54-61` permite **simular un pago** sin que MercadoPago exista, y lo que lo mantiene apagado en producción son tres condiciones que se tienen que cumplir **todas a la vez**:

```ts
// Modo test: SOLO fuera de producción, con MP_WEBHOOK_TEST_MODE presente y un secreto
// compartido que el caller debe conocer. Imposible de activar en un deploy de producción.
const isTest =
  process.env.NODE_ENV !== 'production' &&
  !!process.env.MP_WEBHOOK_TEST_MODE &&
  !!body?.__test_secret &&
  body.__test_secret === process.env.MP_WEBHOOK_TEST_MODE &&
  !!body?.__test_payment
```

El primer candado es el que importa: **en producción `NODE_ENV` vale `'production'`, así que el bypass queda deshabilitado aunque la variable `MP_WEBHOOK_TEST_MODE` llegara a existir**. Así lo dice también el comentario de `playwright.config.ts:41-42`.

Del otro lado, la suite e2e enciende el bypass a propósito: `playwright.config.ts:43` fuerza `NODE_ENV: 'test'` y `playwright.config.ts:45` pone `MP_WEBHOOK_TEST_MODE: '1'`, con el comentario *"El webhook exige `__test_secret === MP_WEBHOOK_TEST_MODE` para simular pagos (ausente en prod)"*. En esa misma configuración, `playwright.config.ts:40` pasa un token de MercadoPago dummy (`TEST-MP-INVALID`) que, según el comentario de las líneas 38-39, deja pasar el check, ejercita la creación del order y hace que la llamada a MP falle con 401, dejando el pedido en `pending`.

**Lo que el nuevo dueño tiene que hacer con esto, en este orden:**

1. Confirmar con `vercel env ls production` que **`MP_WEBHOOK_TEST_MODE` NO está en producción**. No debería estarlo. Si aparece, quítala: aunque `NODE_ENV` sola ya bastaría, no hay razón para dejar puesta la mitad de un bypass de pagos.
2. Confirmar que nada en el panel de Vercel está forzando `NODE_ENV` a algo distinto de `production` en el entorno de producción. Ese es el único candado que de verdad lo apaga. *(**Sin verificar desde el repo**: el valor de `NODE_ENV` en el panel.)*
3. Si alguna vez tocas `server/api/mp-webhook.post.ts`, **no relajes ninguna de las cinco condiciones de ese `isTest`**. Cada una está ahí a propósito, y juntas son lo que impide que un tercero marque un pedido como pagado mandando un POST.

## 11. Trampas del build y de las pruebas

Las dos primeras están registradas en `BITACORA.md:215-223`, en la entrada del 14/09/2026 bajo "Lo que enseñó el día". Ninguna es un bug del sitio; las dos parecen uno. Las tres siguientes salen de leer `playwright.config.ts`.

### 11.1 ⚠️ El build truena si el servidor de producción local está levantado

Síntoma, textual de la bitácora (`BITACORA.md:221-223`):

> **El build revienta si el server de producción está levantado**: `EPERM ... unlink libvips-42.dll`, porque el `node .output/server/index.mjs` tiene la DLL de sharp cargada. Hay que bajar el server antes de `npm run build`, o el `.output` queda a medias.

Qué pasa por dentro: el servidor de producción local se levanta con `node .output/server/index.mjs` (`SETUP.md:22`). Ese proceso carga `libvips-42.dll`, la librería nativa de `sharp` que usa ipx para optimizar imágenes. En Windows, un archivo abierto por un proceso **no se puede borrar ni reemplazar**; el build necesita hacerlo para reescribir `.output`, y el sistema devuelve `EPERM`.

Lo caro no es el error: es que **`.output` queda a medias**. Te quedas con un build inconsistente que puede arrancar y comportarse raro, y vas a perseguir un fantasma.

El procedimiento correcto:

```bash
# 1. Baja el servidor de producción (Ctrl+C en su terminal).
#    Si lo perdiste de vista, en Windows:
#      tasklist | grep -i node
#      taskkill /PID <pid> /F
# 2. Ahora sí:
npm run build
# 3. Y vuelve a levantarlo:
node .output/server/index.mjs
```

### 11.2 ⚠️ Correr las pruebas al mismo tiempo que un build da rojos falsos

Otra vez textual (`BITACORA.md:217-220`):

> **Una corrida de pruebas contra un build en paralelo miente.** La suite unitaria dio 4 rojos y luego 2, todos por `Test timed out in 5000ms` en `ui-state.test.ts`. El caso de control (ese archivo solo, sin el build compitiendo) pasó los 4 en 5 segundos, y la corrida limpia terminó 261/261. No había regresión: había contención de CPU.

La firma de este falso positivo es reconocible: **los rojos son todos `Test timed out`, y el número cambia entre corridas** (4, luego 2). Una regresión de verdad falla siempre en el mismo sitio y con un mensaje sobre el comportamiento, no sobre el reloj.

La regla: **build y pruebas no se solapan**. Si ya te pasó, el protocolo que se usó ese día es el correcto — corre el archivo sospechoso solo, sin nada más compitiendo, como caso de control, antes de creerle al rojo:

```bash
npx vitest run test/unit/ui-state.test.ts
```

### 11.3 ⚠️ Verde falso #1: Playwright puede estar probando el build viejo

Esto no está en la bitácora como incidente, pero sale de leer `playwright.config.ts` y es la consecuencia natural de las dos trampas de arriba, así que anótalo antes de que te muerda.

`playwright.config.ts:30-50` define el `webServer` así: el comando es `node .output/server/index.mjs` (línea 31) y **`reuseExistingServer: true`** (línea 48). Es decir: si ya hay algo escuchando en el puerto 3457, **Playwright no levanta nada — reutiliza lo que encuentre**.

Junta las piezas: dejaste el servidor de producción arriba → el `npm run build` falló con `EPERM` o lo saltaste → corres `npm run test:e2e` → Playwright reutiliza el servidor que sigue vivo → **tus e2e pasan contra el `.output` anterior, sin tus cambios**. Verde que no significa nada.

El orden seguro es: bajar el servidor → `npm run build` → `npm run test:e2e` (que ya levanta el suyo). El puerto se puede pisar con `E2E_PORT` si lo necesitas (`playwright.config.ts:6`); el 3457 se eligió porque el 3010 cae dentro del rango que Windows reserva para Hyper-V/WSL y Node truena con `EACCES` antes de escuchar, lo que dejó a la suite e2e sin correr durante días (`playwright.config.ts:3-5`, y el relato en `BITACORA.md:274-276`).

### 11.4 ⚠️ Verde falso #2: hay un reintento automático

`playwright.config.ts:19` tiene `retries: 1`, con el comentario *"1 reintento: absorbe hipos transitorios de los tests que tocan Supabase (rate-limit de auth)"*. La razón es legítima, pero el efecto secundario hay que tenerlo presente: **un test intermitente falla, se reintenta, pasa, y la corrida sale verde**. La suite no te va a avisar de un test que sólo funciona la mitad de las veces.

Si estás diagnosticando algo raro, o si vas a tocar código sensible, corre sin reintentos para ver la verdad:

```bash
npx playwright test --retries=0
```

Y si un test sólo pasa en el reintento, trátalo como un hallazgo, no como ruido.

### 11.5 ⚠️ Verde falso #3, el peor: en una máquina recién clonada, los tests de pedidos y pagos NO se ejecutan

`playwright.config.ts:37` pasa al servidor de pruebas:

```ts
// Para los tests de pedidos (Etapa 3): se pasa la service_role desde el shell (SB_SVC),
// nunca hardcodeada. Sin ella, los endpoints de orden responden 500 (tests env-gated).
SUPABASE_SERVICE_ROLE_KEY: process.env.SB_SVC || '',
```

La decisión de fondo es correcta: la llave `service_role` **nunca** se hardcodea en un archivo versionado, se inyecta desde el shell con la variable `SB_SVC`. Pero léela con cuidado, porque tiene una consecuencia que muerde justo en una transferencia:

**Si `SB_SVC` no está en tu shell, `SUPABASE_SERVICE_ROLE_KEY` queda en cadena vacía, los endpoints de pedido responden 500, y esos tests quedan env-gated — o sea, se saltan.** La corrida termina en verde **habiendo brincado justamente el código de pedidos y pagos**, que es el código que más caro sale si se rompe.

Consecuencias prácticas:

- Un `npm run test` verde en una máquina recién clonada **no es una compuerta válida** para pushear un cambio que toque checkout, orders o webhooks. Es un verde con un agujero del tamaño del negocio.
- Antes de confiar en la suite, exporta `SB_SVC` con la llave `service_role` de Supabase (la sacas del panel: Project Settings → API → service_role, según `.env.example:40`) y vuelve a correr. Compara el número de tests ejecutados con y sin la variable: la diferencia es exactamente lo que te estabas saltando.
- **Nunca** pongas ese valor en un archivo del repo, ni en un script commiteado, ni en `playwright.config.ts`. Va en el shell y nada más.

## 12. Optimización de imágenes: cambia de proveedor entre local y Vercel

`nuxt.config.ts:16-22`:

```ts
image: {
  // ipx en local (node); en Vercel se usa la optimización nativa (/_vercel/image)
  provider: process.env.VERCEL ? 'vercel' : 'ipx',
  format: ['webp'],
  quality: 72,
  densities: [1, 2],
},
```

- **En local** (`process.env.VERCEL` no existe): el proveedor es **ipx**, que redimensiona y convierte las imágenes **dentro del proceso de Node**, bajo demanda, usando `sharp`.
- **En Vercel** (la plataforma inyecta `VERCEL`): el proveedor es **vercel**, o sea la optimización nativa que sirve el edge por `/_vercel/image`.

En los dos casos se emite WebP con calidad 72 y densidades 1x y 2x.

Lo que hay que saber de esto al desplegar:

1. **El rendimiento local no predice el de producción, y por mucho.** `playwright.config.ts:11-12` lo dice con número: el timeout de los e2e está en 45 segundos porque *"la página `/tienda` optimiza 143 imágenes con ipx en el primer load del server frío (en prod van por CDN/Vercel)"*. Si abres `/tienda` en un build local recién levantado y tarda una eternidad, **es ipx trabajando, no una regresión**. En producción esas mismas imágenes las sirve el CDN ya transformadas y cacheadas. Por lo mismo, `playwright.config.ts:17` limita a `workers: 2`.
2. **Es el mismo `sharp`/ipx que provoca la trampa de la DLL** de la sección 11.1. Están conectadas: el proveedor local carga una librería nativa y esa librería es la que bloquea el archivo.
3. **Un cambio de proveedor se prueba en producción, no en local**, porque son dos implementaciones distintas. Si tocas `format`, `quality` o `densities`, verifica en el sitio desplegado que las imágenes sigan saliendo (`curl -s -o /dev/null -w '%{http_code}' <url de una imagen del sitio>`), no sólo en tu máquina.

*(El consumo y el costo de la optimización de imágenes de Vercel se ven en el panel de la plataforma; **sin verificar desde el repo**.)*

## 13. ⚠️ Una URL viva está escrita dentro del repo: decide si se rota antes de entregar

`nuxt.config.ts:99` define `n8nChatWebhook` con **la URL real y funcionando del webhook de n8n del agente EROS escrita directamente en el código**, como valor por defecto. El comentario de las líneas 97-98 explica el diseño, que en sí es correcto: es una variable privada de servidor, `/api/chat` hace de proxy para evitar CORS y **ocultarle la URL al cliente**, y se puede sobreescribir con `NUXT_N8N_CHAT_WEBHOOK`. El único consumidor es `server/api/chat.post.ts:7`.

El problema para una transferencia es otro: **esa URL no está oculta para quien tiene el repo.** Está en texto plano en un archivo versionado, o sea que está en todo el historial de git, en cada clon y en cada respaldo que exista. Quien reciba el repositorio recibe también la dirección a la que se le puede mandar tráfico directo al agente de n8n, saltándose el sitio.

Lo que hay que decidir **antes** de entregar, y dejarlo por escrito:

1. **¿Se rota esa URL?** En n8n se puede regenerar el webhook del workflow para que la vieja deje de responder. Es la opción limpia.
2. Si se rota, el valor nuevo **no vuelve al código**: se pone como `NUXT_N8N_CHAT_WEBHOOK` en las variables de Vercel (acuérdate de la sección 9: no entra hasta el siguiente despliegue), y el valor por defecto de `nuxt.config.ts:99` se deja vacío o apuntando a algo inofensivo.
3. Mismo criterio, con más urgencia todavía, para **cualquier valor que se sospeche expuesto**: las llaves de Supabase, el token de MercadoPago, los secretos de Stripe y las URLs de GoHighLevel viven en variables de entorno y **deben rotarse en un cambio de manos**, porque quien las tuvo las sigue teniendo. Las de GHL además tienen filo económico: `.env.example:47-49` advierte que *"quien las tenga puede disparar el workflow y generar cobro"*.

*(Este documento no reproduce ningún valor de ningún secreto, ni la URL del webhook. Sólo dice el nombre de la variable y el archivo donde vive.)*

## 14. Lo que no pude verificar leyendo el repo

Lo siguiente es configuración que vive en paneles externos. Está aquí como lista de lo primero que hay que ir a mirar **con los accesos de la sección 2 en la mano**, y **no** como afirmación:

- Que el proyecto de Vercel esté conectado al repo de GitHub por la integración Git, y qué rama tiene marcada como *Production Branch*. La bitácora registra la secuencia push → despliegue de producción, pero la conexión misma se configura en el panel.
- Si los despliegues de Preview están habilitados y con qué variables de entorno corren. Importa por tres cosas: la advertencia de cobro de GoHighLevel (sección 9), el escenario *"un deploy de preview sin ella"* que temen `server/utils/baseUrl.ts:9` y `nuxt.config.ts:110`, y el procedimiento de prueba de `vercel.json` (sección 7.3), que sin Previews simplemente no existe.
- La lista y los valores de las variables de entorno de producción. Se obtiene con `vercel env ls production` (nombres, nunca valores).
- El valor de `NODE_ENV` en el entorno de producción de Vercel: es el candado que apaga el bypass del webhook de pagos (sección 10).
- La versión de Node con la que Vercel construye: `package.json` no declara `engines`, así que la elige el panel.
- El comando de build, el directorio de salida y el framework detectado en el panel.
- Cómo está apuntado el dominio `amanti.mx` (DNS, certificado, alias de producción) y quién controla el registrador.
- Si existe protección de despliegue, aprobaciones o *Instant Rollback* configurado.
- El consumo y costo de la optimización de imágenes de Vercel.
- Quién es hoy el titular de cada cuenta de la tabla de la sección 2 (Vercel, GitHub, Supabase, MercadoPago, Stripe, GoHighLevel, n8n, registrador del dominio).
