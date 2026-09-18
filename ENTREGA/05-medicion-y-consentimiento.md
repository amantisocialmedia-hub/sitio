# Medición, consentimiento y feed de Google

Esta sección cubre todo lo que el sitio mide, cómo el consentimiento del usuario controla esa
medición, el age gate de +18, cómo se registra una compra en Google Ads, qué es el `gclid` y por qué
viaja en el mensaje de WhatsApp, y el feed de Google Shopping.

Todo lo que se afirma aquí sale de leer el repo. Lo que solo se puede ver entrando a los paneles de
Vercel, Google Ads, Merchant Center, GA4, Clarity o Meta está marcado como **sin verificar desde el
repo**.

---

## 1. Qué rastreadores existen

Los cuatro rastreadores viven en un solo archivo, `plugins/tracking.client.ts`, con los
identificadores escritos a mano como constantes:

| Rastreador | Identificador | Línea | Requiere aceptación |
|---|---|---|---|
| Google Analytics 4 | `G-HE23F0TWMG` | `plugins/tracking.client.ts:14` | No (carga siempre, con consentimiento denegado) |
| Google Ads | `AW-17872915568` | `plugins/tracking.client.ts:15` | No (misma librería `gtag.js`) |
| Microsoft Clarity | `u8nz8w7mf3` | `plugins/tracking.client.ts:16` | **Sí** |
| Meta Pixel | `947187697884149` | `plugins/tracking.client.ts:17` | **Sí** |

Estos ids **no son secretos** y por eso se documentan sin problema: son constantes en un plugin
`.client.ts`, o sea que viajan literales dentro del bundle que se le manda al navegador. Cualquiera
puede leerlos con ver el código fuente de la página. No se leen de ninguna variable de entorno y no
hay nada que rotar aquí.

La acción de conversión de compra de Google Ads es aparte y vive en el composable:
`composables/useAnalytics.ts:7`, con el valor `AW-17872915568/cKhmCNfc4NgcEPCYvMpC`. El comentario
de la línea 5 dice que esa acción la creó Emilio en la cuenta de Ads.

> **⚠️ Primer disparo en el pie: la medición no distingue entornos.** Esos cuatro ids son constantes
> sin ninguna condición de entorno, y el plugin se registra sin mirar dónde está corriendo
> (`plugins/tracking.client.ts:91-100`). Se buscó `import.meta.dev`, `NODE_ENV` e `isDev` en
> `plugins/`, `composables/`, `utils/` y `components/` y **no hay una sola aparición**. Consecuencia
> directa: `npm run dev` en tu máquina y **cualquier preview de Vercel** mandan datos reales a la
> propiedad de producción de GA4, a Clarity, al Pixel y a la cuenta de Ads. Si en un preview
> aceptas cookies y entras a `/carrito?status=success` con el carrito lleno, **disparas la
> conversión de compra de Ads** con datos falsos. No hay flag ni variable para apagarlo: si
> necesitas trabajar sin ensuciar la medición, bloquea `googletagmanager.com` en el navegador (es
> lo que hace el propio e2e en `test/e2e/compliance.spec.ts:9`) o rechaza cookies y no toques la
> página de retorno. Si el proyecto va a crecer, lo primero que vale la pena agregar es una guarda
> de entorno alrededor de `loadGoogle()`.

---

## 2. `gtagPush`: el archivo de 23 líneas que costó semanas de pauta

Antes de tocar nada de medición, lee `utils/gtag.ts` completo. Son 23 líneas y 17 de ellas son
comentario, porque ahí estuvo escondido el error más caro del sitio.

`gtag.js` solo interpreta una entrada del `dataLayer` como comando (`consent`, `config`, `event`…)
cuando esa entrada es un objeto `arguments`. Si le llega un `Array` normal, **lo ignora en
silencio**: el script de Google carga, el `dataLayer` se ve lleno de comandos, no hay un solo error
en consola, y no pasa absolutamente nada. Así estuvo AMANTI hasta el 31-ago-2026: GA4 decía
"todavía no se han recibido datos de tu sitio web" desde el primer día, y la conversión de compra de
Google Ads no registró ninguna de las ventas reales del 27 al 29 de agosto (`utils/gtag.ts:1-17`).

Por eso la función se ve rara:

- Los rest params (`..._args: any[]`) están **solo** para que TypeScript revise las llamadas. Lo que
  de verdad se empuja es `arguments` (`utils/gtag.ts:18-23`).
- **No la conviertas en arrow function.** Las arrow no tienen `arguments`, y el error vuelve
  exactamente igual de mudo.

> **Trampa que tumba la medición completa sin avisar.** Cualquier refactor "de limpieza" sobre
> `utils/gtag.ts` — cambiar a arrow, empujar `[...args]`, "simplificar" — apaga GA4 y las
> conversiones de Ads sin producir un solo error. La delatora es la cookie `_ga`: si no existe aun
> con el consentimiento ya aceptado, el `config` nunca se ejecutó (`utils/gtag.ts:11-13`).

`test/unit/gtag.test.ts` deja clavado ese contrato: verifica que la entrada del `dataLayer` sea
`[object Arguments]` y no un Array (`test/unit/gtag.test.ts:18-23`), que conserve orden y tipos
(`:25-30`), que cree el `dataLayer` si no existe y acumule (`:32-37`), y que respete uno que ya
viniera de antes (`:39-44`). Si ese test se pone rojo, no lo "arregles" cambiando la expectativa.

---

## 3. Consentimiento: cómo está implementado

### La decisión

Vive en una sola cookie, `amanti_cookie_consent`, con dos valores posibles: `'accepted'` o
`'rejected'`. Se escribe en `components/CookieConsent.vue:2-6` con `maxAge` de ~180 días,
`sameSite: 'lax'` y `path: '/'`.

El banner **solo se muestra si la cookie no existe**, y solo después de `onMounted`
(`components/CookieConsent.vue:8-9`). Es cliente puro a propósito: si el banner se renderizara en
SSR, cambiaría el HTML que ve Google y rompería la hidratación.

### Los dos caminos de carga

El plugin `plugins/tracking.client.ts` tiene dos funciones con responsabilidades distintas:

**`loadGoogle()`** (línea 20) corre **siempre**, haya o no consentimiento
(`plugins/tracking.client.ts:95`). Lo que hace:

1. Empuja `consent default` con los cuatro permisos en `'denied'` y `wait_for_update: 500`
   (`:31-37`).
2. Pone `ads_data_redaction: true` y `url_passthrough: true` (`:40-41`). Mientras `ad_storage` esté
   denegado, eso redacta los identificadores de clic y pasa el `gclid` por la URL en lugar de por
   cookie.
3. Hasta entonces inyecta el script de `googletagmanager.com` y manda `js`, `config` de GA4 y
   `config` de Ads (`:43-52`).

> El orden importa y está comentado en el propio código (`:29-30`): el `consent default` tiene que
> entrar al `dataLayer` **antes** de cualquier `config`, o `gtag` alcanza a escribir cookies antes de
> enterarse del estado. No reordenes esas líneas.

**`loadTrackers()`** (línea 56) solo corre cuando el usuario **acepta** — desde el botón del banner
(`components/CookieConsent.vue:14-15`, vía el `provide` de la línea 98 del plugin) o al arrancar si
la cookie ya venía en `'accepted'` (`:96`). Lo que hace:

1. Sube el consentimiento a `'granted'` en los cuatro permisos (`:61-66`).
2. Carga Microsoft Clarity (`:72-76`) y Meta Pixel, con su `PageView` inicial (`:79-88`).

### Por qué Google sí y Clarity/Meta no

Está explicado en el encabezado del archivo (`plugins/tracking.client.ts:3-8`): Google tiene un
estado "denegado" real (Consent Mode v2), así que puede cargar sin guardar cookies ni identificadores
publicitarios, y aun así manda la señal agregada de quien **no** acepta — señal que antes se perdía
completa. Clarity y Meta Pixel no tienen un estado equivalente, y Clarity además graba la sesión
entera, así que esos dos simplemente no se cargan sin aceptación explícita.

### Rechazar no manda nada

`reject()` (`components/CookieConsent.vue:17-20`) solo escribe la cookie y esconde el banner. **No**
empuja un `consent update` a `'denied'`, porque el default ya está en denegado desde `loadGoogle()`.
El e2e lo fija explícitamente: espera exactamente **un** `consent default` y **cero**
`consent update` (`test/e2e/compliance.spec.ts:54`).

### Idempotencia

Dos banderas en `window` evitan cargas dobles: `__amantiGoogleLoaded` (`:22-24`) y
`__amantiTrackingLoaded` (`:68-69`). La segunda está a propósito **después** del `consent update`
(`:61-68`), para que aceptar dos veces vuelva a mandar el `granted` sin re-inyectar los scripts.

### Lo que el e2e garantiza

`test/e2e/compliance.spec.ts` es la prueba de que esto no se rompió. Aborta la red hacia
`googletagmanager.com` para no depender de Google (`:9`) y, tras rechazar, verifica (`:38-70`):

- el `consent default` tiene los cuatro permisos en `denied` (`:57-62`);
- el default entró **antes** de `js`/`config` (`defaultAntesDeConfig`);
- hay exactamente un default y cero updates;
- `window.clarity` y `window.fbq` son `undefined`;
- y lo mismo **después de recargar** (`:68-70`), porque la rama "quien ya rechazó y vuelve" solo
  corre al arrancar el plugin y sin recarga nunca se ejercitaría.

### Dos detalles que te van a confundir

**`window.gtag` existe aunque el usuario rechace.** `loadGoogle()` asigna `w.gtag = gtagPush`
(`plugins/tracking.client.ts:27`) y corre siempre. Entonces la guarda
`typeof w.gtag === 'function'` de `composables/useAnalytics.ts:12` **siempre da verdadero en el
navegador**, y los eventos de GA4 se empujan al `dataLayer` haya o no consentimiento. Lo que protege
al usuario no es esa guarda, es Consent Mode: con el almacenamiento denegado, Google no guarda
identificadores y manda pings sin cookies. El comentario del encabezado de
`composables/useAnalytics.ts:2` ("No-op si los trackers no están cargados") quedó atrás respecto a
ese cambio; el que sí desaparece sin consentimiento es `fbq`. El propio e2e anota esto
(`test/e2e/compliance.spec.ts:31-34`).

**No hay forma de cambiar de opinión desde el sitio.** Una vez que la cookie existe, el banner ya no
se vuelve a mostrar (`components/CookieConsent.vue:9`) y no hay ninguna otra pantalla que la borre.
Se buscó `amanti_cookie_consent` en todo el repo y solo aparece en el banner
(`components/CookieConsent.vue:2`), el plugin (`plugins/tracking.client.ts:10` y `:92`), los specs
de e2e y una mención en `BITACORA.md:69` — en ningún lugar que la borre o la vuelva a pedir. La
página de privacidad manda al usuario a deshabilitar cookies desde su navegador
(`pages/privacidad.vue:24`) y ofrece la revocación de consentimiento **por correo**, dentro del
bloque de derechos ARCO (`pages/privacidad.vue:21`). O sea: la promesa existe por escrito, el
mecanismo automático no. Si alguien pide un botón de "cambiar mis preferencias de cookies" (es lo
normal en una revisión de privacidad), hay que construirlo.

---

## 4. Age gate (+18)

`components/AgeGate.vue`, montado en `layouts/default.vue:19` junto al banner de cookies (`:18`).

- Usa dos cookies: `amanti_age_ok` (~30 días, `:5-9`) y `amanti_age_declined` (1 día, `:11-15`). La
  segunda existe para que el "No" no se reinicie en cada recarga, o sea que la decisión negativa
  también se registra (`:10`).
- Es **solo cliente, tras hydration** (`:2-4`, `:16-24`), por la misma razón que el banner de
  cookies: el contenido de la página se renderiza normal en SSR y este overlay lo tapa
  **visualmente**. No envuelve el contenido de la tienda.
- Se pinta con `<Teleport to="body">` (`:38`) y bloquea el scroll del body mientras está visible
  (`:30-33`), con limpieza en `onBeforeUnmount` (`:34`).
- La comparación se hace con `String(ageOk.value) !== '1'` (`:19`) porque `useCookie` puede
  devolver el número `1` en vez de la cadena. El comentario de la línea 18 lo dice; no lo
  "simplifiques" a una comparación estricta sobre el valor crudo.
- Aceptar limpia `amanti_age_declined` (`:26`); rechazar muestra el mensaje de salida (`:27`).

> **Esto no es un control de acceso.** El HTML del SSR con todo el catálogo se le sirve a
> cualquiera; el overlay solo lo tapa encima. El propio e2e lo afirma: verifica que `.pcard` esté
> visible **mientras el age gate sigue puesto** (`test/e2e/compliance.spec.ts:13-14`). Fue una
> decisión deliberada para no sacrificar SEO. Quien apague JavaScript ve la tienda completa. Si
> alguna vez se pide un bloqueo real, este componente no es el lugar: habría que hacerlo en el
> servidor, y costaría el SEO.

`test/e2e/compliance.spec.ts:73-77` cubre el camino del "No".

---

## 5. Eventos de ecommerce

`composables/useAnalytics.ts` dispara GA4 y Meta Pixel **a la vez** desde un solo `emit()`
(`:9-14`), cada uno dentro de su propio `try/catch`. Eso está probado: si un tracker lanza, se traga
el error y el otro **sí** se llama (`test/unit/analytics.test.ts:93-98`). La moneda es siempre
`MXN`, escrita a mano en cada payload.

| Evento GA4 | Evento Pixel | Dónde se dispara |
|---|---|---|
| `search` | `Search` | `components/SiteHeader.vue:77` y `pages/tienda/index.vue:98` |
| `view_item` | `ViewContent` | `pages/tienda/[slug].vue:121` (dentro de `onMounted`) |
| `add_to_cart` | `AddToCart` | `stores/cart.ts:89` (dentro de `addItem`) |
| `begin_checkout` | `InitiateCheckout` | `pages/carrito.vue:172` y `:208` (los dos botones de pago) |
| `purchase` | `Purchase` | `pages/carrito.vue:79` |

Dos decisiones que parecen raras y no lo son:

- **`search` manda `search_results`** (el número de resultados) además del término
  (`composables/useAnalytics.ts:24-33`). El comentario de las líneas 21-23 explica por qué: el caso
  que interesa es el que devuelve **cero**. En sep-2026 "Lubricante coco" daba vacío y el producto sí
  existía, y nadie se enteró hasta que alguien revisó a mano. `test/unit/analytics.test.ts:44-48`
  fija que la búsqueda con cero resultados sí se registra.
- **`addToCart` multiplica `value` por `quantity`** (`composables/useAnalytics.ts:41`), con
  `quantity` omitida = 1. Probado en `test/unit/analytics.test.ts:59-69`.

---

## 6. Cómo se registra la conversión de compra

La compra se registra en **una sola página**: `/carrito?status=success`.

1. Al crear la preferencia de pago, el servidor arma la URL de retorno:
   `` `${base}/carrito?status=success&order=${order.id}` `` en
   `server/api/checkout.post.ts:131`, con `auto_return: 'approved'` (`:135`) para que Mercado Pago
   regrese al cliente solo. Stripe usa exactamente la misma URL
   (`server/api/stripe-checkout.post.ts:49`).
2. Ya de vuelta, `pages/carrito.vue` lee `route.query.status` (`:64`) y, dentro de `onMounted`, si
   vale `'success'` y el carrito todavía tiene artículos, llama
   `analytics.purchase((route.query.order as string) || '', cart.totalWithDiscount, cart.items)`
   (`:79`) y **inmediatamente vacía el carrito** (`:80`).
3. `purchase()` (`composables/useAnalytics.ts:55-77`) hace dos cosas: el `purchase` de GA4 + el
   `Purchase` de Pixel (`:56-61`), y aparte el `event: 'conversion'` con
   `send_to: 'AW-17872915568/cKhmCNfc4NgcEPCYvMpC'` para la cuenta de Google Ads (`:67-76`).

Detalles que importan:

- **El valor reportado es `cart.totalWithDiscount`, no el subtotal.** El comentario de
  `pages/carrito.vue:77-78` lo dice: si se reportara el subtotal, GA4, Meta y Ads sobrestimarían los
  ingresos y el ROAS saldría inflado.
- **El `transaction_id` es el id del pedido** (`route.query.order`). Va a Ads a propósito
  (`composables/useAnalytics.ts:63-64`) para que no cuente dos veces si el cliente recarga la página
  de confirmación. En la práctica el `clearCart()` de la línea 80 ya hace que una segunda visita no
  reporte nada, porque `cart.items` queda vacío.
- **El envío no va incluido** en el valor: `totalWithDiscount` es producto menos descuento; el envío
  se suma aparte en `totalAPagar` (`pages/carrito.vue:94`). O sea que Ads mide el valor de la
  mercancía, no lo cobrado total.

> **⚠️ La protección contra el doble conteo se cae en silencio si falta `order` en la URL.** La
> llamada es `analytics.purchase((route.query.order as string) || '', …)` (`pages/carrito.vue:79`):
> ese `|| ''` manda una **cadena vacía** como `transaction_id` cuando el parámetro no regresa. Con
> `transaction_id` vacío, Ads y GA4 ya no pueden deduplicar y la misma venta puede contarse dos
> veces. Pasaría si alguien cambia la URL de retorno de `server/api/checkout.post.ts:131` o de
> `server/api/stripe-checkout.post.ts:49` y se le olvida el `&order=`, o si una pasarela recorta la
> query al regresar. **No hay ningún test que cubra el retorno sin `order`** — si vas a tocar esas
> URLs, escribe uno primero.

---

## 7. El hueco de medición (léelo antes de sacar conclusiones de Ads)

> **⚠️ La medición de conversiones SIEMPRE va a reportar de menos. No es un bug que se pueda
> parchar en el navegador.**

La conversión se dispara **en el navegador**, en la página de retorno tras el pago
(`pages/carrito.vue:79`). Eso obliga a que el cliente **regrese** al sitio para que la venta exista
para Google.

Con tarjeta por Mercado Pago funciona, porque `auto_return: 'approved'`
(`server/api/checkout.post.ts:135`) lo trae de vuelta solo. Pero:

- **Quien paga en OXXO o por transferencia** confirma horas después, desde otro lado, y nunca vuelve
  a esa página. Esa venta entra al negocio, se marca como pagada por el webhook, y **no se registra
  en Google Ads ni en GA4**.
- **Quien cierra la pestaña** antes del retorno, igual.
- **Quien cierra el pedido por WhatsApp** nunca pasa por ahí siquiera (ver la sección del `gclid`).

Está anotado tal cual en `BITACORA.md:854-862` ("Hueco conocido en el seguimiento de conversiones"),
con la conclusión: *"Ads siempre va a reportar de menos"* (`BITACORA.md:860`).

**Lo que esto significa para quien administre la pauta:** las cifras de Ads son un **piso**, no la
realidad. Comparar el ROAS de Ads contra las ventas reales de la base va a dar siempre una
diferencia, y esa diferencia no es un error de configuración.

### El arreglo de fondo

Mandar las conversiones **desde el servidor**, no desde el navegador. Y aquí va lo primero que hay
que entender bien, porque tanto la bitácora (`BITACORA.md:861`) como la intuición se equivocan:

> **Hay DOS webhooks de pago, no uno.**
>
> - `server/api/mp-webhook.post.ts` — Mercado Pago. Es el que hoy recibe **todo**, incluidos los
>   pagos de OXXO y transferencia. Mapea el status de MP `'approved'` → pedido `'paid'` (`:20-29`) y
>   hace el UPDATE atómico que lo deja pagado (`:129-136`).
> - `server/api/stripe-webhook.post.ts` — Stripe. **Hoy inactivo**, porque el botón "Pagar con
>   tarjeta" está apagado tras `NUXT_PUBLIC_STRIPE_ENABLED` (`pages/carrito.vue:19-20`, con el
>   default vacío en `nuxt.config.ts:119-120`). Pero el archivo está en el repo y funciona: mapea
>   `'checkout.session.completed'` y `'checkout.session.async_payment_succeeded'` → `'paid'`
>   (`:45-58`), con el mismo `ALLOWED_PREV` (`:23-27`) y el mismo UPDATE atómico (`:123-136`).
>
> **El envío de la conversión desde el servidor tiene que ir en los dos**, o quedar en una función
> común que los dos llamen justo después del UPDATE atómico. Si lo cableas solo en Mercado Pago, el
> día que enciendan Stripe la mitad de las ventas con tarjeta se quedan sin reportar otra vez — que
> es exactamente el bug que este arreglo pretende cerrar.

El lugar exacto es el mismo en los dos archivos: inmediatamente después del UPDATE atómico y solo si
ese UPDATE ganó la carrera (así un reintento del webhook no dispara la conversión dos veces). Es el
mismo criterio que ya se usa para el aviso a GoHighLevel en `server/api/mp-webhook.post.ts:143-144`.

Para hacerlo faltan tres cosas, y ninguna existe hoy en el repo:

1. **Guardar el `gclid` junto con el pedido.** Hoy el `gclid` solo vive en `sessionStorage` del
   navegador (`utils/gclid.ts:10`) y **nunca llega al servidor** — se buscó "gclid" en todo
   `server/` y no hay una sola aparición. Sin él, Ads no puede atribuir la conversión a la campaña.
2. **Credenciales de la API de Google Ads** (o del Measurement Protocol de GA4) como variables de
   entorno nuevas en Vercel.
3. **Deduplicación.** Si se agrega el envío desde el servidor y se deja el del navegador, una compra
   con tarjeta se contaría **dos veces**. Los dos lados ya tienen a la mano el mismo identificador
   (el `order.id` que hoy viaja como `transaction_id`): hay que usarlo como llave de deduplicación, o
   quitar el disparo del navegador.

`BITACORA.md:862` lo clasifica como "un proyecto aparte" que "no vale la pena hasta que haya
volumen". Es una decisión de prioridad, no un olvido.

---

## 8. El `gclid` y por qué viaja en el mensaje de WhatsApp

El `gclid` es el identificador de clic que Google Ads le agrega a la URL de destino cuando alguien
llega desde un anuncio. `utils/gclid.ts` lo maneja completo en 40 líneas.

**Cómo se captura.** `captureGclid()` (`:20-26`) lee `?gclid=` de la URL con `URLSearchParams` y lo
guarda. Se llama desde `plugins/tracking.client.ts:94`, **antes** de `loadGoogle()`, porque tiene que
alcanzar a leer la URL de aterrizaje antes de cualquier navegación interna.

**Dónde se guarda y por qué.** En `sessionStorage`, no en cookie, a propósito
(`utils/gclid.ts:7-9`): dura lo que dura la visita, que es todo lo que necesita el flujo de
WhatsApp, y así no se deja un identificador persistente **antes** de que el usuario acepte cookies.
Esa decisión es de consentimiento, no de conveniencia. El acceso va envuelto en `try/catch` porque
en modo privado `sessionStorage` puede estar bloqueado (`:25`, `:30`).

**Se sanitiza.** `sanitize()` (`:13-17`) deja pasar únicamente `[A-Za-z0-9_-]` y descarta cualquier
valor de más de 120 caracteres. Es una defensa real: ese texto se pega dentro de un mensaje que el
cliente ve y que Ads después lee. `test/unit/gclid.test.ts:40-51` fija los dos casos — descartar
caracteres que no son de un `gclid` (incluido un intento con `<script>`) e ignorar uno absurdamente
largo en vez de pegarlo al mensaje.

**Por qué va en el mensaje.** Está en el encabezado del archivo (`utils/gclid.ts:3-5`): **los pedidos
que se cierran por chat no pasan por la página de gracias**, así que sin esa referencia Ads no tiene
forma de atribuirlos a la campaña que los trajo. `waRef()` (`:37-40`) devuelve `\n\nref: <gclid>` y,
si la visita no vino de un anuncio, devuelve cadena vacía — o sea que el mensaje queda **idéntico**
al de siempre para la mayoría de la gente. `test/unit/gclid.test.ts:19-24` lo protege.

Se pega en cinco lugares:

| Dónde | Archivo |
|---|---|
| Pedido completo del carrito por WhatsApp | `stores/cart.ts:159` |
| Mensaje desde la ficha de producto | `pages/tienda/[slug].vue:241` |
| Formulario de contacto | `pages/contacto.vue:22` |
| Botón flotante de WhatsApp | `components/WhatsAppButton.vue:8` |
| Barra inferior en móvil | `components/BottomNav.vue:8` |

> **Ojo:** la referencia es solo eso, una marca en el texto del mensaje. El repo **no** la manda a
> ningún lado ni la guarda en la base. Para que sirva, alguien tiene que tomar ese `ref:` del chat y
> subirlo a Google Ads como conversión offline, a mano o con una herramienta. Si nadie hace eso, el
> `gclid` en el mensaje no hace nada por sí solo. **Sin verificar desde el repo** si hoy alguien lo
> está usando.

---

## 9. Feed de Google Shopping

**Ruta:** `GET /feeds/google.xml`, servida por `server/routes/feeds/google.xml.get.ts`. Es pública y
sin autenticación (`:4`). Formato RSS 2.0 con el namespace `g:` (`:172`).

**Fuente de datos:** `data/products.json`, el mismo archivo que usa la tienda.

### Qué se arma por petición y qué queda horneado en el despliegue

Esto es lo primero que hay que entender, porque el encabezado del archivo (`:3-4`) dice "se genera
DINÁMICAMENTE" y se malinterpreta fácil:

- El **XML** sí se arma en cada petición, dentro del handler (`:105-184`), y las URLs absolutas se
  derivan del origen real de esa petición (`:105-111`).
- El **catálogo no**. `data/products.json` entra por **import estático** (`:18`), o sea que queda
  horneado en el bundle del build.
- La **campaña tampoco**. `aplicarCampana()` corre **una sola vez, en el ámbito de módulo**
  (`const products = aplicarCampana(...)`, `:42`), no dentro del handler.
- `VIGENCIA_PROMO` **tampoco**: `process.env.NUXT_PROMO_VIGENCIA` se lee en el ámbito de módulo
  (`:55`), así que queda congelada al arranque de la función.

**Consecuencia práctica:** cambiar un precio, marcar un producto como agotado, apagar la campaña o
poner la fecha de vigencia **exige un despliegue nuevo**. Y encima hay que contar la ventana de
`s-maxage=86400` del CDN (`:183`).

Lo que sí está garantizado, y es la razón de fondo del diseño: el feed y la tienda leen el **mismo
archivo** y pasan por la **misma** `aplicarCampana()`, así que no pueden desincronizarse entre sí.

### Quién edita el catálogo, y cómo

`data/products.json` es la fuente única. Hay tres caminos para modificarlo, y los tres terminan en
un commit y un despliegue:

| Camino | Qué hace |
|---|---|
| A mano | Editar el JSON. Así se prende `"agotado": true` — el comentario de `composables/useProducts.ts:22` lo dice literal: *"Se prende a mano en `data/products.json` cuando Nancy avisa"*. Igual `excludeFromFeed`, `feedId`, `feedTitle`, `feedDescription` y los precios. |
| `node scripts/sync-fotos.mjs` | Lee `public/products/`, empareja archivos por slug y **reescribe** el campo `images` de cada producto dentro de `data/products.json` (`scripts/sync-fotos.mjs:12-18`). Las instrucciones están en `:1-2`. |
| `scripts/match-fotos.py` | Empareja fotos de `fotos_raw/` con productos del JSON (`scripts/match-fotos.py:1`). |

`server/api/catalog.get.ts` **no** edita nada: es un endpoint de solo lectura que expone el catálogo
al agente EROS de n8n (`:1-3`), y también aplica la campaña en el ámbito de módulo (`:8`), con la
misma consecuencia de despliegue.

> **Trampa de inventario, y es la que más va a doler el primer mes.** Marcar `agotado` **no es
> cosmético**: `g:availability` sale de esa bandera (`server/routes/feeds/google.xml.get.ts:132`) y
> el comentario de `:129-131` dice por qué importa — anunciar como disponible algo que ya no hay es
> lo que hace que Merchant Center suspenda la cuenta, **y además paga clics que terminan en un
> carrito que no se puede cobrar**. Pero como el catálogo es un archivo del repo, "surtir" implica
> **commit + despliegue**: no hay panel de administración. Es lo primero que vas a tener que hacer
> cuando el equipo te avise de un agotado, así que ten claro el flujo de deploy antes de que pase.

### Qué expone

| Etiqueta | De dónde sale | Línea |
|---|---|---|
| `g:id` | `feedId` si existe, si no el `slug` | `:120` |
| `g:title` | `feedTitle` si existe, si no `name` | `:121` |
| `g:description` | `feedDescription` → `description` → `name` | `:122` |
| `g:link` | `{origen}/tienda/{slug}`, absoluto | `:116`, `:123` |
| `g:image_link` | `images[0]`, absoluto | `:125` |
| `g:additional_image_link` | `images[1..10]` | `:126-128` |
| `g:availability` | `in_stock` / `out_of_stock` según la bandera `agotado` | `:132` |
| `g:price` / `g:sale_price` | ver la sección de precio | `:147-155` |
| `g:sale_price_effective_date` | solo si `NUXT_PROMO_VIGENCIA` trae algo | `:150-152` |
| `g:condition` | siempre `new` | `:156` |
| `g:brand` | `brand`, solo si existe | `:157` |
| `g:product_type` | `category` | `:158` |
| `g:google_product_category` | siempre `778` | `:159` |
| `g:age_group` | siempre `adult` | `:160` |
| `g:gender` | mapa por categoría | `:161-162` |
| `g:color` | whitelist de colores detectada en el título | `:163-164` |
| `g:identifier_exists` | siempre `no` (no hay GTIN ni MPN) | `:165` |
| `g:adult` | siempre `yes`, en **todos** los productos | `:166` |

> **El comentario del propio archivo miente, y es lo primero que vas a leer.** El mapa de campos del
> encabezado (`server/routes/feeds/google.xml.get.ts:6-13`) dice `g:price = "0.00 MXN"`, que era
> cierto antes del swap de precios de `:147-155` y ya no lo es. Tampoco menciona `g:sale_price`,
> `g:feedId`, `g:google_product_category`, `g:age_group`, `g:gender` ni `g:color`. **La tabla de
> arriba, no ese comentario, es la que refleja el código.** Si tocas el feed, vale la pena
> actualizar ese encabezado de paso.

Decisiones que vale la pena entender:

- **`778`** es la categoría oficial de Google Product Taxonomy "Mature > Erotic > Sex Toys". El
  comentario (`:72-76`) explica que es la única hoja de esa rama aplicable a todo el catálogo
  (juguetes, anal, BDSM, arneses, masturbadores, parejas, lubricantes, retardantes), y que ayuda a
  que Merchant clasifique y apruebe productos para adultos.
- **`g:adult: yes` va en todos**, sin excepción (`:13`, `:166`). No lo condiciones por producto.
- **`g:gender`** sale de un mapa por categoría (`:79-90`) que es una aproximación declarada; `unisex`
  es el default seguro. Solo se emite si la categoría está en el mapa.
- **`g:color`** solo se emite con un match claro contra una lista blanca de 18 colores (`:93-103`),
  "para no ensuciar el feed". La expresión regular exige límites de palabra alrededor (`:99`).
- **Campos que solo existen para el feed** (`:33-37`): `feedId` (override de `g:id` cuando el slug
  pasa de 50 caracteres, que es el límite de Google), `feedTitle`, `feedDescription`, y
  `excludeFromFeed`, que saca un producto del feed **sin** quitarlo de la tienda (filtrado en
  `:114`).
- **URLs absolutas derivadas del origen de la petición** (`:105-111`), con fallback a
  `config.public.siteUrl` (`nuxt.config.ts:116` = `https://amanti.mx`). Por qué: así el feed funciona
  igual servido en el dominio de Vercel que en `amanti.mx`, sin tener que tocar código al cambiar de
  dominio.
- **Caché:** `public, max-age=3600, s-maxage=86400` (`:183`). Google no necesita más frescura que
  ~1 día y `s-maxage` cachea en el CDN de Vercel.

### Cómo hereda el precio de la campaña

La línea clave es `server/routes/feeds/google.xml.get.ts:42`: el catálogo pasa por
`aplicarCampana()` **antes** de armar el feed. El comentario de las líneas 40-41 da la razón dura:
*con la campaña encendida, Google tiene que ver el mismo precio que la tienda, o Merchant Center
marca discrepancia y suspende los productos.*

Ahora la parte que se ve al revés y no lo es. `utils/campana.ts` define `aplicarCampana()`
(`:170-176`): con la campaña activa, baja `price` al precio rebajado y guarda el de lista en
`compareAt`. **Google lo quiere exactamente al contrario**: para él `g:price` es el precio de lista y
`g:sale_price` el rebajado. De ahí el swap:

```
if (p.compareAt && p.compareAt > p.price) {
  g:price      = compareAt   // lista
  g:sale_price = price       // rebajado, lo que de verdad cobra el sitio
} else {
  g:price      = price       // sin tachado
}
```
(`server/routes/feeds/google.xml.get.ts:147-155`; el porqué está comentado en `:134-146`, y lo pidió
Emilio el 26-ago-2026.)

La condición `compareAt > price` evita inventar un tachado falso cuando un producto viene mal
capturado.

`test/unit/feed-precio.test.ts` prueba **la regla, no el XML** (`:12`), y cubre los dos sentidos del
riesgo de dinero (`:1-11`):

- con campaña encendida, `price` es el de lista y `sale_price` el rebajado (`:34-40`);
- **nunca** un `sale_price` mayor al `price` — ese es el que atrapa la inversión de etiquetas
  (`:42-58`);
- el `sale_price` es **exactamente** lo que cobra el sitio (`:60-65`);
- con campaña apagada va un solo precio y ningún tachado (`:67-72`);
- no se inventa tachado si `compareAt` viene igual o menor (`:74-79`).

> **Trampa de dinero en los dos sentidos.** Si alguien voltea las etiquetas, Google anuncia el precio
> de lista como si fuera el rebajado: **el cliente hace clic esperando pagar $835 y en el sitio ve
> $501** (los mismos números y el mismo sentido que `test/unit/feed-precio.test.ts:5-8`). No es un
> error visual: es una promesa rota al revés, Google penaliza la discrepancia de precio y Merchant
> Center puede suspender la cuenta. Si en cambio se deja de mandar `sale_price`, el anuncio sale sin
> tachado y se pierde el gancho de la promoción.

> **Trampa de caché.** Con `s-maxage=86400`, el CDN puede seguir sirviendo el feed viejo hasta un día
> después de desplegar un cambio de precio o el apagado de la campaña. Si vas a mover precios o el
> interruptor de campaña, cuenta con esa ventana: durante ella el feed y la tienda pueden no
> coincidir.

### Por qué el feed NO lleva fecha de vigencia de la oferta

El código **sí sabe** emitir `g:sale_price_effective_date`: lo hace si la variable de entorno
`NUXT_PROMO_VIGENCIA` trae un rango (`server/routes/feeds/google.xml.get.ts:55` la lee, `:150-152` la
emite). El formato que Google acepta es ISO 8601 con offset y separado por diagonal, por ejemplo
`2026-08-01T00:00-06:00/2026-08-31T23:59-06:00` (`:44-54`).

Vive en el entorno y no en el código porque la fecha de fin es una decisión de campaña, no de
ingeniería. **OJO con el comentario optimista de `:48-51`**, que dice que se cambia "en Vercel sin
desplegar": eso es falso en dos niveles.

1. En Vercel, una variable nueva **solo entra con un despliegue nuevo**. Está registrado en
   `BITACORA.md:867-868`: *"por eso hubo que hacer un commit vacío"*.
2. Aunque entrara, el feed la lee **una sola vez al arrancar la función** (`:55`, ámbito de módulo),
   no en cada petición.

Pero **hoy se deja vacía a propósito**, y la razón está escrita en `utils/campana.ts:28-42`:

- La campaña se prende y apaga con un **booleano**, `CAMPANA.activa`, hoy en `true`
  (`utils/campana.ts:43`). La fecha de fin acordada por el equipo es el 30 de septiembre de 2026
  (`:28-31`), pero **eso no está en el código**: es un acuerdo. El interruptor **no se apaga solo**;
  alguien tiene que venir a ponerlo en `false`.
- Si el feed caducara el 30-sep y ese interruptor siguiera encendido, Google anunciaría el precio de
  lista mientras el sitio cobra el rebajado. Eso es discrepancia de precio, y Merchant Center
  suspende por eso (`utils/campana.ts:37-41`).
- La regla es: **los dos se apagan el mismo día, o ninguno.** Sin la fecha, el descuento se ve igual
  en Shopping; solo falta el corte automático.

> **⚠️ Lo más caro de esta sección.** `CAMPANA.activa = true` regala 40% en **todo** el catálogo y no
> caduca. Si el 1 de octubre nadie lo pone en `false`, la tienda sigue regalando el 40%
> indefinidamente y **nada avisa** (`utils/campana.ts:33-36`). Si vas a poner `NUXT_PROMO_VIGENCIA`,
> apaga `CAMPANA.activa` y despliega **ese mismo día**.

### Apagar `CAMPANA.activa` no es un interruptor aislado

Antes de poner ese booleano en `false`, entérate de lo demás que cuelga de él **en el mismo
archivo**:

| Qué | Dónde | Qué pasa al apagar la campaña |
|---|---|---|
| `CUPONES_ACEPTADOS = !CAMPANA.activa` | `utils/campana.ts:138` | Pasa a `true`: el **servidor vuelve a aceptar cupones** (`AMANTI15`) al cobrar (`server/utils/coupons.ts:56`) y reaparece el cuadro para capturarlos en el carrito (`pages/carrito.vue:351`). La razón de que hoy estén cerrados está en `:134-137`: con el 40% encendido, un `AMANTI15` encima dejaría la venta en 49% de descuento sin que nadie lo haya decidido. |
| `MOSTRAR_CUPONES = ANUNCIAR_CUPONES && !CAMPANA.activa` | `utils/campana.ts:131` | **Sigue en `false`**, porque `ANUNCIAR_CUPONES` está en `false` desde `:124` (César pidió el 12-ago bajar del sitio todo anuncio de descuentos). O sea que el sitio los **aceptaría sin anunciarlos**. Si alguien prende `ANUNCIAR_CUPONES`, reaparecen en el home (`pages/index.vue:111`, `:121`), el hero (`components/HeroEditorial.vue:32`), los kits (`components/KitCard.vue:43`), la ficha (`pages/tienda/[slug].vue:345`), el carrito (`pages/carrito.vue:286`) y la pantalla de cuenta (`components/account/AccountAuth.vue:105`). |
| `BANNER_TEMPORADA` vía `bannerVigente()` | `utils/campana.ts:77-85` y `:112` | Devuelve `false` en cuanto la campaña se apaga, porque ese banner anuncia el mismo 40% y no puede quedarse prometiendo un descuento que la tienda ya no da (`:56-58`). Nota aparte: ese banner **sí caduca solo** por fecha, y su `hasta` es `'2026-09-16'` (`:80`), así que ya está fuera de vigencia. |

La comparación de fechas del banner se hace con `diaMx()` (`:97-104`), que calcula el día en
`America/Mexico_City` y no con el reloj del servidor, porque en Vercel el reloj está en UTC y entre
las 18:00 y la medianoche de México ya cree que es el día siguiente (`:90-93`).

### Lo que falta configurar FUERA del XML para que Merchant Center apruebe

El feed no lo resuelve todo por sí solo. Estas piezas **no se pueden arreglar en el código** y hay
que darlas de alta en el panel de Merchant Center (**sin verificar desde el repo** si ya están):

- **Envío.** El feed **no emite ninguna etiqueta `g:shipping`** — se revisó el archivo completo y no
  existe. Google exige saber el costo de envío, así que hay que configurarlo como regla de envío en
  la cuenta de Merchant. Ojo con que cuadre con lo que cobra el sitio (`NUXT_ENVIO_COSTO` /
  `NUXT_PUBLIC_ENVIO_COSTO`, ver `nuxt.config.ts:125` y `pages/carrito.vue:89-93`); si Merchant dice
  un envío y el checkout cobra otro, es discrepancia otra vez.
- **Impuestos.** Tampoco hay `g:tax`. Se configura en el panel.
- **Sin GTIN.** `g:identifier_exists = no` va en todos los productos (`:165`) porque el catálogo no
  tiene GTIN ni MPN. Eso es válido, pero significa que **Google no puede casar estos productos con
  su base**: no entran a comparativas de precio ni a fichas agregadas, y el alcance es menor. Si
  algún día se capturan los GTIN reales de los proveedores, quitar esa etiqueta y emitir `g:gtin`
  mejora bastante.
- **La fuente de datos.** Hay que registrar la URL del feed en Merchant Center (Productos → Fuentes
  de datos → añadir por URL programada). La URL es el `siteUrl` de `nuxt.config.ts:116` más la ruta:
  `https://amanti.mx/feeds/google.xml`. **Con qué frecuencia la vuelve a jalar Google es una
  configuración del panel**, no del código — y no tiene sentido pedirle una frecuencia mayor a la
  ventana de caché de `s-maxage=86400`.

---

## 10. Cómo verificar en producción antes de gastar en pauta

La falla de `gtag` es silenciosa (§2), así que "no hay errores en consola" no prueba nada. Esta es la
cadena completa, de abajo hacia arriba. Hazla antes de encender campañas.

**1. En el navegador, en producción.** Abre `https://amanti.mx`, acepta el age gate y **acepta**
cookies. En la consola:

```js
// Las entradas tienen que ser objetos `arguments`, no Arrays.
dataLayer.map(e => Object.prototype.toString.call(e))
// Y el consent default tiene que ir ANTES del primer js/config:
dataLayer.map(e => Array.from(e)[0] + ':' + Array.from(e)[1])
```

Es el mismo criterio que fijan `test/unit/gtag.test.ts:18-23` y `test/e2e/compliance.spec.ts:38-53`.

**2. La cookie `_ga`.** Después de aceptar, tiene que existir. Si no existe, el `config` nunca se
ejecutó — es la delatora que destapó el bug de agosto (`utils/gtag.ts:11-13`). Con el consentimiento
**rechazado** es normal que no exista.

**3. GA4.** Informes → Tiempo real, y DebugView si traes la extensión de depuración. Tiene que verse
el `page_view` y, al navegar la tienda, `view_item` y `add_to_cart`.

**4. Ads.** Herramientas → Conversiones → la acción de compra (`cKhmCNfc4NgcEPCYvMpC`): revisa el
estado y la fecha de la última conversión registrada. El Asistente de etiquetas de Google (Tag
Assistant) sobre `amanti.mx` te dice si el `config` de `AW-17872915568` está llegando.

**5. La venta de verdad.** Esto es lo único que cierra la cadena y **es lo que sigue pendiente**:
`BITACORA.md:49` tiene la conversión de compra como *"sin verificar en venta real"*. Haz una compra
de prueba **con tarjeta** (no OXXO: necesitas el retorno automático) y comprueba, en ese orden:

- que la URL de vuelta traiga `?status=success&order=<id>` — si falta `order`, ya sabes lo que pasa
  con el `transaction_id` (§6);
- que en el `dataLayer` aparezca `event: 'conversion'` con el `send_to` correcto y un
  `transaction_id` **no vacío** (`composables/useAnalytics.ts:69-74`);
- que 24-48 h después la conversión aparezca contada en Ads con el valor correcto.

**6. El feed.** Abre `https://amanti.mx/feeds/google.xml` y confirma a ojo que con la campaña
encendida cada item trae `g:price` (lista) **y** `g:sale_price` (rebajado), y que el `g:sale_price`
es el mismo número que cobra la ficha del producto. Luego, en Merchant Center, revisa que la fuente
de datos esté jalando y cuántos productos hay suspendidos.

---

## 11. Cómo correr las pruebas de esta área

De `package.json:11-13`:

| Comando | Qué corre |
|---|---|
| `npm run test:unit` | `vitest run` — incluye `gtag`, `analytics`, `gclid`, `campana` y `feed-precio` |
| `npm run test:e2e` | `playwright test` — incluye `compliance.spec.ts` |
| `npm test` | los dos, en ese orden |

**Lo mínimo para que los e2e corran** (aquí es donde se atora todo el mundo):

- **Hay que compilar primero.** El `webServer` de Playwright arranca
  `node .output/server/index.mjs` (`playwright.config.ts:31`), o sea el build de producción, no
  `nuxt dev`. Corre `npm run build` antes de `npm run test:e2e`. Con `reuseExistingServer: true`
  (`:48`), si ya tienes algo escuchando en ese puerto, lo reutiliza.
- **El puerto real es 3457, no 3010.** `playwright.config.ts:6` usa `E2E_PORT` con default `3457`, y
  el comentario de `:3-5` explica por qué se movió: en la máquina donde se desarrolló, el 3010 cae
  dentro del rango que Windows reserva para Hyper-V/WSL, `node` truena con `EACCES` antes de
  escuchar y **ningún** e2e corría. Aun así, **todas las specs siguen cableando
  `http://localhost:3010`** en sus `addCookies` (por ejemplo `test/e2e/ficha.spec.ts:5-6`). No es un
  bug: las cookies se atan al dominio, no al puerto, así que puestas para `localhost` aplican igual
  en el 3457. Pero es confuso, y si alguna vez se cambia el host (no el puerto), hay que tocar las
  ~20 specs.
- **Hay que suprimir el WelcomeModal.** Su overlay intercepta clics a media prueba, así que
  prácticamente todas las specs hacen
  `page.addInitScript(() => localStorage.setItem('amanti_welcome_seen', '1'))` —
  `test/e2e/compliance.spec.ts:7`, `test/e2e/ficha.spec.ts:9`, y así en todas. Si tu prueba nueva
  falla con "element intercepts pointer events", es esto.
- **Los dos overlays.** Casi todas las specs arrancan con las cookies `amanti_age_ok=1` y
  `amanti_cookie_consent=rejected` ya puestas para saltarse el age gate y el banner
  (`test/e2e/ficha.spec.ts:4-6`). `compliance.spec.ts` es la excepción deliberada: **no** pone
  cookies porque justamente valida el estado inicial (`test/e2e/compliance.spec.ts:3`).

Si escribes un e2e nuevo, copia el `beforeEach` completo de `test/e2e/ficha.spec.ts:4-9`: cookies +
flag del modal. Los dos, no uno.

---

## 12. Lo que NO se puede verificar leyendo el repo

Todo esto vive en paneles externos y hay que confirmarlo entrando:

- Qué variables de entorno están realmente cargadas en Vercel, en particular `NUXT_PROMO_VIGENCIA`
  (`BITACORA.md:852` la registra como pendiente con Emilio). Recordatorio anotado en
  `BITACORA.md:867-868`: en Vercel una variable nueva **solo entra con un despliegue nuevo**.
- El estado y la propiedad de las cuentas de Google Ads y Merchant Center. `BITACORA.md:57` registra
  el Customer ID de Ads `697-248-9635`, que Emilio dio los dos accesos el 31-ago-2026, y que **no hay
  confirmación en el grupo de que alguien haya entrado**. `BITACORA.md:58` registra que Google Tag
  Manager "sigue sin dueño conocido".
- Si la acción de conversión `cKhmCNfc4NgcEPCYvMpC` está configurada correctamente en Ads (tipo
  compra, conteo, ventana de atribución). `BITACORA.md:49` la tiene como "sin verificar en venta
  real".
- Si Merchant Center está jalando de verdad `/feeds/google.xml`, con qué frecuencia, si las reglas
  de envío e impuestos están dadas de alta y si hay productos suspendidos.
- El estado de la propiedad de GA4 `G-HE23F0TWMG`, de la cuenta de Clarity `u8nz8w7mf3` y del Pixel
  `947187697884149`: quién los administra y si están recibiendo datos.
- Si alguien está tomando el `ref:` de los mensajes de WhatsApp y subiéndolo a Ads como conversión
  offline.
