# Traspaso de la infraestructura

Hoy el sitio corre en cuentas que no administra AMANTI. Mientras eso siga así, nadie del lado de
AMANTI puede desplegar, revocar accesos ni recuperar el sitio si algo se cae. Este documento es el
procedimiento para moverlo todo a cuentas de AMANTI **sin que amanti.mx deje de responder ni un
minuto**.

El orden importa más que la velocidad. Cada paso dice qué se rompe si se hace antes de tiempo. Si
tienes que parar a media faena, para entre pasos, nunca dentro de uno.

> **Esta sección es autosuficiente a propósito.** Todo lo indispensable para ejecutar el traspaso
> —incluida la lista y el orden de rotación de secretos— está aquí dentro, para que se pueda seguir
> de principio a fin sin saltar de archivo a media maniobra. El detalle fino de cada cuenta y cada
> secreto está en `13-accesos-y-cuentas.md`, y el de cada variable en `07-variables-de-entorno.md`.

---

## El punto de partida

| Pieza | Dónde vive hoy | Cómo se verifica |
|---|---|---|
| Repositorio | `github.com/memorx/amanti-store`, por SSH | `.git/config:9` |
| Rama de trabajo | `master` (no `main`) | `.git/HEAD:1`, `.git/config:11` |
| Hosting | Vercel, proyecto `amanti-store-cake` | `package.json:2`, `BITACORA.md:4` |
| Equipo de Vercel | `izalith` | Verificado el 18/09: `vercel env ls production` responde sobre `izalith/amanti-store-cake`. `.vercel/project.json` guarda `projectId`, `orgId` y `projectName`. El nombre del **equipo** no aparece ahí; el del **proyecto** sí, y sirve para confirmar a dónde apunta la carpeta antes de borrarla |
| Base de datos | Supabase; el proyecto lo identifica `SUPABASE_URL` | `server/utils/supabaseAdmin.ts:11`. Bajo qué organización vive: **sin verificar desde el repo** |
| Dominio | `https://amanti.mx`, sirviendo desde Vercel | `nuxt.config.ts:116`, `BITACORA.md:4`. Registrador y proveedor de DNS: **sin verificar desde el repo** |
| Subdominio de terceros | `link.amanti.mx`, apuntando a GoHighLevel | `components/NewsletterForm.vue:28` y `:43`, `BITACORA.md:70` |

Dos cosas que conviene saber desde ya, porque simplifican mucho el trabajo:

- **Las fotos de producto no están en la nube de nadie.** Son archivos estáticos del repositorio, en
  `public/products/` (496 archivos), referidos como `/products/<slug>_N.jpg` desde
  `data/products.json` — 152 productos, los 152 con al menos una foto. No hay una sola llamada a
  Supabase Storage en todo el código (`grep -rn "\.storage"` sobre `server/`, `components/`,
  `pages/`, `composables/`, `plugins/`, `stores/` y `utils/` no devuelve nada). Se mueven solas con
  el repositorio.
- **Los 149 redirects del sitio viejo viven en `vercel.json`**, no en el panel. El archivo tiene una
  sola llave de primer nivel, `redirects` (`vercel.json:2`), y nada más: ni crons, ni headers, ni
  regiones. Viajan con el repositorio y no hay que recapturarlos.

---

## Antes de mover nada: lo que hay que crear

Esto se hace primero, completo, y sin tocar producción. Son cuentas vacías: crearlas no rompe nada,
y no tenerlas a medio traspaso sí.

1. **Una organización de GitHub a nombre de AMANTI**, con al menos dos personas con rol de
   propietario. Una sola persona propietaria es un punto único de falla: si pierde el acceso, nadie
   puede volver a entrar.
2. **Una cuenta de Vercel a nombre del negocio** —correo corporativo de AMANTI, no el personal de
   nadie— y dentro de ella un equipo. El plan tiene que admitir funciones de servidor: el sitio no
   es estático. Tiene 13 handlers en `server/api/` (12 rutas distintas, porque `mp-webhook` tiene
   GET y POST) más la ruta `server/routes/feeds/google.xml.get.ts`, todos ejecutándose en servidor
   en cada petición.
3. **Una organización de Supabase a nombre de AMANTI**, con su propio método de pago.
4. **Acceso de administrador al registrador del dominio `amanti.mx`.** Hay que confirmar quién lo
   tiene antes de empezar; si el dominio no se puede administrar, el traspaso se detiene en el paso 4
   y no hay forma de terminarlo.
5. **Claridad sobre la sub-cuenta de GoHighLevel.** Es el punto que más se pasa por alto. El
   formulario de newsletter y los cinco workflows no son configuración del sitio: son recursos que
   viven dentro de una cuenta de GHL que hoy administra César. Ver el paso 5.
6. **Un canal para recibir los valores de los secretos.** No van en este paquete ni en el
   repositorio.

**Qué se rompe si esto se salta:** nada de inmediato, y ese es justo el problema. Se descubre a
mitad del paso 2, con el proyecto nuevo a medio armar y el viejo ya intervenido, que no hay a dónde
mover nada. Ese es el escenario que sí tumba el sitio.

---

## Paso 0 — Inventario y respaldo

### El repositorio NO es respaldo de la configuración

El `.env` local tiene ocho variables. El código nombra veintidós. La diferencia no está en ningún
archivo: vive únicamente en el panel de Vercel. **Si se pierde ese panel antes de haber copiado los
valores, el sitio no se puede volver a levantar.**

Lo primero, entonces, es sacar el listado de producción desde el proyecto actual con
`vercel env ls production` —el comando que ya se usaba en este proyecto (`BITACORA.md:602`)— y
cotejarlo contra esta tabla, que sale de leer el código:

| Variable | Dónde se lee | Qué pasa si falta |
|---|---|---|
| `SUPABASE_URL` | `node_modules/@nuxtjs/supabase/dist/module.mjs:17`; también `server/utils/supabaseAdmin.ts:11` como respaldo del server. (`nuxt.config.ts:12` **es un comentario**, no una lectura) | El build **no falla**: el módulo solo advierte (`module.mjs:59-60`). Revienta en runtime. Ojo con el otro caso, abajo |
| `SUPABASE_KEY` | `module.mjs:18` | Igual: advertencia en build (`module.mjs:78-79`), cuentas rotas en vivo |
| `SUPABASE_SERVICE_ROLE_KEY` | `server/utils/supabaseAdmin.ts:12` (y el módulo la acepta como `secretKey`, `module.mjs:20`) | HTTP 500 en todo lo que toque pedidos (`supabaseAdmin.ts:13-19`). Nadie puede pagar |
| `NUXT_MP_ACCESS_TOKEN` | `nuxt.config.ts:90` | `/api/checkout` devuelve 400 (`server/api/checkout.post.ts:65-67`). Mercado Pago apagado |
| `NUXT_MP_WEBHOOK_SECRET` | `nuxt.config.ts:92` | Ver la advertencia del paso 5. Vacía **no** rompe el webhook: lo deja sin validar firma |
| `NUXT_STRIPE_SECRET_KEY` | `nuxt.config.ts:94` | Sin pago con tarjeta (`server/api/stripe-checkout.post.ts:17-20`) |
| `NUXT_STRIPE_WEBHOOK_SECRET` | `nuxt.config.ts:96` | El webhook de Stripe no valida firmas |
| `NUXT_PUBLIC_STRIPE_ENABLED` | `nuxt.config.ts:120` | Vacío = el botón de tarjeta ni aparece. Ese es el valor por omisión |
| `NUXT_PUBLIC_SITE_URL` | `nuxt.config.ts:116` | Respaldo `https://amanti.mx`. Es el que salva al sitio, ver abajo |
| `NUXT_PUBLIC_PUBLIC_BASE_URL` | `nuxt.config.ts:118` | Respaldo `http://localhost:3000`. Ver abajo |
| `NUXT_PUBLIC_WHATSAPP_PHONE` | `nuxt.config.ts:114` | Cae al número escrito en el código, que hoy sí es el bueno. Lee el comentario de `nuxt.config.ts:102-113` antes de tocarlo |
| `NUXT_ENVIO_COSTO` | `server/utils/costoEnvio.ts:23` | Envío gratis para todos. **Cuesta dinero en cada pedido** |
| `NUXT_PUBLIC_ENVIO_COSTO` | `nuxt.config.ts:125` | El carrito pinta envío gratis. Tiene que valer **lo mismo** que la de arriba (`nuxt.config.ts:121-124`) |
| `NUXT_PEDIDOS_PIN` | `server/api/pedidos.get.ts:17`, `server/api/pedido-enviado.post.ts:11` | `/api/pedidos` devuelve 404 a propósito (`pedidos.get.ts:11-12`, `:17-18`). Nancy se queda sin pantalla |
| `NUXT_RESENA_SECRET` | `server/utils/resenaToken.ts:27` | Se apagan las reseñas de invitado (`resenaToken.ts:21-22`, `:30-33`) |
| `NUXT_GHL_WEBHOOK_POSTCOMPRA` | `server/utils/ghl.ts:58` | Ese evento queda apagado en silencio (`ghl.ts:21-23`, `:91`) |
| `NUXT_GHL_WEBHOOK_CARRITO_ABANDONADO` | `server/utils/ghl.ts:59` | Igual |
| `NUXT_GHL_WEBHOOK_REACTIVACION` | `server/utils/ghl.ts:60` | Igual |
| `NUXT_GHL_WEBHOOK_AVISO_PEDIDO` | `server/utils/ghl.ts:61` | Nancy deja de enterarse de que hay pedido que surtir |
| `NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` | `server/utils/ghl.ts:62` | El cliente no se entera de que su paquete salió |
| `NUXT_PROMO_VIGENCIA` | `server/routes/feeds/google.xml.get.ts:55` | El feed no manda fecha de corte de la promoción |
| `NUXT_N8N_CHAT_WEBHOOK` | `nuxt.config.ts:98-99` | Tiene URL por omisión escrita en el código; el chat degrada solo si falla (`server/api/chat.post.ts:29-32`) |

Son 22. **Cuenta las filas, no de memoria:** el paso 2, camino B, manda cargar estas mismas 22.

**Dos nombres para lo mismo, y el que gana no es el obvio.** El módulo de Supabase resuelve la URL
como `NUXT_PUBLIC_SUPABASE_URL || SUPABASE_URL` (`module.mjs:17`) y la llave anónima como
`NUXT_PUBLIC_SUPABASE_KEY || SUPABASE_KEY || SUPABASE_PUBLISHABLE_KEY || SUPABASE_ANON_KEY || …`
(`module.mjs:18`). Es decir: **las `NUXT_PUBLIC_*` ganan**. Si al recapturar en el panel nuevo
alguien carga las dos versiones y una apunta al proyecto viejo, el sitio usará esa y no vas a
entender por qué. Carga una sola forma y bórrala de la otra.

**`MP_WEBHOOK_TEST_MODE` no va en producción, nunca.** Existe para pruebas y está atada a
`NODE_ENV !== 'production'` (`server/api/mp-webhook.post.ts:56-61`), así que no se puede encender en
un despliegue de producción aunque alguien la cargue. Si aparece en la lista del panel, es basura y
se borra.

### Lo que ya sabemos que falta hoy en producción

No hay que descubrirlo: está asentado. Al 18 de septiembre de 2026, **el código nombra 22
variables y producción tiene 15.** Las siete ausentes están identificadas, con el diagnóstico de
cada una, en `07-variables-de-entorno.md` §0. Solo una es un hueco real:
`NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO`, cuyo evento se dispara y no tiene a dónde llegar. Las otras seis
faltan a propósito o no hacen falta: las tres de Stripe (apagado), `NUXT_PROMO_VIGENCIA`
(deliberadamente vacía), `NUXT_N8N_CHAT_WEBHOOK` (el código trae la URL) y
`NUXT_GHL_WEBHOOK_REACTIVACION` (ningún código emite ese evento).

Cuando armes el proyecto nuevo, carga las 15 y **no copies el hueco**: crea la de pedido enviado en
cuanto César tenga el workflow, o déjala fuera **a sabiendas** y anotado.

### `.env.example` está incompleto y no avisa

`.env.example` documenta 16 de las 22 variables. **Le faltan seis:** `NUXT_ENVIO_COSTO`,
`NUXT_PUBLIC_ENVIO_COSTO`, `NUXT_PEDIDOS_PIN`, `NUXT_RESENA_SECRET`, `NUXT_PROMO_VIGENCIA` y
`NUXT_N8N_CHAT_WEBHOOK`.

Esto muerde de una forma muy fea: un desarrollador que arranque copiando ese archivo —que es justo
lo que dice `SETUP.md:13`— levanta un entorno **a medias y sin un solo error que se lo diga**. Envío
gratis para todos (`costoEnvio.ts:23`), `/api/pedidos` en 404 (`pedidos.get.ts:11-12`), reseñas de
invitado apagadas (`resenaToken.ts:30-33`) y el feed sin fecha de corte. Todo eso «funciona»: solo
que mal. La tabla de arriba es la lista buena, no `.env.example`.

### Un detalle que explica por qué el sitio aguanta

`NUXT_PUBLIC_PUBLIC_BASE_URL` tiene de respaldo `http://localhost:3000`. Si se perdiera en el
traspaso, lo esperable sería que el sitio le dijera a Mercado Pago que mande las notificaciones de
pago a `localhost`: se cobra, el webhook nunca llega, los pedidos se quedan en `pending` para
siempre y nadie se entera. Eso está previsto: `server/utils/baseUrl.ts:26-35` detecta que corre en
Vercel, ve un `localhost` y lo sustituye por `NUXT_PUBLIC_SITE_URL`. **Esa protección depende de que
`NUXT_PUBLIC_SITE_URL` esté bien.** Cárgala primero que ninguna otra.

### Las llaves del `.env` de desarrollo se rotan

El `.env` de desarrollo lleva llaves reales de producción, entre ellas la
**`SUPABASE_SERVICE_ROLE_KEY`**. Está listado en `.gitignore:5` (junto con `.env.*` en `:6`), así que
**no viaja en el repositorio**.

**Lo que hay que entender:** la `service_role` se salta RLS por definición, así que quien la tenga
puede leer y escribir toda la base. **Esas llaves siguen sirviendo hasta que alguien las rote en el
panel de Supabase**, y esa rotación es un paso obligatorio del traspaso, no una recomendación. Está
en la sección de rotación, más abajo.

### El respaldo de la base

Antes de tocar Supabase, sácale un volcado de la base de producción y guárdalo fuera de Supabase y
fuera de Vercel. No es paranoia: como se explica en el paso 3, **el esquema completo no está en el
repositorio**, y ese volcado es el único ejemplar que existe de más de la mitad de las tablas.

**El volcado tiene que incluir esquema, triggers y políticas RLS, no solo datos.** Un volcado de
datos a secas te deja sin lo que más falta hace y sin manera de notarlo hasta que el panel de cuenta
ya está roto en el proyecto nuevo.

---

## Paso 1 — El repositorio de GitHub

Se hace primero porque es el paso reversible y el que menos toca producción: mientras nadie
despliegue, el sitio sigue sirviendo el último build sin importar dónde viva el código.

1. Transfiere el repositorio `memorx/amanti-store` a la organización de AMANTI, con la función de
   transferencia de GitHub, **no** copiando archivos a un repositorio nuevo. La transferencia
   conserva el historial completo de commits, que es donde está explicado el porqué de casi todo, y
   deja redirecciones desde la URL vieja.
2. Da acceso al desarrollador nuevo y comprueba que puede clonar y empujar **con sus propias
   credenciales**. El remoto actual es SSH (`git@github.com:memorx/amanti-store.git`,
   `.git/config:9`), así que hace falta su llave, no la de nadie más.
3. Revisa que no quede nadie del proveedor saliente como colaborador ni como propietario.

**Trampa: la rama es `master`, no `main`** (`.git/HEAD:1`, `.git/config:11`). Anótalo ahora, porque
muerde en el paso 2.

**Qué se rompe si se hace en el orden equivocado:** si transfieres el repositorio cuando Vercel ya
está reconectado a él, la integración de Git puede perder permisos y los `push` dejan de desplegar.
El sitio no se cae —sigue sirviendo el último despliegue— pero te quedas sin poder publicar nada, y
el síntoma es mudo: el push funciona y simplemente no pasa nada del otro lado.

---

## Paso 2 — El proyecto de Vercel

Hay dos caminos y no dan lo mismo.

### Camino A: transferir el proyecto de equipo a equipo (recomendado)

Vercel permite mover un proyecto entre equipos. Es el camino bueno porque el proyecto se lleva
consigo su configuración: variables de entorno, historial de despliegues, dominios asignados y el
mismo `projectId`. En particular, **conserva las variables de entorno**, que es exactamente lo que
no está respaldado en ningún lado.

Requiere que ambos equipos lo acepten y que el equipo destino tenga plan y método de pago.
**Sin verificar desde el repo:** las condiciones exactas que Vercel impone hoy a una transferencia
entre equipos y qué se conserva al pie de la letra. Confírmalo en el panel antes de comprometerte a
este camino.

### Camino B: proyecto nuevo en el equipo de AMANTI

Es el plan B, y hay que saber que **no se conserva nada del panel**. Lo que hay que volver a cargar
a mano:

- **Las veintidós variables de la tabla del paso 0**, en el entorno de producción — reconciliadas
  antes contra las 15 que hay hoy. Y también en preview, si quieres que los despliegues de rama
  sirvan para algo, con una salvedad grande en la advertencia de más abajo.
- **La rama de producción: `master`.** Un proyecto nuevo de Vercel asume `main`. Si no lo cambias,
  cada push a `master` genera un despliegue de *preview* y producción nunca se actualiza. No falla
  nada, no hay error, simplemente el sitio se queda congelado en la versión del día del traspaso.
- **La configuración de Deployment Protection** (contraseña de preview, SSO del equipo, protección
  de despliegues). **Sin verificar desde el repo:** qué tiene puesto el proyecto viejo. Importa
  porque cambia quién puede abrir los despliegues de rama: si el viejo pedía contraseña y el nuevo
  no, los previews quedan públicos y ahí se prueba con datos reales; si el viejo no pedía nada y el
  nuevo exige SSO, Nancy o Emilio dejan de poder abrir una URL de preview que antes usaban.
  Cotéjalo proyecto contra proyecto, igual que la rama y la versión de Node.
- **El dominio**, que es el paso 4 y va después, no aquí.
- La versión de Node y la configuración de build. **Sin verificar desde el repo:** `package.json` no
  declara `engines`, así que la versión de Node es un ajuste del panel y hay que copiarla del
  proyecto viejo, no adivinarla.

Lo que **no** hay que recapturar, porque viaja en el repositorio: los 149 redirects
(`vercel.json`), la optimización de imágenes —se activa sola en Vercel mirando la variable `VERCEL`
que la propia plataforma inyecta (`nuxt.config.ts:18`)— y todo el código.

### Dos trampas que ya cobraron en este proyecto

**Una variable nueva no entra en vigor hasta que hay un despliegue nuevo.** Está anotado en
`BITACORA.md:867-868`, donde hubo que hacer un commit vacío justamente por esto. Cargar las 22
variables y no redesplegar deja el sitio corriendo con la configuración vieja, y todo parece
correcto en el panel.

**El archivo `.vercel/` local todavía apunta al proyecto viejo.** Guarda `projectId`, `orgId` y
`projectName`, está en `.gitignore:1` —o sea que no viaja con el repositorio, pero sí vive en la
carpeta de trabajo— y si alguien corre `vercel --prod` desde esa carpeta **despliega al proyecto del
proveedor saliente**. Antes de borrarlo, ábrelo: el `projectName` que trae te dice a qué proyecto
está enlazada esa carpeta, y sirve para confirmar que no te equivocaste de cuál. Luego bórralo y
vuelve a enlazar antes de desplegar por primera vez.

**Advertencia de dinero:** no cargues las cinco variables `NUXT_GHL_WEBHOOK_*` en un entorno de
preview ni de pruebas. Esos disparadores de GoHighLevel son premium y **se cobran por uso**
(`server/utils/ghl.ts:12-17`, `.env.example:47-49`). Un preview que reciba tráfico real, o una
prueba de humo que pase por el carrito, genera cobro. Y quien tenga esas URLs puede disparar el
workflow por su cuenta (`ghl.ts:52-55`): trátalas como secretos, no como configuración.

**Qué se rompe si se hace en el orden equivocado:** si mandas el dominio al proyecto nuevo (paso 4)
antes de cargar las variables, el build **pasa en verde** —el módulo de Supabase solo advierte,
`module.mjs:59-60` y `:78-79`— y el sitio queda sirviendo una tienda que se ve perfecta, con
catálogo y fotos, en la que nadie puede pagar ni entrar a su cuenta. Es el peor tipo de falla:
silenciosa y de cara al cliente.

**Matiz que cambia el síntoma por completo:** eso vale cuando la variable **falta**. Si
`SUPABASE_URL` está presente pero **mal escrita** —un dedazo al recapturarla, un `htps://`, un
espacio de más— el módulo no advierte: lanza, y fuera de modo dev **el build sí falla**
(`module.mjs:73-75`). Falta = build verde y sitio roto en vivo; dedazo = build rojo. Si el build
truena con un `Invalid Supabase URL`, ya sabes exactamente qué variable revisar.

### Vuelta atrás del paso 2

Mientras el dominio siga apuntando al proyecto viejo (es decir, hasta el paso 4), el regreso es
trivial: el proyecto viejo sigue sirviendo y basta con no seguir. Después del paso 4 la vuelta atrás
es volver a apuntar el DNS al proyecto viejo, que sigue existiendo, con sus variables y su último
despliegue intactos. **Por eso el proyecto viejo no se toca hasta el final** y por eso el paso 4
exige bajar el TTL antes: es lo que convierte el regreso en minutos en vez de horas. Ten a la mano
el dato de a qué apuntaba el DNS antes (lo fotografías en el paso 4) y quién puede entrar hoy al
proyecto viejo para reasignar el dominio; sin ese acceso, no hay vuelta atrás que valga.

---

## Paso 3 — Supabase

También hay dos caminos, y aquí la diferencia entre uno y otro es grande.

### Opción A: transferir el proyecto a la organización de AMANTI

**Ventajas, y son fuertes:** el proyecto conserva su referencia, así que `SUPABASE_URL` y la llave
anónima no cambian. No hay que migrar un solo renglón. Las sesiones de los clientes que hoy están
dentro siguen vivas. Las llaves foráneas contra `auth.users` —que usan `wishlist_items`
(`supabase/all.sql:24`), `reviews` (`:41`) y `abandoned_carts` (`:66`)— quedan intactas por
definición. Cero ventana de caída. Y, sobre todo, **no te obliga a reconstruir un esquema que el
repositorio no tiene**.

**Riesgo:** es una operación de cuenta, no de base de datos: mueve la facturación y requiere que
ambas organizaciones existan y estén de acuerdo. **Sin verificar desde el repo:** si el plan actual
del proyecto admite la transferencia.

### Opción B: proyecto nuevo y migrar los datos

#### Riesgo uno, y es un bloqueante: el repositorio no contiene el esquema completo

Los archivos de `supabase/` solo **crean** cuatro tablas: `leads` (`all.sql:9`), `wishlist_items`
(`:22`), `reviews` (`:39`) y `abandoned_carts` (`:64`).

**Cinco tablas más se usan y ninguna se crea:**

| Tabla | Cómo aparece en `supabase/` | Dónde la usa el código |
|---|---|---|
| `orders` | Solo `alter table`: `all.sql:61`, `orders-gift.sql:10`, `orders-envio.sql:10`, `:13`; y como destino de una llave foránea en `resenas-invitado.sql:20` | `server/utils/orders.ts:129`, `:151`, `:169`; `server/api/pedidos.get.ts:30`; `server/api/mp-webhook.post.ts:106`; `components/account/AccountOrders.vue:56` |
| `order_items` | **No aparece en ningún `.sql`** | `server/utils/orders.ts:148`; `server/api/mp-webhook.post.ts:120` |
| `addresses` | Solo `alter table`: `addresses-colonia.sql:19` | `server/utils/orders.ts:23`; `components/account/AccountAddresses.vue:33`, `:90-123` |
| `coupons` | **No aparece en ningún `.sql`** | `server/utils/orders.ts:49`, `:55`, `:99`; `server/api/coupon-validate.post.ts:19` |
| `profiles` | **No aparece en ningún `.sql`** (grep de «profiles» sobre `supabase/`: 0 coincidencias) | `components/account/AccountProfile.vue:23` (lee `email, full_name, phone`) y `:47` (actualiza `full_name`, `phone`, `updated_at`) |

**No puedes reconstruir la base desde el repositorio.** La única fuente es un volcado de la base
viva, y por eso el paso 0 lo pide antes que nada.

`profiles` es el caso más traicionero de los cinco, porque además de la tabla faltan dos cosas que
tampoco están en el repositorio:

- **El trigger sobre `auth.users` que crea la fila de `profiles`.** No existe en ningún archivo
  (`grep` de `create trigger` / `on auth.users` / `handle_new_user` sobre todo el repo: cero
  resultados), y sin embargo el código lo da por hecho: `composables/useAuth.ts:10` documenta que
  los metadatos del registro van a `raw_user_meta_data (full_name, phone)` **«que usa el trigger»**.
  Sin ese trigger, cada usuario nuevo se registra bien y su perfil queda vacío para siempre.
- **Las políticas RLS**, que es el siguiente riesgo.

#### Riesgo dos: cuatro tablas se tocan desde el navegador y sus políticas no están en el repo

Esto no es un detalle de configuración: es la única cosa que separa «el panel de cuenta funciona» de
«cualquiera lee los datos de todos».

Cuatro tablas se leen y se escriben **desde el navegador, con la llave anónima**, no desde el
servidor:

| Tabla | Desde dónde | Qué hace |
|---|---|---|
| `profiles` | `components/account/AccountProfile.vue:23`, `:47` | Lee y actualiza el perfil del usuario |
| `addresses` | `components/account/AccountAddresses.vue:33`, `:90-123` | Lista, inserta, actualiza y borra direcciones |
| `orders` | `components/account/AccountOrders.vue:56` | Lista los pedidos del usuario con sus `order_items` |
| `reviews` | `pages/tienda/[slug].vue:37` (lectura pública) y `:103` (alta con sesión) | Reseñas de la ficha de producto |

De esas cuatro, **solo `reviews` tiene sus políticas escritas en el repositorio**
(`supabase/all.sql:49-57`: lectura pública `using (true)` e insert/update/delete solo del dueño).
Las de `profiles`, `addresses` y `orders` **no existen en ningún `.sql`** y hay que sacarlas del
volcado.

Los dos modos de fallar son opuestos y los dos son graves:

- **Sin políticas, con RLS activo:** el panel de cuenta se rompe entero. El usuario entra, y su
  perfil, sus direcciones y sus pedidos aparecen vacíos o con «no se pudo cargar»
  (`AccountProfile.vue:28`, `AccountAddresses.vue:38`, `AccountOrders.vue:60`). Sin error en
  servidor, sin nada en los logs de Vercel.
- **Con RLS apagado o con políticas mal escritas:** los datos de todos los clientes quedan legibles
  con la llave anónima, que es pública por diseño y va en el bundle del navegador. Domicilios,
  teléfonos e historial de compras.

El contraste vale la pena verlo, porque el proyecto ya decidió esto con cuidado en las tablas que sí
están documentadas: `abandoned_carts` tiene RLS activo **y a propósito ninguna política**
(`supabase/abandoned-carts.sql:23-24`, `all.sql:74-75`), porque solo el servidor la toca con la
`service_role`, que se salta RLS. Y `resenas-invitado.sql:9-13` explica por qué **no** se abrió una
política a `anon` para las reseñas de invitado: ese camino entra por `/api/resena`, que verifica
firma y compra antes de escribir con la llave de servicio. «Abrirla aquí sería dejar la puerta que
el endpoint justamente está cuidando.» Ese es el criterio a respetar al recuperar las políticas
faltantes.

#### Riesgo tres: todos los clientes con sesión abierta se salen

El módulo de Supabase deriva el nombre de la cookie de sesión del hostname del proyecto
—`sb-<referencia>-auth-token`, `node_modules/@nuxtjs/supabase/dist/module.mjs:63`—. Referencia
nueva, cookie nueva, sesiones viejas al bote.

#### Riesgo cuatro: los identificadores de usuario

Migrar `auth.users` arrastra hashes de contraseña e identificadores. Si los identificadores cambian,
los pedidos históricos se quedan huérfanos de su dueño: `orders.user_id`, `addresses.user_id` y
`reviews.user_id` dejan de casar con nadie.

**Recomendación: opción A.** Si por lo que sea hay que ir por la B, hazla con el sitio en
mantenimiento y con el volcado verificado —restaurado en un proyecto de prueba y comprobado, con el
panel de cuenta abierto y funcionando— **antes** de mover el tráfico.

### Qué `.sql` correr, y en qué orden

El repositorio trae ocho archivos en `supabase/` y el orden no es indistinto. Esta es la secuencia
para un proyecto nuevo:

| # | Archivo | Qué hace | Por qué va aquí |
|---|---|---|---|
| 0 | *(del volcado, no del repo)* | Crea `orders`, `order_items`, `addresses`, `coupons` y `profiles`, el trigger de `auth.users` y las políticas RLS | Nada de lo que sigue funciona sin esto: los pasos 4, 5 y 6 hacen `alter table` sobre tablas que tienen que existir |
| 1 | `all.sql` | `leads`, `wishlist_items`, `reviews`, `abandoned_carts`, sus políticas y sus índices, más `orders.gift` | Es el «todo en uno» y es **idempotente** (`all.sql:2-4`): se puede correr varias veces |
| 2 | `wishlist.sql`, `reviews.sql`, `abandoned-carts.sql`, `orders-gift.sql` | **No hace falta correrlos.** Son los archivos originales, uno por función, y `all.sql` ya los contiene completos | Están por historia. Correrlos no rompe nada (`create table if not exists`, `drop policy if exists`), simplemente es redundante |
| 3 | `orders-envio.sql` | `orders.shipped_at` y `orders.tracking` | Aditivo y repetible (`:7-8`). Necesita `orders` |
| 4 | `resenas-invitado.sql` | `reviews.user_id` deja de ser obligatorio, `reviews.order_id` con llave foránea a `orders`, e índice único parcial | Necesita **`reviews` y `orders` ya creadas**: `:20` referencia `public.orders(id)`. Va después de `all.sql` y del volcado, nunca antes |
| 5 | `addresses-colonia.sql` | `addresses.colonia` | Necesita `addresses`. Y trae la advertencia de abajo |

**La advertencia que el propio archivo escribe** (`supabase/addresses-colonia.sql:10-13`): «corre
esto **ANTES** de desplegar el código que usa la columna». La lectura del panel hace `select('*')` y
aguanta sin la columna, pero el alta de direcciones y el snapshot del pedido la nombran
explícitamente y sin ella fallan. Traducido al traspaso: **primero el SQL, después el despliegue**.
Nunca al revés.

Dato de apoyo: `BITACORA.md:870` registra que `orders-envio.sql` y `resenas-invitado.sql` ya se
corrieron en la base de producción, así que en la opción A no hay nada que hacer; en la opción B, el
volcado ya los trae aplicados y estos pasos son solo la red por si reconstruyes a mano.

### Lo que hay que reconfigurar a mano si se crea un proyecto nuevo

Nada de esto está en el repositorio y todo se necesita:

- **Site URL y lista blanca de URLs de redirección.** El código manda a Supabase el origen del
  navegador tal cual: `emailRedirectTo` en el registro (`composables/useAuth.ts:15`), `redirectTo`
  en el login con Google (`:26`) y en el correo de recuperación de contraseña (`:35`), todos armados
  con `window.location.origin` (`:8`). Si `https://amanti.mx` no está en la lista blanca del
  proyecto nuevo, la confirmación de correo y el «olvidé mi contraseña» **fallan sin mensaje útil**.
- **El proveedor de Google (OAuth).** El comentario de `composables/useAuth.ts:22` dice que Google
  «ya está habilitado en el dashboard»: eso es configuración de panel, con sus credenciales, y no
  viaja.
- **El trigger de `auth.users` y las políticas RLS**, por lo explicado arriba.
- Plantillas de correo, SMTP y los respaldos automáticos. **Sin verificar desde el repo.**

**Qué no hay que migrar:** Storage. No se usa —ni una llamada a `.storage` en todo el código—
porque las fotos son estáticas y viajan en el repositorio.

**Qué se rompe si se hace en el orden equivocado:** si cambias `SUPABASE_URL` y `SUPABASE_KEY` en
Vercel antes de que el proyecto nuevo tenga datos y esquema, el sitio queda en pie pero cada pedido
nuevo se escribe en una base vacía y los históricos desaparecen de `/pedidos`. Y al revés: si migras
los datos y no cambias las variables, el sitio sigue escribiendo en la base vieja y todo lo que se
venda durante esa ventana se pierde al apagarla.

### Vuelta atrás del paso 3

La red de seguridad no es «no borres el proyecto viejo»: eso es una precaución. El procedimiento es
éste, y hay que tenerlo escrito **antes** de empezar, no improvisado a las once de la noche.

1. **Antes de migrar:** deja el proyecto viejo intacto, corriendo, con su facturación al día y con
   acceso confirmado de al menos dos personas. Anota su referencia (la que aparece en
   `SUPABASE_URL`) en un lugar que no sea el panel.
2. **Ventana de escritura dividida.** Entre el momento en que la base nueva recibe el volcado y el
   momento en que Vercel apunta a ella, cualquier pedido que entre se escribe en la base vieja y
   **no** está en el volcado. Por eso la opción B se hace con el sitio en mantenimiento: para que
   esa ventana esté vacía. Si no puedes poner mantenimiento, anota la hora exacta del volcado y
   cuenta manualmente los pedidos creados después, para reinyectarlos.
3. **Para revertir:** vuelve a poner en Vercel las variables `SUPABASE_URL`, `SUPABASE_KEY` y
   `SUPABASE_SERVICE_ROLE_KEY` del proyecto viejo **y redespliega** (`BITACORA.md:867-868`: sin
   despliegue nuevo no entran). El sitio vuelve a escribir en la base vieja de inmediato. Lo que
   pierdes es lo que se haya escrito en la base nueva durante la ventana, así que si ya hubo ventas
   ahí, hay que copiarlas a mano antes de revertir.
4. **Lo que no se revierte:** las sesiones. Si los clientes ya fueron expulsados por el cambio de
   referencia (`module.mjs:63`), volver atrás los vuelve a expulsar. Es un costo que se paga dos
   veces, y es otra razón para preferir la opción A.

---

## Paso 4 — El dominio y el DNS

Este paso va al final de la parte técnica a propósito: es el único que mueve tráfico real de
clientes. Se hace cuando el proyecto nuevo ya tiene un despliegue de producción exitoso, con todas
las variables cargadas y probado por su URL de Vercel.

Lo que el repositorio confirma: el dominio canónico es `https://amanti.mx` (`nuxt.config.ts:116`,
`.env.example:32`).

**Lo que se verificó consultando el DNS público el 18/09/2026** (no hace falta acceso a ningún
panel para esto; cualquiera lo puede repetir con `dig` o con `https://dns.google/resolve`):

| Registro | Valor | Qué es |
|---|---|---|
| NS de `amanti.mx` | `ns1.dns-parking.com`, `ns2.dns-parking.com` | Los servidores de nombres son de **Hostinger**. Ahí se editan los registros, no en Wix ni en Vercel |
| A de `amanti.mx` | `76.76.21.21` | La IP de Vercel. Es lo que hace que el dominio sirva el sitio |
| CNAME de `link.amanti.mx` | `brand.ludicrous.cloud` | **GoHighLevel.** Ver abajo: se olvida siempre |
| TXT de `amanti.mx` | `v=spf1 include:zohomail.com ~all` y una verificación de Zoho | El correo del dominio raíz (`contacto@…`) sale por **Zoho Mail** |
| TXT de `mail.amanti.mx` | `v=spf1 include:spf.leadconnectorhq.com include:mailgun.org ~all` | El subdominio por el que GoHighLevel manda los correos de marketing, vía Mailgun |
| TXT de `_dmarc.amanti.mx` | **No existe** | Falta el DMARC. Ver `12-pendientes-y-riesgos.md` |

Además, el 28 de agosto se verificaron en `mail.amanti.mx` la llave DKIM (`mx._domainkey`), los MX
de Mailgun y un CNAME `email.mail.amanti.mx` hacia Mailgun; y en la raíz, la llave DKIM de Zoho
(`zmail._domainkey`). Son registros que **no se ven desde el sitio ni desde el repo** y que, si se
pierden al mover la zona, dejan de entregar correo sin ningún aviso.

Registrador del `.mx`, a nombre de quién está la cuenta de Hostinger, y si el dominio está dado de
alta en Vercel como ápice, como `www` o como ambos: **sin verificar**; se confirma en los paneles.

### Antes de tocar un solo registro

1. **Fotografía la zona completa.** Exporta o captura todos los registros como están hoy. Es lo
   único que te va a permitir revertir, y es la misma fotografía que necesitan las vueltas atrás de
   los pasos 2 y 3.
2. **Baja el TTL** de los registros que vas a mover, y espera a que el TTL viejo caduque antes de
   cambiar nada. Así, si algo sale mal, el regreso tarda minutos y no horas.

### El registro que depende de un tercero y se olvida siempre

**`link.amanti.mx` no apunta a Vercel: apunta a GoHighLevel.** De ahí se sirve el formulario de
newsletter —el del modal y el del pie— como un iframe, más el script que lo mide
(`components/NewsletterForm.vue:28`, `:43`; visto también en producción, `BITACORA.md:70`).

Si migras de proveedor de DNS y reconstruyes la zona a mano sin ese registro, el formulario deja de
cargar: el iframe se queda en blanco. Y no basta con que cargue el iframe; el script `form_embed.js`
es el que le manda el alto real al marco, porque el alto que declara el formulario no alcanza para
su propio contenido y **sin él el botón de enviar queda cortado y nadie puede suscribirse**
(`components/NewsletterForm.vue:12-16`). Es decir, hay un estado intermedio en el que el formulario
«se ve» y no sirve.

**La zona tiene registros de correo de dos proveedores distintos** (Zoho para la raíz, Mailgun vía
GoHighLevel para `mail.`), según la tabla de arriba. Si se pierden al migrar, el correo del dominio
deja de entregarse en silencio. Si además hay verificaciones de propiedad de Google, Meta u otros,
se caen igual de callado. La regla es sencilla: **todo registro que no entiendas, cópialo igual.**
Lo más seguro es **no mover el DNS de Hostinger**: basta con que la cuenta de Hostinger quede a
nombre de AMANTI y con cambiar el registro A si el proyecto de Vercel cambia de IP (no suele pasar:
`76.76.21.21` es compartida por todos los proyectos de Vercel).

### El orden que no tumba el sitio

1. El proyecto nuevo ya sirve correctamente por su URL de Vercel.
2. Agrega `amanti.mx` (y `www`, si hoy existe) al proyecto nuevo y completa la verificación que pida
   Vercel.
3. Cambia el registro DNS para que apunte al proyecto nuevo.
4. Espera la propagación y verifica.
5. **Solo entonces** quita el dominio del proyecto viejo.

**Qué se rompe si se hace en el orden equivocado:** si quitas el dominio del proyecto viejo antes de
tenerlo listo en el nuevo, hay una ventana —de minutos u horas, según el TTL— con el sitio caído en
plena hora de venta. **Sin verificar desde el repo:** si Vercel permite que dos proyectos reclamen
el mismo dominio a la vez; si no lo permite, la ventana es inevitable y hay que programarla de
madrugada y avisarle a Raúl y a Nancy.

---

## Paso 5 — Las integraciones y las cuentas de terceros

Mover la infraestructura no cambia el dominio, así que casi todo sobrevive. Casi. Y hay una
distinción que este paso existe para dejar clara: **hay cosas que son configuración del sitio y
cosas que son recursos que viven dentro de la cuenta de otra persona.** Las primeras se copian; las
segundas hay que transferirlas o volver a crearlas, y ninguna variable de entorno te va a avisar de
eso.

### El webhook de la pasarela de pago: la trampa cara

El sitio le dice a Mercado Pago a dónde notificar en cada preferencia de pago, armando la URL sobre
la marcha: `${base}/api/mp-webhook` (`server/api/checkout.post.ts:129`), donde `base` sale de
`baseParaPasarela()`. Eso sigue solo al dominio, sin intervención. Igual las URLs de retorno del
cliente (`checkout.post.ts:130-134`).

El problema es el otro lado. El endpoint valida la firma HMAC de cada notificación **si hay secreto
configurado** y rechaza con HTTP 401 todo lo que no cuadre (`server/api/mp-webhook.post.ts:66-79`).
Ese secreto lo genera el panel de Mercado Pago (`mp-webhook.post.ts:10-12`) y llega por
`NUXT_MP_WEBHOOK_SECRET`.

**Lee la línea 66 con cuidado, porque es la que decide todo:** `if (secret && !isTest) {`. Toda la
validación está dentro de ese `if`. Con `NUXT_MP_WEBHOOK_SECRET` **vacía o ausente el endpoint no
valida ninguna firma y acepta cualquier POST**, que es exactamente el estado en el que queda un
proyecto nuevo mientras no se carga esa variable. El daño está acotado porque el sitio no le cree al
payload: reconsulta el pago directo en la API de Mercado Pago con `NUXT_MP_ACCESS_TOKEN` antes de
tocar el pedido (`mp-webhook.post.ts:82-97`, y el comentario de `:3-5` lo dice explícitamente). Pero
no es un estado en el que se deba dejar producción, y sobre todo: **no confundas «falta la variable»
con «el webhook está roto». Falta la variable = el webhook está abierto.**

**Advertencia — esto cobra y no entrega:** si se rota el secreto en el panel de MP sin actualizar la
variable en Vercel, pasa lo contrario y es peor: el cliente paga, el cargo se hace de verdad, la
notificación llega, el sitio la rechaza con 401 (`:71`, `:78`), el pedido se queda en `pending` para
siempre, GoHighLevel nunca se entera y **Nancy nunca ve el pedido que ya está cobrado**. No hay
error visible para el cliente ni alerta para nadie. La regla: el secreto del panel y la variable de
Vercel se cambian en la misma ventana, y acto seguido se hace una compra real de prueba (paso 6).

### Si se transfiere la cuenta de Mercado Pago (o de Stripe)

Esto no es solo cambiar dos variables. El pedido lo crea el sitio en estado `pending` antes de
mandar al cliente a pagar (`server/utils/orders.ts:129-140`, `stripe-checkout.post.ts:1-2`), y quien
lo mueve de `pending` a `paid` es el webhook, que necesita el token **de la cuenta que cobró**
(`mp-webhook.post.ts:87-91`). Así que hay una ventana en la que un pedido puede haberse cobrado con
la cuenta vieja y estar esperando una notificación que solo la cuenta vieja puede confirmar.

Procedimiento, en este orden:

1. **Congela el punto de partida.** Anota qué pedidos están en `pending` justo antes de empezar
   (`/pedidos` con el PIN, o una consulta directa a `orders`). Esa es tu lista de reconciliación.
2. **No inicies la ventana con carrito caliente.** Elige una hora de bajo tráfico; cada compra que
   entre durante la ventana engorda la lista del punto 1.
3. **Token y secreto se cambian juntos.** `NUXT_MP_ACCESS_TOKEN` y `NUXT_MP_WEBHOOK_SECRET` son un
   par: el primero es lo que le permite al sitio verificar el pago, el segundo lo que le permite
   confiar en la notificación. Cambiar uno sin el otro produce las dos fallas de arriba. Cárgalos en
   Vercel **y redespliega** (`BITACORA.md:867-868`), porque si no, el sitio sigue con los viejos.
4. **Registra la URL del webhook en el panel nuevo.** El registro no viaja con la cuenta: es un
   ajuste del panel de MP (`mp-webhook.post.ts:10-12`). Hay un detalle útil aquí: al registrar la
   URL, MP la valida con un GET, y para eso existe `server/api/mp-webhook.get.ts`, que responde 200
   y **a propósito no procesa nada** (`mp-webhook.get.ts:8-11`). Si ese archivo se pierde, el panel
   de MP no deja avanzar el registro.
5. **Reconcilia la lista del punto 1.** Los pedidos que quedaron `pending` con la cuenta vieja no se
   van a resolver solos: la notificación, si llega, llega con el secreto viejo. Hay que verificarlos
   a mano contra el panel de MP y marcarlos. Ojo con el candado del código: la transición a `paid`
   solo se acepta desde `pending` o `cancelled` (`mp-webhook.post.ts:36-40`) y nunca se marca `paid`
   un pedido sin artículos (`:119-125`). Eso protege, pero también significa que un pedido mal
   arreglado a mano se puede quedar atorado.
6. **Stripe es el mismo guion**, con `NUXT_STRIPE_SECRET_KEY` y `NUXT_STRIPE_WEBHOOK_SECRET`, y con
   el endpoint registrado a mano en el panel, incluidos los cinco eventos que lista
   `server/api/stripe-webhook.post.ts:9-13`. Con una diferencia de urgencia: hoy el botón de tarjeta
   está oculto por omisión, porque `NUXT_PUBLIC_STRIPE_ENABLED` viene vacío (`nuxt.config.ts:119-120`).
   Confirma en el panel de Vercel si en producción está encendido antes de decidir cuánta prisa
   tiene esto.

**Sin verificar desde el repo:** si las cuentas de Mercado Pago y de Stripe están a nombre de AMANTI
o de un tercero, y qué permite cada plataforma en materia de transferencia de cuenta. Es lo primero
que hay que preguntar, porque si no se pueden transferir, lo que toca es abrir cuentas nuevas y
entonces la ventana del punto 5 es real y hay que planearla.

### GoHighLevel: no es solo un registro de DNS

El paso 4 cubre que `link.amanti.mx` apunte a GHL. Eso es necesario y no es suficiente. Lo que vive
del lado de GHL, dentro de una sub-cuenta que hoy administra César:

- **El formulario de newsletter**, identificado por `FORM_ID` en `components/NewsletterForm.vue:26`
  y servido desde `link.amanti.mx/widget/form/<id>` (`:43`). El componente explica su historia
  (`:1-25`): sustituyó a la captura en la tabla `leads` de Supabase y al `mailto` del pie,
  precisamente para que los correos entren a GHL y de ahí salgan los flujos. **Si esa sub-cuenta se
  va, el DNS puede quedar perfecto y el formulario seguir muerto**, porque el recurso al que apunta
  ya no existe.
- **Los workflows** detrás de `NUXT_GHL_WEBHOOK_POSTCOMPRA`, `NUXT_GHL_WEBHOOK_CARRITO_ABANDONADO`,
  `NUXT_GHL_WEBHOOK_AVISO_PEDIDO` y `NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` (`server/utils/ghl.ts:57-63`).
  El código declara un quinto, `NUXT_GHL_WEBHOOK_REACTIVACION`, pero ningún código emite ese evento:
  no hay nada que mover ahí.
  El código las trata como lo que son: una URL distinta por automatización, porque GHL no da un
  webhook global (`ghl.ts:7-10`). **No las trates como secretos a copiar y ya.** Son direcciones de
  recursos que viven en una cuenta ajena: si la cuenta cambia de manos o se cierra, las URLs dejan
  de servir y el sitio no se entera —`emitirEventoGhl` nunca lanza y devuelve `false` en silencio
  (`ghl.ts:25-29`, `:105-109`)—.

Preguntas que hay que resolver con César **antes** de mover el DNS, no después: de quién es la
sub-cuenta de GHL, si se transfiere o hay que rehacer los workflows en una cuenta de AMANTI, y qué
pasa con los contactos ya capturados por el formulario. **Sin verificar desde el repo:** todas.

### Lo demás, con su nivel de urgencia

| Integración | Dirección | Qué revisar después del traspaso |
|---|---|---|
| Chat EROS en n8n | El sitio llama a n8n (`server/api/chat.post.ts:7`) | La URL por omisión está escrita en `nuxt.config.ts:99` y apunta a una cuenta de n8n de un tercero. Si esa cuenta desaparece, el chat degrada con gracia y sigue contestando con el mensaje de respaldo (`chat.post.ts:15`, `:29-32`), así que la falla es silenciosa. **Sin verificar desde el repo:** de quién es esa cuenta |
| Feed de Google Merchant | Google lee `/feeds/google.xml` | Arma los enlaces absolutos con el dominio **desde el que se sirve la petición** (`server/routes/feeds/google.xml.get.ts:15-16`), así que sobrevive mientras el dominio sobreviva. **Sin verificar desde el repo:** qué URL tiene registrada Merchant Center |
| GA4, Google Ads, Clarity, Meta Pixel | El navegador los carga | Los identificadores están escritos en el código (`plugins/tracking.client.ts:14-17`), así que el traspaso de infraestructura no los toca. El traspaso de las **cuentas** de Google Ads y Merchant Center es harina de otro costal y lo lleva Emilio (`00-LEEME-PRIMERO.md`, «Quién es quién»). Ojo con GA4, que sí es de este traspaso: la propiedad está bajo una cuenta personal del saliente (`15-checklist-de-paneles.md`) |

---

## Rotación de secretos

Es parte del traspaso, no un extra. Todo valor que haya estado cargado en el proyecto viejo se
cambia. La razón técnica es simple y ya quedó dicha en el paso 0: la `SUPABASE_SERVICE_ROLE_KEY` se
salta RLS y sigue funcionando desde cualquier máquina hasta que se rote en el panel.

**Regla que aplica a todos:** en Vercel una variable nueva **no entra en vigor hasta que hay un
despliegue nuevo** (`BITACORA.md:867-868`). Rotar sin redesplegar te deja el valor nuevo en el panel
y el viejo en ejecución.

Orden sugerido, de menos a más riesgo:

| # | Secreto | Dónde se rota | Qué pasa al rotarlo |
|---|---|---|---|
| 1 | `NUXT_PEDIDOS_PIN` | Solo en Vercel | El PIN viejo deja de servir de inmediato (`pedidos.get.ts:17-18`). Sin dependencias externas. Avísale a Nancy antes, no después |
| 2 | `NUXT_N8N_CHAT_WEBHOOK` | Cuenta de n8n + Vercel | Si queda mal, el chat degrada solo y contesta el mensaje de respaldo (`chat.post.ts:29-32`). Es el más indulgente |
| 3 | `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_KEY` | Panel de Supabase + Vercel | Corta el acceso de cualquier copia vieja. **Es el que de verdad cierra la puerta.** Redespliega de inmediato: sin la de servicio, todo pago devuelve 500 (`supabaseAdmin.ts:13-19`) |
| 4 | `NUXT_MP_ACCESS_TOKEN` + `NUXT_MP_WEBHOOK_SECRET` | Panel de MP + Vercel | **Los dos en la misma ventana**, por lo explicado en el paso 5. Prueba con una compra real de monto bajo antes de darlo por bueno |
| 5 | `NUXT_STRIPE_SECRET_KEY` + `NUXT_STRIPE_WEBHOOK_SECRET` | Panel de Stripe + Vercel | Igual que MP. Menos urgente si el botón de tarjeta sigue oculto |
| 6 | Las cinco `NUXT_GHL_WEBHOOK_*` | Panel de GHL (César) + Vercel | Regenerar una URL en GHL invalida la vieja. Coordinado con César, porque son sus workflows. Mientras están desfasadas, el evento se pierde **en silencio** (`ghl.ts:91`, `:105-109`) |
| 7 | `NUXT_RESENA_SECRET` | Solo en Vercel | El único con costo visible. Ver abajo |

**`NUXT_RESENA_SECRET` merece su párrafo.** Firma los enlaces de reseña que van dentro de los
correos del día 10 (`server/utils/resenaToken.ts:39-43`, `:67-71`); al cambiar el valor, **todos los
enlaces ya enviados y todavía sin usar dejan de validar** y el cliente aterriza en la ficha sin
permiso para opinar. No es razón para no rotarlo —hay que rotarlo— pero sí para hacerlo a sabiendas,
de preferencia en un momento en que no acabe de salir una tanda de correos, y coordinado con César.

**Lo que no es una variable y también hay que cerrar:** accesos de personas. GitHub (colaboradores y
propietarios), equipo de Vercel, organización de Supabase, y el `.env` que viva en cualquier carpeta
de trabajo. Los primeros tres se revisan en la verificación del paso 6; el último deja de importar
en cuanto el punto 3 de esta tabla esté hecho.

---

## Paso 6 — Cómo correrlo, cómo probarlo y cómo verificar

### Antes de nada: `SETUP.md` está desactualizado

El repositorio tiene un `SETUP.md` en la raíz, y es la primera cosa que un desarrollador nuevo va a
abrir. **No lo leas como verdad**: describe el proyecto de sus primeras semanas —habla de cupones
que ya no existen, dice que no hay descuentos por producto cuando hay una campaña global encendida,
y llama «stub» a la página de cuenta, que hoy es funcional (`00-LEEME-PRIMERO.md`, «Los otros dos documentos del repo»)—.
Y su tabla de variables lista once de las 22, con lo que hereda el mismo hueco que `.env.example`.

Lo que sí sigue siendo válido de ahí es la mecánica básica (`SETUP.md:11-24`), que coincide con
`package.json:6-13`:

```
npm install
npm run dev                      # desarrollo, http://localhost:3000
npm run build                    # build de producción
node .output/server/index.mjs    # corre el build
```

### Las pruebas

`package.json:11-13` define tres:

| Comando | Qué corre | Qué toca |
|---|---|---|
| `npm run test:unit` | Vitest sobre `test/unit/**` y `test/smoke/**` (`vitest.config.ts:12`) | Nada externo. Es el que puedes correr sin miedo |
| `npm run test:e2e` | Playwright sobre `test/e2e/` (`playwright.config.ts:11`) | **Escribe en Supabase.** Ver la advertencia |
| `npm test` | Los dos, en ese orden (`package.json:11`) | Hereda la advertencia |

Referencia de cómo se veían el día del corte: **268 pruebas unitarias en verde, 26 archivos**, con
`npx vitest run --pool=threads --no-file-parallelism`, unos 30 segundos
(`00-LEEME-PRIMERO.md`, «Estado verificado»).

**Advertencia grande: los e2e escriben en la base con la llave de servicio. No se corren contra
producción.** No es una suposición, está en el código: `test/e2e/orders.spec.ts:17-22` crea un
usuario con `auth.admin.createUser` e **inserta un pedido de sonda** en `orders` para averiguar si
`user_id` admite nulos, y `test/e2e/coupons.spec.ts:25-34` **borra e inserta cupones** con prefijo
`QA`. Si `SB_URL` y `SB_SVC` apuntan a producción, eso pasa en producción: pedidos fantasma en la
pantalla de Nancy y cupones de prueba en la base de verdad.

Dos salvaguardas que ya existen y conviene conocer, porque explican por qué la suite no truena sola:
los specs se saltan enteros si faltan `SB_URL`/`SB_ANON`/`SB_SVC` (`orders.spec.ts:14`,
`coupons.spec.ts:17`), y el servidor de pruebas se levanta con `NODE_ENV: 'test'` y un token de MP
inválido a propósito, para que la llamada a Mercado Pago falle y el pedido se quede en `pending`
(`playwright.config.ts:37-50`). **Corre los e2e contra un proyecto de Supabase desechable, nunca
contra el de la tienda.**

### La lista de verificación final

El traspaso se declara terminado cuando **todas** estas líneas están en verde. Antes no.

| # | Comprobación | Qué demuestra |
|---|---|---|
| 1 | `git remote -v` apunta a la organización de AMANTI y el desarrollador nuevo puede empujar con sus credenciales | El repositorio ya está bajo control de AMANTI |
| 2 | Nadie del proveedor saliente aparece en GitHub, ni en el equipo de Vercel, ni en la organización de Supabase | El corte es real |
| 3 | Un commit a `master` genera un despliegue de **producción** (no de preview) en el equipo nuevo | La rama de producción quedó bien puesta |
| 4 | `vercel env ls production` lista las 22 variables de la tabla del paso 0 —o las que se hayan decidido a sabiendas—, con la cuenta nueva | No se perdió configuración |
| 5 | `/`, `/tienda`, una ficha de producto, `/carrito` y `/feeds/google.xml` responden HTTP 200 | El sitio sirve |
| 6 | `/pedidos` con el PIN muestra los pedidos históricos | `SUPABASE_SERVICE_ROLE_KEY` y `NUXT_PEDIDOS_PIN` bien cargadas, y la base tiene los datos |
| 7 | Crear una cuenta nueva y confirmar el correo funciona | Supabase Auth y la lista blanca de redirección |
| 8 | Entrar con Google funciona | El proveedor OAuth quedó configurado |
| 9 | Con esa cuenta nueva: **el perfil carga y se guarda**, se puede **agregar una dirección** y el historial de pedidos no marca error | La tabla `profiles`, el trigger de `auth.users` y las políticas RLS de `profiles`, `addresses` y `orders` (`AccountProfile.vue:23`, `:47`; `AccountAddresses.vue:33`, `:90-123`; `AccountOrders.vue:56`) |
| 10 | Con **otra** cuenta, el panel muestra sus propios datos y no los de la primera | Las políticas RLS aíslan por usuario y no quedaron abiertas |
| 11 | El formulario de newsletter del pie carga **y se le ve el botón de enviar** | `link.amanti.mx` sobrevivió al DNS y el script de GHL está cargando |
| 12 | Una compra real de monto bajo pasa a `paid` en Supabase | El webhook de Mercado Pago, su secreto y la llave de servicio, los tres a la vez |
| 13 | El carrito cobra el envío que corresponde | `NUXT_ENVIO_COSTO` y `NUXT_PUBLIC_ENVIO_COSTO` con el mismo valor |
| 14 | `npm run test:unit` pasa completo en la máquina del desarrollador nuevo | El entorno local quedó bien montado |
| 15 | La carpeta local de trabajo ya no tiene `.vercel/` del proyecto viejo | Nadie va a desplegar por accidente al proyecto del proveedor saliente |
| 16 | Las llaves de Supabase ya se rotaron | Los `.env` que sigan existiendo en cualquier carpeta de trabajo ya no sirven para nada |

Sobre la línea 12: **hazla con una compra real de monto bajo y reembólsala**, no con una prueba
sintética. Es la única forma de ejercitar la cadena completa —cargo, firma, webhook, estado del
pedido, aviso a quien surte—, y en este proyecto ya quedó demostrado que un pedido real vale más que
cualquier simulación (`BITACORA.md:595-599`). Ten presente que esa compra **dispara los workflows de
GoHighLevel y eso se cobra** (`ghl.ts:12-17`); es dinero bien gastado, pero que no te tome por
sorpresa y no la repitas en bucle.

### Lo último, y sin prisa

**No borres el proyecto viejo de Vercel ni el proyecto viejo de Supabase el mismo día.** Déjalos
apagados pero existentes por lo menos dos semanas, con los datos intactos y la facturación al día.
Si aparece algo que no se migró, esa es tu única salida; una vez borrados, no hay vuelta atrás. Es
una precaución, no un procedimiento: los procedimientos de regreso están en «Vuelta atrás» de los
pasos 2, 3 y 4.

---

## Sin verificar desde el repositorio

Todo lo de esta lista hay que confirmarlo en el panel que corresponda. Está marcado como hueco a
propósito: es preferible a un dato inventado.

- Bajo qué organización de Supabase vive el proyecto, y si su plan admite transferencia.
- Quién es el registrador de `amanti.mx`, a nombre de quién está la cuenta de Hostinger, y cómo
  está dado de alta el dominio en Vercel (ápice, `www`, o ambos).
- Los TTL actuales de la zona y si hay verificaciones de propiedad (Google, Meta) además de los
  registros de correo que ya se listaron en el paso 4.
- Qué se conserva exactamente al transferir un proyecto entre equipos de Vercel con las reglas de
  hoy, y si dos proyectos pueden reclamar el mismo dominio a la vez.
- La versión de Node, los ajustes de build y la configuración de Deployment Protection del proyecto
  de Vercel: `package.json` no declara `engines` y nada de eso está en el repositorio.
- De quién es la sub-cuenta de GoHighLevel, si se transfiere, y qué pasa con el formulario y los
  contactos ya capturados.
- A nombre de quién están las cuentas de Mercado Pago y de Stripe, y si se pueden transferir.
- De quién es la cuenta de n8n a la que apunta el chat.
- Qué URL de feed tiene registrada Google Merchant Center.
- La configuración de panel de Supabase: Site URL, lista blanca de redirecciones, credenciales del
  proveedor de Google, plantillas de correo, SMTP y respaldos automáticos.
- **El esquema de `orders`, `order_items`, `addresses`, `coupons` y `profiles`, el trigger sobre
  `auth.users` y las políticas RLS de `profiles`, `addresses` y `orders`.** No están en el
  repositorio y no se pueden inferir. Salen del volcado de la base viva, y por eso ese volcado es el
  primer paso de todo esto.
