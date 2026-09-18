# Pendientes y riesgos

Corte: 18 de septiembre de 2026. Último commit del repo: `dfd1145`, del **15 de septiembre a las
15:47** (`git log`). **Entre el 16 y el 18 de septiembre no entró ni un commit** (`git log --since=2026-09-16`
devuelve cero), así que el código que describe esta sección es exactamente el mismo que revisó la
bitácora el 15/09: no hay días sin cubrir, hay días sin cambios. El árbol de trabajo está limpio
salvo tres cosas sin versionar: `AMANTI-Automatizaciones-2026-09-03.html`, su `.pdf` y la carpeta
`ENTREGA/` con este mismo paquete. Ninguna es código.

Esto es el inventario de deuda, no la lista de deseos. Cada punto se verificó abriendo el archivo
que se cita. Lo que no se pudo comprobar leyendo el repo —lo que vive en el panel de Vercel, en
GoHighLevel, en Google Ads o en Supabase— va marcado como **sin verificar desde el repo**, y no se
afirma. Un hueco marcado sirve; un dato inventado hace perder un día.

La fuente cruzada es `BITACORA.md` (sección «ESTADO AL 14/09/2026», líneas 12-102, revisada contra
Vercel y contra el grupo el 15/09) contra el código actual. Varios pendientes que la bitácora daba
por vivos siguen vivos; se confirmaron uno por uno.

---

## Antes de tocar nada: cómo se corre esto

Va aquí, aunque no sea deuda, porque los puntos de abajo dicen «desplegar», «correr las pruebas» o
«revisar el feed» y sin esto no se puede hacer ninguna. El detalle largo está en `08-despliegue.md`
y `09-pruebas.md`.

| Qué | Comando | Notas |
|---|---|---|
| Instalar | `npm install` | Dispara `nuxt prepare` por el `postinstall` (`package.json`) |
| Desarrollo | `npm run dev` | Nuxt levanta en **http://localhost:3000** (`SETUP.md:11-16`) |
| Build | `npm run build` | Genera `.output/` |
| Correr el build | `node .output/server/index.mjs` | Puerto 3000 (`SETUP.md:18-23`) |
| Unitarias (vitest) | `npm run test:unit` | Corre `test/unit/**` y `test/smoke/**` (`vitest.config.ts:12`) |
| End-to-end (Playwright) | `npm run test:e2e` | **Exige un build previo**, ver abajo |
| Todo | `npm test` | `vitest run && playwright test` (`package.json:11`) |

**La rama es `master`, no `main`** (`.git/HEAD`: `ref: refs/heads/master`). El repo, según
`BITACORA.md:4`, es `memorx/amanti-store`, y producción es el proyecto `amanti-store-cake` de Vercel.
*(Quién dispara el despliegue —si Vercel está atado al push a `master` o si alguien lo lanza a
mano— no se puede verificar desde el repo: no hay GitHub Actions, `vercel.json` solo trae redirects
301 y la carpeta `.vercel/` está en `.gitignore`. La pista fuerte es `BITACORA.md:865-868`: para que
entrara una variable nueva «hubo que hacer un commit vacío», que es el comportamiento de la
integración con Git.)*

**El repo no fija versión de Node**: no hay `engines` en `package.json` ni `.nvmrc` ni
`.node-version`. Corre sobre Nuxt 3.21 (`package.json:19`). *(Qué versión de Node usa Vercel: sin
verificar desde el repo.)*

**Tres trampas del entorno de pruebas, y las tres muerden el primer día:**

1. **Playwright no levanta la app en modo dev: corre el build.** Su `webServer.command` es
   `node .output/server/index.mjs` (`playwright.config.ts:30`) en el puerto **3457**
   (`playwright.config.ts:6`, pisable con `E2E_PORT`). Si no corriste `npm run build` antes, no hay
   `.output` y no arranca; y si el `.output` es viejo, **los e2e pasan contra código viejo sin
   avisar**. Peor: `reuseExistingServer: true` (`playwright.config.ts:47`) reutiliza cualquier
   servidor que ya esté en ese puerto.
2. **El build revienta si el servidor de producción está levantado**: `EPERM … unlink libvips-42.dll`,
   porque `node .output/server/index.mjs` tiene cargada la DLL de sharp. Hay que bajar el servidor
   antes de `npm run build` o el `.output` queda a medias (`BITACORA.md:221-223`).
3. **Correr la suite unitaria contra un build en paralelo miente.** Dio rojos por
   `Test timed out in 5000ms` que desaparecieron al correr el archivo solo: era contención de CPU,
   no regresión (`BITACORA.md:217-220`).

---

## Tabla de urgencia

| # | Pendiente | Duele en | Fecha | Depende de |
|---|---|---|---|---|
| 1 | Interruptor de la campaña 40% sin caducidad | Dinero, directo | 30-sep-2026 | Dueño (Raúl) + dev |
| 2 | Aviso de envío al cliente que no tiene a dónde salir | Experiencia; promesa escrita incumplida | — | Acceso a Vercel + César (GHL) |
| 3 | Campos dinámicos de los correos sin cuadrar | Experiencia de quien ya pagó | — | César (GHL) |
| 4 | Conversión de compra sin verificar en venta real | Dinero de pauta, a ciegas | — | Emilio / César + accesos |
| 5 | Los pagos confirmados fuera de línea no se miden | Dinero: Ads reporta de menos siempre | — | Dev (proyecto aparte) |
| 6 | Deuda de pruebas: una que pasa en falso y una atada a n8n | Confianza en la suite | — | Dev solo |
| 7 | El formulario incrustado baja la librería de Meta aunque se rechacen cookies | Cumplimiento / reputación | — | César (GHL) |
| 8 | El esquema de la base no se puede reconstruir desde el repo | Recuperación ante desastre | — | Dev solo |
| 9 | Existencias: bandera manual en un JSON, con despliegue y hasta 24 h de caché | Operación diaria; clics pagados | — | Dev + Nancy |
| 10 | Umbral de envío gratis duplicado cliente/servidor, y otras trampas silenciosas | Dinero, en silencio | — | Dev solo |
| 11 | El cerebro del chat EROS vive fuera del repo | Se hereda algo que no se puede leer ni cambiar | — | Dueño de la cuenta de n8n |
| 12 | `.env.example` no lista siete variables que el código sí lee | Entorno nuevo mal levantado | — | Dev solo |
| 13 | Higiene de secretos antes de que el repo cambie de manos | Seguridad | Antes de entregar | Dev + César + Emilio |
| 15 | El dominio no tiene DMARC | Correos a spam; suplantación del dominio | — | Acceso a Hostinger |
| 16 | `public/sitemap.xml` es estático y está desfasado | SEO: productos y artículos que Google no descubre | — | Dev solo |

---

## 1. El interruptor de la campaña del 40% no caduca solo

**Qué es.** `utils/campana.ts:42-47` define `CAMPANA` con `activa: true` y `descuento: 0.4`. Es un
booleano en código, no una fecha. El comentario de arriba (`utils/campana.ts:28-41`) deja escrita
la fecha que el equipo acordó:

> FECHA ACORDADA DE FIN: 30 de septiembre de 2026. […] NO se apaga solo. Esto es un booleano y
> alguien tiene que venir a ponerlo en false.

Faltan doce días. Si el 1 de octubre nadie lo apaga, la tienda sigue regalando el 40% de todo el
catálogo indefinidamente y nada avisa: no hay alerta, no hay log, no hay error.

**Por qué está así y no es un descuido.** El comentario de cabecera (`utils/campana.ts:1-15`) lo
explica: el precio que ve el cliente y el que se le cobra tienen que salir del mismo cálculo. Si el
interruptor viviera en una variable de entorno, durante un despliegue el navegador y el servidor
podrían leer valores distintos y el sitio enseñaría 40% mientras cobra precio de lista. Un flag en
el código viaja en el mismo bundle para los dos lados.

**Riesgo grave: apagarlo tiene tres efectos, no uno.** Quien ponga `activa: false` debe saber que
mueve también estas dos cosas, porque cuelgan del mismo booleano:

- **El feed de Google.** `server/routes/feeds/google.xml.get.ts:42` aplica la campaña al catálogo
  antes de generar el XML, y las líneas 147-152 mandan `g:price` (lista) + `g:sale_price`
  (rebajado). Al apagar la campaña el feed deja de mandar `sale_price` solo. **A propósito no se le
  puso `sale_price_effective_date`:** la etiqueta existe (`google.xml.get.ts:55` y `:150-152`) y solo
  se emite si `NUXT_PROMO_VIGENCIA` trae valor. La decisión de dejarla sin poner está escrita en
  `utils/campana.ts:37-41`: si el feed caducara el 30-sep y el interruptor siguiera encendido, Google
  anunciaría el precio de lista mientras el sitio cobra el rebajado. Eso es discrepancia de precio y
  Merchant Center suspende productos por eso. **Los dos se apagan el mismo día o ninguno.**
  *(Si hoy está vacía en Vercel producción: sin verificar desde el repo — hay que abrirlo en el
  panel. Ojo: `BITACORA.md:852` deja el rango de fechas de la promo como petición abierta a Emilio
  desde el 10/09, así que pudo haberse puesto desde entonces. El único respaldo de que estuviera
  vacía es un reporte sin versionar con corte del 3 de septiembre. **Si está puesta, revísala ANTES
  de apagar la campaña.**)*
- **Los cupones se vuelven a aceptar solos.** `utils/campana.ts:138` define
  `CUPONES_ACEPTADOS = !CAMPANA.activa`, y `server/utils/coupons.ts:61-67` rechaza todo cupón
  mientras la campaña esté encendida, con el motivo escrito ahí mismo: 40% + 15% dejaría la venta en
  49% de descuento sin que nadie lo haya decidido. En el momento en que se apague la campaña, el
  servidor vuelve a honrar cualquier cupón activo que haya en la tabla `coupons` de Supabase —por
  ejemplo `AMANTI15`, que según `utils/campana.ts:120-124` sigue vivo aunque no se anuncie. Nadie va
  a decidir eso: va a pasar. Hay que revisar qué filas de `coupons` están `active: true` **antes** de
  apagar la campaña. *(Qué cupones hay hoy en Supabase: sin verificar desde el repo.)*

**Qué habría que hacer.** Hay dos caminos y son distintos:

1. **El mínimo, el 30 de septiembre:** poner `activa: false` en `utils/campana.ts:43`, commitear a
   `master`, **confirmar que el despliegue de producción salió** (ver arriba: quién lo dispara no
   está en el repo), y después revisar que el feed ya no manda `sale_price` —se ve cargando
   `/feeds/google.xml` en producción— y que la tabla de cupones no tiene sorpresas activas.
2. **El arreglo de fondo, que quedó pendiente de decisión:** que la fecha de fin viva dentro de
   `CAMPANA` y que el feed la derive de ahí, para que los dos interruptores no puedan discrepar.
   **El molde ya está escrito y probado**: `BANNER_TEMPORADA` (`utils/campana.ts:64-115`) resuelve
   exactamente eso para el banner —día de calendario en hora de México vía `diaMx()`
   (`utils/campana.ts:97-104`), porque el servidor de Vercel corre en UTC y una fecha ingenua
   apagaría la promoción seis horas antes—, con pruebas en `test/unit/campana.test.ts`. No se hizo
   porque **cambia el comportamiento del precio que se cobra**, y esa es una decisión del dueño, no
   del dev.

**Detalle menor del mismo archivo:** `BANNER_TEMPORADA` (`utils/campana.ts:77-85`) sigue con
`activo: true` y `hasta: '2026-09-16'`. Ya caducó y `bannerVigente()` lo apaga bien
(`utils/campana.ts:107-115`), así que no se ve. Es configuración muerta: conviene bajarla a
`activo: false` para que nadie crea que hay un banner encendido.

---

## 2. El aviso de envío al cliente: el sitio lo emite y no tiene a dónde mandarlo

**Qué es.** Cuando se marca un pedido como enviado, `server/api/pedido-enviado.post.ts:44` emite el
evento `pedido_enviado` hacia GoHighLevel con el payload que arma `payloadEnvio()`
(`server/utils/ghl.ts:216-249`). Ese evento sale por la URL que viva en la variable
`NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` (`server/utils/ghl.ts:62`).

**El problema.** Según `BITACORA.md:41-45` —revisado contra Vercel el 15/09— en producción existen
`NUXT_GHL_WEBHOOK_AVISO_PEDIDO`, `_CARRITO_ABANDONADO` y `_POSTCOMPRA`, pero
**`NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` no existe**. *(Que siga faltando hoy: sin verificar desde el
repo; hay que abrirlo en el panel de Vercel.)*

**Por qué eso no truena nada y por eso es peligroso.** `server/utils/ghl.ts:90-91` dice:

```ts
const url = urlDe(evento)
if (!url) return false // regla 1: sin configurar, no-op silencioso
```

Sin URL configurada, el emisor devuelve `false` y no hace absolutamente nada. No lanza, no registra
un warning, no aparece en los logs. El pedido se marca como enviado perfectamente, Nancy ve su
pantalla en orden, y el cliente no se entera de nada.

**Lo que cuesta.** `pages/envios.vue:28-29` dice, por escrito y en producción:

> **Rastreo** — Recibirás un número de rastreo por email una vez que tu pedido sea enviado.

Es una promesa pública que hoy no cumple nadie. El cliente que pagó espera un correo que nunca
llega, y el efecto ya se vio en este proyecto: cuando alguien paga y no recibe acuse, vuelve a
pagar. `server/api/mp-webhook.post.ts:174-176` documenta el caso —un comprador pagó el 29-ago, no le
llegó nada, y **volvió a levantar el mismo pedido dos veces en los dos minutos siguientes**—. Aquí
el riesgo no es cobro doble, es que el cliente escriba por WhatsApp a preguntar dónde va su paquete,
o que asuma que no le mandaron nada.

**Qué habría que hacer.** Dos piezas, en este orden:

1. César arma (o publica) el workflow de GHL que reciba `pedido_enviado` y mande el correo o el
   WhatsApp al cliente, y entrega la URL del Inbound Webhook **como texto, nunca leída de una
   captura de pantalla**. Esa regla tiene una historia y por eso se obedece: el 31/08 se transcribió
   un tramo de URL desde una imagen —una «O» mayúscula y un «1» seguidos se leyeron como un cero— y
   **los cuatro primeros disparos, de las 16:55 a las 17:09, se fueron a una cuenta que no existe**; César no veía
   nada y se le fue la tarde a otra persona buscando el error de su lado. En cuanto se usó la URL tal
   como él la pegó como texto, llegó a la primera (`BITACORA.md:527-541`). `0`/`O`, `1`/`l`/`I` y
   `rn`/`m` son indistinguibles en una captura.
2. Alguien con acceso a Vercel pone `NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` en el entorno de producción y
   **hace un despliegue nuevo**: según `BITACORA.md:865-868`, en Vercel una variable nueva solo entra
   con un despliegue nuevo.

**Riesgo al conectarlo, documentado y ya pagado una vez.** GoHighLevel contesta `HTTP 200` a
cualquier URL de Inbound Webhook, exista o no. `BITACORA.md:493-513` lo demuestra: se le pegó a una
cuenta inexistente y contestó `{"status":"Success: test request received"}` con las mismas cabeceras
que un trigger real. Consecuencia directa sobre este código: `emitirEventoGhl` solo mira `res.ok`
(`server/utils/ghl.ts:100`), así que **el emisor reporta éxito siempre**. La única señal que sí
informa es el cuerpo de la respuesta, y solo en un sentido (`BITACORA.md:493-513`):

| Respuesta del webhook | Qué significa |
|---|---|
| `{"status":"Success: request sent to trigger execution server","id":"…"}` | Algo **sí** se ejecutó, y el `id` se busca en el historial |
| `{"status":"Success: test request received"}` | **No dice nada**: lo devuelve igual un trigger en muestra, una URL muerta y una cuenta que nunca existió |

Su presencia prueba que algo se ejecutó; su ausencia no prueba nada. Ojo: `BITACORA.md:645-650` trae
una tabla vieja del 28/08 que presenta la segunda fila como «el trigger NO está vivo»; quedó
desmentida tres días después y no hay que usarla. Además, GHL **puede regenerar la URL del webhook al
volver a guardar el trigger**, sin avisar, dejando la vieja contestando 200 desde un endpoint muerto
(`BITACORA.md:633-643`); no pasa siempre (`BITACORA.md:664-665`). Si un día los avisos dejan de llegar
sin que nada cambie del lado del sitio, lo primero que hay que dudar es de la URL.

**Riesgo de costo.** Los triggers de GHL son premium y se cobran **por uso**
(`server/utils/ghl.ts:12-17` y `.env.example:47-49`). No se disparan pruebas a lo tonto, y no se
pone una URL de producción en un entorno de desarrollo que genere tráfico.

---

## 3. Los campos dinámicos de los correos siguen sin cuadrar

**Qué es.** Del lado del sitio, el contrato de datos está cerrado y se puede leer entero:

- Compra confirmada: `payloadCompra()` en `server/utils/ghl.ts:156-201`. Manda `pedido_id`, `email`,
  `nombre`, `telefono`, `total`, `num_articulos`, el arreglo `items`, y además los aplanados
  `producto_principal`, `producto_principal_slug`, `url_producto`, `url_resena` y `urls_resena`.
- Pedido enviado: `payloadEnvio()` en `server/utils/ghl.ts:216-249`. Manda `pedido_id`, `email`,
  `nombre`, `telefono`, `guia`, `tiene_guia`, `total`, `num_articulos`, `items` y `items_texto`.
- Aviso a quien surte: `server/utils/avisoPedido.ts:77-92`. Manda `pedido_id`, `total`, `articulos`,
  `direccion`, `sin_direccion`, `es_regalo`, `telefono`, `email`, `mensaje` y `url_pedidos`.

**Los dos detalles que parecen raros y no lo son.** `items_texto` (`server/utils/ghl.ts:247`) es la
misma lista que `items` pero ya formateada como texto con saltos de línea, y va **además** del
arreglo, no en vez de. Existe porque GHL sufre para iterar un arreglo dentro de una plantilla de
correo: si le pasas `items` a secas sale `[object Object]` o JSON crudo. Lo mismo explica
`producto_principal` y compañía en `payloadCompra`. Y `guia` se manda como `null` explícito con un
`tiene_guia` aparte (`server/utils/ghl.ts:231-232`) porque a veces se marca el envío antes de tener
el número, y la plantilla necesita poder distinguir «ya salió, en cuanto tengamos la guía te la
pasamos» de pintar un hueco vacío.

**Lo que falta.** El mapeo del lado de GHL: qué campo de este payload entra en qué variable de cada
plantilla de correo. César lo pidió el 31/08 («échale ojo a los códigos de los correos que tienen
datos dinámicos … Marketing/correos electrónicos/Plantillas») y lo volvió a pedir por nota de voz el
15/09 (`BITACORA.md:46-48`). **Está del lado de GoHighLevel, no del repo**: desde aquí no se puede
ver ni arreglar. *(Estado del mapeo en GHL hoy: sin verificar desde el repo.)*

**Antecedente que explica por qué importa.** Hasta el 31/08 el evento de compra no mandaba nombre ni
teléfono, y por eso en el historial de postcompra de GHL el comprador aparecía como un ID sin
persona y una plantilla que saluda no tenía con qué saludar (`server/utils/ghl.ts:178-181`). Eso ya
se arregló del lado del sitio. Lo que queda es que la plantilla los lea.

---

## 4. La conversión de compra de Google Ads nunca se verificó en una venta real

**Qué es.** `composables/useAnalytics.ts:7` tiene el id de la acción de conversión «Compra» de Google
Ads en la constante `ADS_PURCHASE_CONVERSION`, y `useAnalytics().purchase()`
(`composables/useAnalytics.ts:55-77`) dispara dos cosas: el `purchase` de GA4 y el `conversion` de
Ads, con `value`, `currency: 'MXN'` y `transaction_id` para que Ads no cuente dos veces si el cliente
recarga la página de confirmación.

**Por qué importa en dinero.** Si esa conversión no llega, Google Ads optimiza a ciegas: no sabe qué
campaña, qué anuncio ni qué palabra produjo una venta, y el presupuesto se reparte por clics en vez
de por ventas. Con pauta encendida, cada día así es dinero gastado sin señal de retorno.

**Estado.** Nunca se comprobó con una compra real que la conversión llegue a la cuenta de Ads
(`BITACORA.md:49-52`). La compra del 02/09 no sirvió para eso, y la compra de prueba con tarjeta APRO
seguía sin hacerse; César se ofreció a hacerla el 16/09. *(Si ya se hizo y si Ads la registró: sin
verificar desde el repo — se ve en el panel de Google Ads.)*

**Antecedente que obliga a verificar y no a suponer.** El 31/08 se descubrió que GA4 llevaba desde el
día uno sin recibir **un solo dato**, y la causa era que el empujador del dataLayer mandaba un Array
en vez del objeto `arguments` que gtag.js necesita: fallaba en silencio, sin excepción y con la
consola limpia (`BITACORA.md:392-405`). La misma causa tumbaba `view_item`, `add_to_cart`,
`begin_checkout`, `purchase` **y la conversión de Ads**, porque todos salen por `w.gtag`. Se sacó el
empujador a `utils/gtag.ts` con prueba propia (`test/unit/gtag.test.ts`). La lección es la que aplica
aquí: **las pruebas verificaban el payload, nunca el vehículo**. Que `test/unit/analytics.test.ts:82-86`
pase no prueba que Ads reciba nada.

**Qué habría que hacer.** Una compra real, hecha llegando por un clic en un anuncio (una compra que
no vino de un anuncio no se puede atribuir nunca), y confirmar la conversión en el panel de Ads.
Requiere que alguien tenga acceso aceptado a Google Ads.

---

## 5. Los pagos que se confirman fuera de línea no se miden nunca

**Qué es.** La conversión de compra se dispara **en el navegador del cliente**, en
`pages/carrito.vue:76-81`, cuando la página se carga con `?status=success`:

```js
if (status.value === 'success') {
  if (cart.items.length) analytics.purchase((route.query.order as string) || '', cart.totalWithDiscount, cart.items)
  cart.clearCart()
}
```

Mercado Pago regresa al cliente solo cuando el pago se aprueba en el momento:
`server/api/checkout.post.ts:131-135` fija las `back_urls` y `auto_return: 'approved'`.

**El hueco.** Quien paga en **OXXO o por transferencia SPEI** confirma horas o días después y ya no
vuelve a esa página. Lo mismo quien cierra la pestaña en cuanto le aparece el comprobante. Esas
ventas entran al negocio de verdad —el webhook de Mercado Pago las marca `paid` en
`server/api/mp-webhook.post.ts:129-136`— pero **no se registran en Ads ni en GA4**. La consecuencia no
es un error visible: es que **Ads siempre va a reportar de menos**, y por lo tanto va a optimizar
hacia el tipo de comprador equivocado y a subestimar el retorno de la pauta.

Hay un segundo matiz del mismo código: la conversión solo se emite `if (cart.items.length)`. Si el
cliente vuelve del pago en otro navegador, con el carrito ya vaciado o desde el historial, tampoco se
emite. Esto suma al mismo sesgo.

**Qué habría que hacer.** Mandar las conversiones desde el servidor, desde el webhook de Mercado
Pago, que es el único punto que sí se entera de **todos** los pagos, sin importar el método ni si el
cliente volvió. Está anotado desde el 27/08 como «proyecto aparte, no vale la pena hasta que haya
volumen» (`BITACORA.md:854-862`), y esa sigue siendo una decisión de negocio: cuesta trabajo de dev y
solo se paga con volumen de pauta.

---

## 6. Deuda de pruebas

La suite está grande y en general sana: 26 archivos de vitest (24 en `test/unit`, 2 en `test/smoke`)
y 23 specs de Playwright en `test/e2e` (más `hidratacion.ts`, que es un ayudante, no un spec). Estos
son los agujeros conocidos:

**a) Un test que pasa en falso.** `test/e2e/busqueda-analytics.spec.ts:82-95` quiere probar que
cambiar un filtro con la misma búsqueda puesta no vuelve a emitir el evento `search`. Para navegar
sin recargar hace (`:91`):

```js
await page.evaluate(() => window.history.pushState({}, '', '/tienda?q=lubricante&sort=precio-asc'))
```

Un `pushState` crudo no notifica al router de Vue, así que el componente nunca reacciona y la
aserción `expect(await searches(page)).toHaveLength(1)` se cumple sin haber probado nada. El test es
verde y no cubre el caso. Lo correcto es navegar por la UI (dar clic al control de orden) o usar el
router de la app.

**b) Un test atado a un servicio de terceros, y no por donde parece.** El primer test de
`test/e2e/chat.spec.ts:14-22` exige que `POST /api/chat` devuelva 200 con un `response` no vacío, y
el de `chat.spec.ts:70` espera dos mensajes de bot con `timeout: 35000`. Ese endpoint es un proxy a
n8n. **El endpoint siempre tiene URL** —`nuxt.config.ts:99` la trae quemada como valor por defecto de
`n8nChatWebhook`, sobreescribible por `NUXT_N8N_CHAT_WEBHOOK` pero nunca vacía salvo que alguien la
vacíe a propósito—, así que el 503 de `chat.post.ts:8` casi no se ve. Lo que sí muerde es el tiempo:
si n8n tarda, el proxy espera hasta 30 s (`chat.post.ts:17-21`) y degrada a un texto de respaldo
(`chat.post.ts:29-31`) devolviendo **200**, con lo que el test de `chat.spec.ts:14-22` pasa igual sin
haber probado n8n; y el de `chat.spec.ts:70` espera 35 s dentro de un límite global de 45 s
(`playwright.config.ts:13`). Es un test que depende de un tercero y del reloj. Debería mockearse el
proxy.

**c) Tres specs completos que se saltan sin credenciales.** `test/e2e/account-auth.spec.ts:14`,
`test/e2e/coupons.spec.ts:17` y `test/e2e/orders.spec.ts:14` hacen `test.skip` si falta **cualquiera**
de `SB_URL`, `SB_ANON` o `SB_SVC`: con que sobre una, los tres specs completos se saltan. Son justo
los que cubren cuenta autenticada, cupones y pedidos —o sea, el dinero—. En la corrida completa del
10/09 quedaron 16 pruebas saltadas por esto (`BITACORA.md:25-28`). No es un bug: esos tests siembran
datos con la llave de servicio y esa llave no se versiona. Pero significa que **el camino del pedido
solo se prueba de verdad si el dev se molesta en exportar esas tres variables**, y por default nadie
lo hace. Además, `test/e2e/orders.spec.ts:76` y `:139` se saltan si `orders.user_id` sigue siendo
`NOT NULL`, con la instrucción del `ALTER` en el propio mensaje (ver punto 8).

**d) Menor y confuso, probablemente inerte.** 22 de los 23 specs de e2e siembran las cookies
`amanti_age_ok` y `amanti_cookie_consent` con `url: 'http://localhost:3010'` (por ejemplo
`test/e2e/chat.spec.ts:6-7`); el único que no lo hace es `compliance.spec.ts`. El servidor de pruebas
escucha en el 3457 (`playwright.config.ts:6`). Las cookies HTTP no se aíslan por puerto, así que lo
más probable es que apliquen igual y por eso la suite pasa; **no lo verifiqué**. De todos modos
conviene derivar la URL del `baseURL` de la config: hoy es una pista falsa esperando a quien depure la
próxima intermitencia.

*(Las trampas del entorno —el build que revienta con el servidor arriba, los timeouts por contención
de CPU, el `.output` viejo— están al principio de esta sección, en «Antes de tocar nada».)*

---

## 7. El formulario incrustado baja la librería de Meta aunque se rechacen las cookies

**Qué es.** El newsletter no es un formulario propio: es un iframe de GoHighLevel.
`components/NewsletterForm.vue:43` incrusta `https://link.amanti.mx/widget/form/<FORM_ID>` (el id está
en `NewsletterForm.vue:26`) y `NewsletterForm.vue:32-38` inyecta el script `form_embed.js` de GHL. Ese
componente se monta en **dos lugares** de todas las páginas: `components/WelcomeModal.vue:62` (el modal
de bienvenida) y `components/AppFooter.vue:11` (el pie).

**El hallazgo, ya calibrado.** Comprobado el 10/09 contra amanti.mx en 4 de 4 cargas con la cookie
`amanti_cookie_consent=rejected`: el iframe pide `connect.facebook.net/en_US/fbevents.js`
(`BITACORA.md:67-76`). El sitio en sí se comporta bien —`fbq` no existe en la ventana—, pero el iframe
de GHL trae su módulo de Pixel activo y descarga la librería por su cuenta. **El dato que calibra todo
está en `BITACORA.md:72`: según el HTML del propio formulario, no tiene Pixel asignado (`fbPixelId`
vacío).** O sea que descarga una librería que no tiene a qué cuenta reportar. Consistente con eso, en
la sonda local de 48 segundos no salió ninguna petición de evento a `facebook.com/tr`.

**Por qué importa de todos modos.** No afecta a clientes ni a ventas, y por eso está abajo en la
lista. Importa porque el sitio tiene un banner de consentimiento que promete una cosa y un tercero
incrustado hace otra, y eso es exactamente lo que se revisa en una auditoría de privacidad. Se le
pidió a César apagar el módulo de Pixel en el formulario el 10/09; quedó pendiente de su lado. *(Si ya
se apagó: sin verificar desde el repo — se ve en la configuración del formulario en GHL.)*

**Nota de forma, y es la parte útil.** El primer mensaje al grupo con este hallazgo se leyó como fuga
de datos («OMG», Raúl) y hubo que dedicar la tarde a aclararlo (`BITACORA.md:77-78`). Un hallazgo menor
se manda ya calibrado: gravedad, traza y qué NO es. El `fbPixelId` vacío es justo el dato que faltaba
en ese primer mensaje.

**Alternativa si alguna vez estorba:** quitar el iframe y capturar el correo con un formulario propio
que llame a la API de GHL desde el servidor. Ojo con lo que se pierde: el `form_embed.js` es lo que
mide el contenido real y le manda el alto al iframe; sin él el botón de enviar queda cortado y nadie
puede suscribirse (`NewsletterForm.vue:12-16`).

---

## 8. El esquema de la base de datos no se puede reconstruir desde el repo

**Qué es.** En `supabase/` hay ocho archivos SQL, y entre todos crean solo cuatro tablas: `leads`,
`wishlist_items`, `reviews` y `abandoned_carts` (`supabase/all.sql:9`, `:22`, `:39`, `:64`, más
`supabase/reviews.sql:9`, `supabase/wishlist.sql:9` y `supabase/abandoned-carts.sql:12`). Los demás son
solo `ALTER`: `supabase/orders-envio.sql:10-14` agrega `shipped_at` y `tracking`,
`supabase/orders-gift.sql:10` agrega `gift`, `supabase/addresses-colonia.sql:19` agrega `colonia`. El
octavo es `supabase/resenas-invitado.sql`, que abre el camino de reseñas sin cuenta y **ya corrió en
producción** (`BITACORA.md:870`); su cabecera explica por qué no abre ninguna política de RLS a `anon`
(el endpoint escribe con la llave de servicio, que se salta RLS; abrirla sería dejar la puerta que el
endpoint cuida).

**Lo que falta, en dos niveles:**

1. **No existe en ningún lado del repo un `create table` de `orders`, `order_items`, `coupons` ni
   `addresses`** —las cuatro tablas de las que depende todo el cobro— (verificado: `grep -ri "create
   table" supabase/` solo devuelve las cuatro de arriba). Se crearon a mano en el panel de Supabase y
   nunca se escribieron.
2. **Hay un `ALTER` que el repo pide y no trae.** `test/e2e/orders.spec.ts:76` salta la prueba de
   checkout de invitado con el comando en el mensaje: `ALTER TABLE public.orders ALTER COLUMN user_id
   DROP NOT NULL`. No hay archivo en `supabase/` que lo contenga. Si ese `ALTER` no corrió en la base
   de pruebas, dos pruebas del camino de invitado se saltan en silencio; y como **hasta ahora todos
   los pedidos han sido de invitado** (`server/api/mp-webhook.post.ts:172`), es justo el camino que más
   importa.

**Por qué importa.** Con esto no se puede levantar un entorno de staging, ni reconstruir la base si
algo pasa, ni probar una migración antes de correrla en producción. El día que haga falta, el dev
nuevo va a tener que reconstruir el esquema leyendo las consultas del código —`server/utils/orders.ts`,
`server/api/mp-webhook.post.ts`, `server/utils/coupons.ts:9-18` para la forma de `coupons`— y
adivinando tipos y restricciones.

**Qué habría que hacer.** Exportar el esquema real desde Supabase (`supabase db dump --schema-only` o
el SQL Editor) y commitearlo como el `0000-esquema-base.sql` que nunca existió, y de paso dejar el
`ALTER` de `user_id` como archivo. Es trabajo de una tarde y lo puede hacer el dev nuevo solo, en
cuanto tenga acceso al proyecto de Supabase.

---

## 9. Las existencias son una bandera manual en un JSON, hoy no hay ninguna puesta, y tarda hasta un día en llegar a Google

**Qué es.** El catálogo es un archivo fijo, `data/products.json`, sin sistema de inventario. Para
marcar algo agotado se le pone la bandera `agotado` al producto, se commitea y se despliega.

**Está bien cableado, y eso es lo bueno.** La bandera pega en cuatro superficies, no en tres, y la
cuarta es la que importa:

| Superficie | Dónde |
|---|---|
| Rechazo de la compra en el servidor | `resolveItems` (`server/utils/orderItems.ts:54-71`) |
| Ficha de producto | `pages/tienda/[slug].vue:249`, `:312` (schema.org `OutOfStock`) y `:444-445` |
| Feed de Google | `server/routes/feeds/google.xml.get.ts:132` (`out_of_stock`) |
| `/api/catalog` — lo que lee el agente de chat EROS | `server/api/catalog.get.ts:31` |

La cuarta se había olvidado (`BITACORA.md:319-331`) y era la peor: las otras tres solo *muestran* algo
que ya no hay, esa **recomienda** el producto en una conversación uno a uno; el comentario que quedó
en `server/api/catalog.get.ts:24-30` lo explica. La decisión de diseño que hay que respetar: el
rechazo vive en el servidor, no en la vista. `resolveItems` lanza 409 y nombra cuál quitar
(`server/utils/orderItems.ts:67-71`), y se llama desde `createPendingOrder` (`server/utils/orders.ts:87`),
que es la puerta única de los tres caminos de pago — Mercado Pago (`server/api/checkout.post.ts:75`),
WhatsApp (`server/api/order-whatsapp.post.ts:19`) y Stripe (`server/api/stripe-checkout.post.ts:28`).
Así no se puede comprar con la página abierta desde antes, con el carrito guardado ni entrando por el
enlace de un anuncio. Esconder el botón no bastaba.

**El pendiente real.** Hoy **cero productos** tienen la bandera `agotado` en `data/products.json` (cero
ocurrencias de la palabra en el archivo). O sea que el mecanismo existe, está probado y no se está
usando. El proceso depende de que Nancy avise que algo se agotó y de que un dev edite el JSON y
despliegue.

**Advertencia que hay que tener presente el día que se use: marcar algo agotado no llega a Google el
mismo día.** El feed se sirve con `Cache-Control: public, max-age=3600, s-maxage=86400`
(`server/routes/feeds/google.xml.get.ts:183`), o sea **hasta 24 horas de caché en el CDN** entre el
despliegue y que Merchant Center vea el `out_of_stock`. Esa ventana es exactamente aquella en la que se
siguen pagando clics hacia algo que no hay y en la que Merchant Center puede marcar la discrepancia que
advierte `google.xml.get.ts:129-132`. Si el faltante es de algo con pauta encendida, no basta con
desplegar: hay que pausar el anuncio o forzar la actualización desde Merchant Center.

**Qué habría que hacer.** A corto plazo, acordar con Nancy cómo avisa y que el dev lo aplique. A
mediano, es una decisión del dueño: o se mueven las existencias a Supabase con una pantalla donde Nancy
las edite sola, o se acepta que cada faltante cuesta un despliegue más un día de caché.

---

## 10. Trampas silenciosas que pueden costar dinero sin que nada truene

Ninguna está rota hoy. Todas se rompen en silencio, que es lo que las hace peligrosas.

**a) El umbral de envío gratis vive en dos constantes.** `stores/cart.ts:9` tiene
`FREE_SHIPPING_THRESHOLD = 1000` y `server/utils/costoEnvio.ts:19` tiene `UMBRAL_ENVIO_GRATIS = 1000`,
con un comentario que dice «Igual que en stores/cart.ts». Si alguien mueve una y no la otra, el carrito
enseña «Envío GRATIS» y el servidor cobra los $70, o al revés. Ya pasó una variante de esto: el carrito
medía el umbral **antes** del cupón y el servidor **después**, y una compra de $1,200 con cupón de $300
decía gratis en pantalla mientras Mercado Pago cobraba el envío (`BITACORA.md:787-789`). El servidor es
el autoritativo: `calcularEnvio()` (`server/utils/costoEnvio.ts:35-45`) mide sobre el subtotal ya con
descuento, y ante una entrada inválida **cobra**, porque equivocarse hacia «gratis» cuesta dinero en
cada pedido y no se nota hasta el corte del mes.

**b) Lo mismo con las dos variables del costo de envío.** El servidor lee `NUXT_ENVIO_COSTO`
(`server/utils/costoEnvio.ts:23`) y el carrito pinta con `NUXT_PUBLIC_ENVIO_COSTO`
(`nuxt.config.ts:121-125`, usado en `stores/cart.ts:140`). Tienen que tener el mismo valor. Si solo se
cambia una, el cliente ve un total y paga otro. Según `BITACORA.md:865-866` las dos se pusieron en
Vercel el mismo día con el valor 70. *(Qué valor tienen hoy: sin verificar desde el repo.)*

**c) El respaldo del teléfono de WhatsApp.** `nuxt.config.ts:114` tiene el número real como valor de
respaldo de `NUXT_PUBLIC_WHATSAPP_PHONE`, y el comentario de arriba (`nuxt.config.ts:102-113`) explica
por qué eso no es opcional: hasta el 31-ago-2026 esa línea tenía un número viejo, porque cuando cambió
el de AMANTI solo se actualizó la variable en Vercel. Si esa variable llegara a faltar —alguien la
borra, un entorno nuevo, un preview sin ella— los **nueve** lugares que arman enlaces de WhatsApp caen
al respaldo, incluido `stores/cart.ts`, que es por donde se piden pedidos. Serían pedidos yéndose al
número de un desconocido sin un solo error en ningún lado. **Ese valor de respaldo se mantiene
sincronizado con el número real, siempre.**

**d) El modo de prueba del webhook de Mercado Pago (está cerrado, y así tiene que quedarse).**
`server/api/mp-webhook.post.ts:56-61` permite simular un pago sin pasar por MP, pero exige cuatro
condiciones a la vez y la primera es `process.env.NODE_ENV !== 'production'`. Hoy está cerrado por
partida doble: `MP_WEBHOOK_TEST_MODE` solo vive en el `.env` local y en el entorno del servidor de
pruebas (`playwright.config.ts:43-45`), y en Vercel `NODE_ENV` vale `'production'`. El propio código lo
dice: «Imposible de activar en un deploy de producción» (`mp-webhook.post.ts:54-55`), y
`playwright.config.ts:41-42` lo repite desde el otro lado: «en prod (Vercel) NODE_ENV='production'
deshabilita el bypass aunque la var existiera». **El riesgo aparece únicamente si alguien copia
`MP_WEBHOOK_TEST_MODE` al entorno de producción Y además fuerza `NODE_ENV` a otra cosa; ninguna de las
dos hay que hacerla nunca.** *(Que la variable siga sin estar en Vercel producción: sin verificar desde
el repo.)*

**e) Identificadores de medición quemados en el código.** `plugins/tracking.client.ts:14-17` define las
constantes `GA_ID`, `ADS_ID`, `CLARITY_ID` y `PIXEL_ID` como literales, no como variables de entorno. Y
`plugins/tracking.client.ts:95` llama a `loadGoogle()` en **toda** carga de página, con o sin
consentimiento: lo que depende del consentimiento (`:96`) es `loadTrackers()`, que solo agrega Clarity y
el Pixel de Meta. Google se carga siempre a propósito, con Consent Mode v2 en `'denied'`
(`tracking.client.ts:1-11` y `:31-37`), para que llegue la señal agregada de quien no acepta.
**Consecuencia: cualquier despliegue de preview o cualquier entorno de pruebas manda señal a las
propiedades reales de GA4 (`:49`) y de Ads (`:52`) aunque el visitante rechace las cookies**, y ensucia
los datos de producción. Moverlas a runtime config es trabajo de media hora y lo puede hacer el dev
nuevo solo.

**f) Cableado muerto que parece vivo.** El evento `reactivacion` está declarado en el tipo `GhlEvento`
(`server/utils/ghl.ts:39`) y tiene su variable asignada (`server/utils/ghl.ts:60`), pero **nada en la
aplicación lo emite**: las únicas referencias fuera de ese archivo están en `test/unit/ghl.test.ts`. No
es un bug, pero que no se asuma que la secuencia de reactivación se dispara sola: no existe quien la
dispare.

**g) URLs de producción escritas a mano.** `server/utils/avisoPedido.ts:69` y `:90` meten
`https://amanti.mx/pedidos` como literal, mientras el resto del proyecto deriva la base desde
`server/utils/baseUrl.ts` o desde `NUXT_PUBLIC_SITE_URL` (así lo hace `payloadCompra` en
`server/utils/ghl.ts:165`). En un entorno que no sea producción, el aviso a Nancy manda a la pantalla de
producción. Es menor; se arregla en dos líneas.

---

## 11. El cerebro del chat EROS no está en este repo

**Qué es.** El widget de chat que ve el cliente es del sitio, pero `server/api/chat.post.ts` es **solo un
proxy**: recibe `{ message, sessionId, userName }`, lo reenvía a un webhook de n8n y devuelve
`{ response }` (`chat.post.ts:1-2`). El proxy existe para que el cliente nunca vea la URL de n8n y para
evitar CORS. **Toda la lógica del agente —prompt, herramientas, memoria de conversación, tono— vive en un
workflow de n8n que no está en el repo y que desde aquí no se puede leer ni versionar.** La URL de ese
webhook está quemada como valor por defecto en `nuxt.config.ts:99`, sobreescribible por
`NUXT_N8N_CHAT_WEBHOOK`.

**Lo que el repo sí controla.** Dos cosas, y conviene saberlo antes de culpar a n8n:

- El agente se alimenta del catálogo por `GET /api/catalog` (`server/api/catalog.get.ts`), que sí respeta
  la bandera `agotado` (`:31`). Si el agente recomienda algo agotado, el problema está en el JSON, no en
  n8n.
- La limpieza del Markdown que el agente a veces devuelve pese a las instrucciones se hace aquí
  (`chat.post.ts:23-27`), y el texto de respaldo cuando n8n no contesta también (`chat.post.ts:15`,
  `:29-31`).

**Por qué es un pendiente de traspaso y no solo una nota técnica.** El dev nuevo hereda un componente del
producto que no puede abrir, y **el subdominio del workspace de n8n que aparece en `nuxt.config.ts:99` no
es de AMANTI**: es el de un tercero. Si esa cuenta se cae, se vence o cambia de manos, el chat deja de
responder (degrada al texto de respaldo, así que se ve «amable» y no truena) y nadie del lado de AMANTI
puede entrar a arreglarlo. *(De quién es esa cuenta de n8n, si el workflow se transfiere y quién paga la
suscripción: sin verificar desde el repo — hay que preguntarlo y dejarlo por escrito. Va en la lista de
cuentas más abajo.)*

**Mientras tanto:** mover la URL a `NUXT_N8N_CHAT_WEBHOOK` en Vercel y quitarla del código es sano, porque
hoy el día que cambie hay que desplegar para moverla.

---

## 12. `.env.example` no lista siete variables que el código sí lee

**Qué es.** `.env.example` tiene 56 líneas y documenta bien Mercado Pago, Stripe, Supabase y los cinco
webhooks de GHL. Pero **el código lee variables que ese archivo no menciona**, así que quien levante un
entorno nuevo copiando `.env.example` cree que está completo y no lo está. Verificado con un barrido de
`process.env` sobre todo el repo:

| Variable | Quién la lee | Qué pasa si falta |
|---|---|---|
| `NUXT_ENVIO_COSTO` | `server/utils/costoEnvio.ts:23` | El servidor cobra **$0** de envío (el default es 0) |
| `NUXT_PUBLIC_ENVIO_COSTO` | `nuxt.config.ts:121-125`, `stores/cart.ts:140` | El carrito pinta envío gratis aunque el servidor cobre |
| `NUXT_PEDIDOS_PIN` | `server/api/pedidos.get.ts:17`, `server/api/pedido-enviado.post.ts:11` | La pantalla de pedidos de Nancy queda sin su PIN |
| `NUXT_RESENA_SECRET` | `server/utils/resenaToken.ts:27` | Los enlaces firmados de reseña dejan de validar |
| `NUXT_PROMO_VIGENCIA` | `server/routes/feeds/google.xml.get.ts:55` | El feed no manda `sale_price_effective_date` (hoy es lo deseado, punto 1) |
| `NUXT_N8N_CHAT_WEBHOOK` | `nuxt.config.ts:99` (sobreescribe el default) | Se usa la URL quemada en el código (punto 11) |
| `MP_WEBHOOK_TEST_MODE` | `server/api/mp-webhook.post.ts:58-60`, `playwright.config.ts:45` | Solo afecta pruebas; **en producción no debe existir** (punto 10d) |

A eso hay que sumarle `SB_URL`, `SB_ANON` y `SB_SVC`, que no son del sitio sino de las pruebas e2e
(`test/e2e/orders.spec.ts:6`), y que tampoco están documentadas en ningún `.env.example`.

**Por qué importa más de lo que parece.** Las dos primeras son las del punto 10b: un entorno levantado
desde `.env.example` **cobra $0 de envío y no avisa**. Las cuatro primeras se pusieron en Vercel el 27/08
(`BITACORA.md:865-867`) y nunca volvieron al archivo de ejemplo.

**Qué habría que hacer.** Completar `.env.example` con estas siete, cada una con su comentario de qué
pasa si falta, y añadir un bloque aparte para las tres de pruebas. Media hora, y lo puede hacer el dev
nuevo solo. El inventario completo y vigente vive en `07-variables-de-entorno.md`.

---

## 13. Higiene de secretos antes de que el repo cambie de manos

El repo no trae el `.env` —está en `.gitignore`— pero **sí trae archivos con identificadores en claro**.
No todos son secretos, y confundirlos hace perder tiempo o, peor, deja pasar el que sí importa. La
separación:

**Lo que hay que rotar, porque es una llave de disparo:**

- **La URL del Inbound Webhook del aviso de pedido de GHL se puede reconstruir desde el historial de
  git**: el identificador de la cuenta y el del trigger vivo estuvieron escritos en `BITACORA.md`
  (líneas 477 y 586 antes del 18/09, cuando se sustituyeron en la versión vigente). Quien la tenga
  puede ejecutar el workflow, y esos triggers **se cobran por uso** (`.env.example:47-49`). Borrarlos
  del archivo no la desactiva —siguen en el historial—; lo que la desactiva es que **César cree una URL
  nueva para ese trigger**, confirmando comparándolas como texto que de verdad cambió (re-guardar no
  siempre la cambia, `BITACORA.md:664-665`), y después actualizar `NUXT_GHL_WEBHOOK_AVISO_PEDIDO` en
  Vercel y redesplegar.
- **La contraseña de la cuenta compartida de Google** (`amanti.socialmedia@gmail.com`, la que tiene Ads,
  Tag Manager y Merchant Center) quedó escrita en el grupo de WhatsApp el 31/08. Se pidió cambiarla el
  mismo día y **no hay constancia de que se haya hecho** (`BITACORA.md:63-65`). Mientras no se rote, esa
  cuenta está comprometida para cualquiera con acceso al historial de ese grupo. Este es el punto más
  grave de la lista.

**Lo que NO es secreto y no hay que rotar** (son ids que salen al navegador en cada carga; se citan aquí
para que nadie pierda una tarde «asegurándolos»): los cuatro ids de medición de
`plugins/tracking.client.ts:14-17`, el id de la acción de conversión de `composables/useAnalytics.ts:7`,
el id del formulario de GHL (`components/NewsletterForm.vue:26`, también en `BITACORA.md:70`) y el
Customer ID de Google Ads (`BITACORA.md:57`). Lo que sí toca con estos es moverlos a runtime config
(punto 10e).

**Lo que hay que decidir antes de entregar:**

- **`BITACORA.md` viaja en el repo** (no está en `.gitignore`; sí está en `.vercelignore`, así que no se
  publica en el sitio, pero sí está en la historia de Git). Además de la URL del webhook, trae un
  **teléfono personal** en `BITACORA.md:546-547`. Hay que decidir si el archivo se entrega como está, se
  depura o se reemplaza por este paquete.
- **La URL del webhook de n8n está quemada en `nuxt.config.ts:99`** y por lo tanto en toda la historia de
  Git. Rotarla significa cambiar el webhook en n8n, que es de un tercero (punto 11).
- Los dos archivos sin versionar de la raíz (`AMANTI-Automatizaciones-2026-09-03.html` y `.pdf`) son un
  reporte con corte del 3 de septiembre: o se versionan o se entregan aparte, pero no se dejan al azar.

**Ojo con el reflejo equivocado:** reescribir la historia de Git para borrar estos valores rompe todos los
clones y no des-compromete nada, porque ya estuvieron expuestos. Lo que sirve es rotar la llave del lado de
GHL y cambiar la contraseña de Google.

---

## 14. Decisiones comerciales que siguen abiertas

Estas no las arregla el dev. Se listan porque son deuda real y alguien va a preguntar por ellas.

- **El envío se cobra $70 parejo y el costo real llega a $140.** Nancy avisó que en Morelia el costo real
  sube según la distancia; Raúl decidió dejarlo así: «Por ahora. El chiste es mover inventario y calar todo
  lo de la pagina» (`BITACORA.md:784-786`). Cada pedido lejano bajo el umbral pierde dinero. Es una
  decisión, no un bug — pero conviene revisarla cuando suba el volumen.
- **Stripe está construido y apagado.** Las llaves y el interruptor `NUXT_PUBLIC_STRIPE_ENABLED` existen
  (`.env.example:17-27`), el endpoint está escrito (`server/api/stripe-checkout.post.ts`) y el botón no se
  muestra. Encenderlo es decisión del dueño, y antes hay que probarlo de punta a punta: lleva tiempo sin
  ejercitarse.
- **Sprays bucales hidratantes.** El artículo 2 del blog los describe y en el catálogo no existe ninguno;
  quedó como información sin enlace. Se le preguntó a César si los quieren dar de alta y no hubo respuesta
  (`BITACORA.md:99-101`).

---

## 15. El dominio no tiene DMARC

**Qué es.** Verificado el 18/09/2026 contra el DNS público: `_dmarc.amanti.mx` **no existe**. El
correo del dominio sí tiene lo demás en orden —SPF de Zoho en la raíz, SPF de GoHighLevel y Mailgun
en `mail.amanti.mx`, y llaves DKIM en los dos (ver `14-traspaso-de-infraestructura.md`, paso 4)—,
pero sin DMARC falta la pieza que les dice a Gmail y Outlook qué hacer con un correo que dice venir
de `amanti.mx` y no pasa las pruebas.

**Por qué importa.** Dos cosas. Los correos de la tienda —confirmaciones, carrito abandonado,
reseñas— llegan con más desconfianza de la necesaria y acaban en spam con más facilidad; Gmail y
Yahoo exigen DMARC a quien manda volumen. Y cualquiera puede mandar correo haciéndose pasar por
`amanti.mx` sin que el dominio pida que se rechace.

**Qué habría que hacer.** Agregar en **Hostinger** (ahí viven los servidores de nombres, no en Wix
ni en Vercel) un registro TXT en `_dmarc.amanti.mx`. Empezar en modo observación, que no bloquea
nada: `v=DMARC1; p=none; rua=mailto:<un buzón que alguien lea>`. Tras unas semanas de reportes sin
sorpresas, subir a `p=quarantine`. Son cinco minutos y no toca código. Necesita acceso a la cuenta
de Hostinger, que hoy no se sabe a nombre de quién está.

---

## 16. `public/sitemap.xml` es estático y está desfasado

**Qué es.** El sitemap no se genera: es un archivo fijo en `public/`. Hoy lista **142** fichas de
producto contra las **152** del catálogo, y **6** artículos contra los **14** que hay en
`data/articles.json` (conteos exactos, ver `01-panorama.md` §9 y `08-despliegue.md`).

**Por qué importa.** Diez productos y ocho artículos no están en el mapa que se le da a Google para
descubrir el sitio. Probablemente los encuentra igual por los enlaces internos, pero más tarde y
sin garantía. El feed de Google Shopping **no** tiene este problema: ése sí se genera al vuelo.

**Qué habría que hacer.** Lo barato: actualizar el archivo a mano cada vez que se da de alta un
producto o un artículo, y meterlo en la receta de alta de `10-operacion.md`. Lo bueno: generarlo
desde `data/products.json` y `data/articles.json`, como ya se hace con el feed en
`server/routes/feeds/google.xml.get.ts`, para que no se pueda volver a desfasar. Lo puede hacer el
dev solo.

---

## Cuentas y accesos: qué viaja con el proyecto y qué no

Esta sección es el mapa mínimo para saber a quién pedirle qué. **Casi nada de esto se puede verificar
leyendo el repo**: lo que sigue sale de `BITACORA.md` y de lo que el código deja ver. El detalle del
traspaso está en `13-accesos-y-cuentas.md` y `14-traspaso-de-infraestructura.md`; aquí va solo lo que
bloquea los pendientes de arriba.

| Plataforma | Qué se sabe desde el repo | A quién se le pide |
|---|---|---|
| **Vercel** | Proyecto `amanti-store-cake` (`BITACORA.md:4`). Ahí viven todas las variables de entorno. Sin acceso no se resuelven los puntos 2, 10b ni 12 | Dueño de la cuenta de Vercel |
| **Supabase** | Base de `orders`, `order_items`, `coupons`, `addresses`, `reviews`… Sin acceso no se resuelve el punto 8 ni se revisan los cupones del punto 1 | Dueño del proyecto de Supabase |
| **GoHighLevel** | Subdominio `link.amanti.mx` (`components/NewsletterForm.vue:43`). Puntos 2, 3 y 7 están **todos** de ese lado. Emilio reenvió la invitación el 08/09 (`BITACORA.md:60-62`) | César / Emilio |
| **Google Ads** | Customer ID en `BITACORA.md:57`. Emilio dio acceso el 31/08 a `guillermo.sanchezy@gmail.com`; sin confirmación de que se haya aceptado (`BITACORA.md:55-57`) | Emilio |
| **Merchant Center** | Mismo caso que Ads, misma fecha | Emilio |
| **Google Tag Manager** | **Sigue sin dueño conocido.** Emilio: «google tag manager no tengo yo, me confundí con otra cuenta» (`BITACORA.md:58-59`) | Nadie identificado — hay que buscarlo |
| **n8n (agente EROS)** | El workspace del webhook de `nuxt.config.ts:99` **no es de AMANTI** (punto 11) | Sin identificar en el repo |
| **Mercado Pago** | Token y secreto de webhook por variable (`.env.example:9-15`) | Raúl / quien tenga la cuenta de MP |
| **Dominio amanti.mx** | Usado como canónico (`nuxt.config.ts:117`) y por `link.amanti.mx` en GHL | Sin verificar desde el repo |

**Lo importante de esta tabla no son las filas llenas, son las tres vacías**: Tag Manager, n8n y el
dominio. Son cuentas de las que hoy depende algo que está en producción y de las que nadie en el registro
dice ser dueño. Conseguir esas tres respuestas antes de que el dev anterior se vaya vale más que
cualquiera de los arreglos de código de esta sección.

---

## Cómo se reparte el trabajo

### Lo que el dev nuevo puede hacer solo, sin pedirle permiso a nadie

1. Arreglar el test que pasa en falso (`test/e2e/busqueda-analytics.spec.ts:82-95`).
2. Mockear el proxy de n8n en `test/e2e/chat.spec.ts` para sacar a un tercero y al reloj de la suite.
3. Derivar la URL de las cookies de prueba desde el `baseURL` de `playwright.config.ts`.
4. Bajar `BANNER_TEMPORADA.activo` a `false` (`utils/campana.ts:78`): ya caducó.
5. Mover `GA_ID`, `ADS_ID`, `CLARITY_ID` y `PIXEL_ID` a runtime config (`plugins/tracking.client.ts:14-17`).
6. Unificar el umbral de envío gratis en una sola constante compartida (`stores/cart.ts:9` /
   `server/utils/costoEnvio.ts:19`).
7. Quitar los literales `https://amanti.mx/pedidos` de `server/utils/avisoPedido.ts:69` y `:90`.
8. Documentar o quitar el evento `reactivacion`, que nadie emite.
9. Completar `.env.example` con las siete variables que faltan (punto 12).
10. Sacar la URL de n8n de `nuxt.config.ts:99` a `NUXT_N8N_CHAT_WEBHOOK`.

### Lo que necesita acceso a un panel que no es el repo

11. Exportar el esquema real de Supabase, con el `ALTER` de `orders.user_id`, y commitearlo (punto 8).
    Necesita acceso al proyecto de Supabase.
12. Poner `NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` en Vercel producción y redesplegar (punto 2). Necesita acceso a
    Vercel **y** que César entregue la URL del workflow, como texto.
13. Revisar si `NUXT_PROMO_VIGENCIA` tiene valor en Vercel **antes** del 30 de septiembre (punto 1).
14. Verificar la conversión de compra con una venta real (punto 4). Necesita acceso aceptado a Google Ads.
15. Apagar el módulo de Pixel del formulario del newsletter (punto 7). Está dentro de GoHighLevel: lo hace
    César.
16. Cuadrar los campos dinámicos de las plantillas de correo (punto 3). Está dentro de GoHighLevel: lo hace
    César.
17. Rotar la URL del webhook de postcompra y la contraseña de la cuenta compartida de Google (punto 13).

### Lo que necesita una decisión del dueño

18. **Apagar la campaña del 40% el 30 de septiembre** (punto 1). La fecha ya está acordada; lo que falta es
    que alguien la ejecute, y que antes se revisen los cupones activos y `NUXT_PROMO_VIGENCIA`.
19. Acoplar la fecha de fin de la campaña al feed para que no puedan discrepar (punto 1, camino 2). Cambia
    el comportamiento del precio que se cobra.
20. Mandar las conversiones desde el servidor para capturar OXXO y SPEI (punto 5). Es un proyecto, no un
    arreglo.
21. Sacar las existencias del JSON y ponerlas donde Nancy las edite sola (punto 9).
22. Definir de quién es la cuenta de n8n del agente EROS y si se transfiere (punto 11).
23. Revisar el cobro de envío de $70 (punto 14) y si se enciende Stripe.

---

## Lo que no pude verificar leyendo el repo

Todo lo de esta lista hay que abrirlo en el panel correspondiente antes de darlo por cierto:

- Qué variables de entorno están puestas hoy en Vercel producción, y en particular: si
  `NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` sigue faltando; **si `NUXT_PROMO_VIGENCIA` tiene valor** (si lo tiene,
  el feed ya está publicando fecha de fin y el riesgo del punto 1 está vivo hoy, no en hipótesis); qué valor
  tienen `NUXT_ENVIO_COSTO` y `NUXT_PUBLIC_ENVIO_COSTO`; y que `MP_WEBHOOK_TEST_MODE` **no** exista ahí.
- Qué filas hay en la tabla `coupons` de Supabase y cuáles están `active`.
- Si el `ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL` ya corrió en producción y en la base
  de pruebas.
- Si la compra de prueba con tarjeta APRO ya se hizo y si Google Ads registró la conversión.
- Si el módulo de Pixel del formulario de GHL ya se apagó.
- El estado del mapeo de campos dinámicos en las plantillas de correo de GoHighLevel.
- Si las invitaciones de Google Ads y Merchant Center (mandadas el 31/08) y la de GoHighLevel (reenviada el
  08/09) llegaron a aceptarse; no hay constancia posterior en el registro.
- Quién es dueño de la cuenta de Google Tag Manager. Según `BITACORA.md:58-59` sigue sin dueño conocido.
- De quién es la cuenta de n8n donde vive el agente EROS, quién la paga y si se transfiere.
- De quién es el dominio `amanti.mx` y dónde está registrado.
- Qué versión de Node usa el build de Vercel, y si el despliegue se dispara solo con el push a `master`.
- Si se cambió la contraseña de la cuenta compartida de Google que quedó escrita en el grupo de WhatsApp el
  31/08 (`BITACORA.md:63-65`). Se pidió el mismo día y no hay constancia de que se haya hecho. **Mientras no
  se rote, esa cuenta —que tiene Ads, Tag Manager y Merchant Center— está comprometida para cualquiera con
  acceso al historial de ese grupo.**
