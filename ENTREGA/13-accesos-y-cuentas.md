# Cuentas, accesos y rotación de secretos

Esta sección tiene dos partes. La primera es el inventario de todo lo que la tienda necesita de terceros para funcionar: para qué sirve cada servicio, qué se rompe según lo que se pierda, y en qué estado está ese acceso según lo último que quedó registrado en `BITACORA.md`. La segunda es la lista de rotación del día del corte, que es lo que hay que ejecutar cuando el desarrollador saliente deja de tener nada que ver con el proyecto.

Todo lo que se afirma aquí sale de leer el repositorio. Lo que solo se puede ver entrando a un panel (Vercel, Supabase, Mercado Pago, GoHighLevel, Google) va marcado como **sin verificar desde el repo**. Un hueco marcado es útil; un dato inventado en una lista de rotación te tumba producción.

En ningún punto de este documento aparece el valor de un secreto. Solo el nombre de la variable y dónde vive.

---

## 1. Inventario de servicios de terceros

### Resumen

Una distinción que hay que tener clara antes de leer la tabla, porque el resto de la sección depende de ella: **perder el acceso a un panel** y **perder la credencial que el sitio usa en tiempo de ejecución** son dos cosas distintas. El sitio corre con lo que ya está cargado en Vercel; que a ti te saquen de un panel no apaga nada por sí solo. Por eso la tabla tiene dos columnas.

| Servicio | Para qué | Si pierdes el acceso al panel | Si muere la credencial que usa el sitio |
|---|---|---|---|
| Vercel | Hosting y ejecución del sitio | No puedes desplegar ni cambiar variables: el sitio queda congelado en la última versión y no hay forma de corregirlo | No aplica: Vercel *es* el runtime |
| GitHub | Repositorio del código | No puedes cambiar el código ni disparar despliegues por push | No aplica |
| Supabase | Base de datos: cuentas, pedidos, carritos abandonados, reseñas | No puedes rotar llaves, correr SQL ni mirar los pedidos. El sitio sigue cobrando con la llave que ya tiene cargada | Sin `SUPABASE_SERVICE_ROLE_KEY` válida, todo pago con Mercado Pago responde HTTP 500 (`server/utils/supabaseAdmin.ts:13-19`) |
| Mercado Pago | Cobro principal | No puedes generar credenciales nuevas ni ver los pagos | Sin `NUXT_MP_ACCESS_TOKEN` no se puede cobrar: checkout y webhook responden 400 |
| Stripe | Cobro alterno con tarjeta (apagado hoy) | Nada inmediato: está desactivado | Nada: el botón no se muestra |
| GoHighLevel | Correos, secuencias y WhatsApp automáticos (lo opera César) | No puedes regenerar triggers ni ver el historial de ejecuciones, que es el único lugar donde se comprueba si un evento llegó | Con la URL muerta, el cliente deja de recibir acuses y Nancy deja de enterarse de los pedidos — **sin un solo error en los registros** |
| n8n Cloud | Cerebro del chat EROS | No puedes regenerar ni revisar el webhook; el chat sigue vivo | El día que esa URL muera, EROS contesta siempre el mensaje de respaldo, sin error visible |
| Google Ads | Campañas y conversión de compra (lo opera Emilio) | No puedes medir ni pautar | No aplica: el identificador está en el código |
| Google Merchant Center | Feed de productos de Google Shopping | No puedes atender suspensiones; los productos acaban saliendo de Shopping | No aplica: el feed es público y sin autenticación |
| Google Analytics 4 | Medición del sitio | Se pierde el histórico, y no se recupera | No aplica |
| Google Tag Manager | Etiquetado | Nada: el sitio no lo carga | No aplica |
| Microsoft Clarity | Grabación de sesión | Se pierde la grabación de sesión | No aplica |
| Meta (Pixel) | Medición y remarketing | Se pierde la medición de Meta | No aplica |
| Dominio `amanti.mx` | Sitio y subdominio de GoHighLevel | No puedes mover DNS ni renovar | Si cae el DNS, se cae el sitio y el formulario del newsletter |
| Número de WhatsApp | Pedidos y atención | No aplica | Los pedidos por WhatsApp se van a la nada |

Estado de cada acceso, según la bitácora:

| Servicio | Estado del acceso |
|---|---|
| Google Ads y Merchant Center | Acceso dado el 31/08 a las 11:59 a.m.; **sin confirmación posterior de haber entrado** (`BITACORA.md:55-57`) |
| GoHighLevel | Invitación reenviada el 08/09 a las 12:13 p.m., tercera vez que se pedía; **sin confirmación de acceso** (`BITACORA.md:60-62`) |
| Google Tag Manager | **Sin dueño conocido.** Emilio: «google tag manager no tengo yo, me confundí con otra cuenta» (`BITACORA.md:58-59`) |
| Google Analytics 4 | Propiedad bajo una cuenta personal del desarrollador saliente (`BITACORA.md:414-415`) |
| Todos los demás | Sin verificar desde el repo |

### Detalle, servicio por servicio

**Vercel.** Es donde corre el sitio. El proyecto se llama `amanti-store-cake` y produce `https://amanti.mx` (`BITACORA.md:4`). Vercel también hace de optimizador de imágenes: `nuxt.config.ts:18` cambia de proveedor según si corre en Vercel o en local, así que en producción las fotos pasan por su servicio nativo. Además, **todas las variables de entorno de producción viven aquí**, y por lo tanto todo lo de la sección 4 se ejecuta en este panel.

**GitHub.** El repositorio es `memorx/amanti-store` (`BITACORA.md:4`). Los secretos nunca se commitearon: `.gitignore:5-7` excluye `.env` y cualquier `.env.*`, dejando pasar únicamente `.env.example`, que es una plantilla con los valores vacíos. Ojo con una cosa: el nombre de la cuenta de GitHub es personal del desarrollador saliente, así que si el repositorio vive bajo esa cuenta y no bajo una organización, transferir la propiedad es parte del corte. Eso **no se puede verificar desde el repo**.

**Supabase.** Base de datos de todo lo que el sitio guarda: pedidos, artículos de cada pedido, direcciones, carritos abandonados y reseñas. El módulo está declarado en `nuxt.config.ts:6` y configurado en `nuxt.config.ts:8-14`. Hay dos llaves y no son lo mismo:

- `SUPABASE_URL` y `SUPABASE_KEY` son la URL del proyecto y la llave *anon/pública* (`.env.example:34-36`). La anon viaja al navegador por diseño: no es un secreto.
- `SUPABASE_SERVICE_ROLE_KEY` sí lo es. Solo vive en el servidor y `server/utils/supabaseAdmin.ts:3-5` lo dice explícitamente. Es la que usan el checkout, el webhook de Mercado Pago y la creación de pedidos. `.env.example:38-40` es tajante: **sin ella, todo pago con Mercado Pago devuelve HTTP 500**, y `server/utils/supabaseAdmin.ts:13-19` es donde revienta.

La sección 5 explica qué hay debajo de esa llave y por qué rotarla no cambia ningún permiso.

**Mercado Pago.** El cobro principal, con Checkout Pro. Usa dos secretos:

- `NUXT_MP_ACCESS_TOKEN` para crear la preferencia de pago (`server/api/checkout.post.ts:64`) y para reconsultar el pago cuando llega la notificación (`server/api/mp-webhook.post.ts:44`). Sin él, el checkout responde 400 con un mensaje explícito (`server/api/checkout.post.ts:65-67`) y el webhook también (`server/api/mp-webhook.post.ts:87`).
- `NUXT_MP_WEBHOOK_SECRET` valida la firma HMAC de las notificaciones (`server/api/mp-webhook.post.ts:65-79`). Es defensa en profundidad: el pago se reverifica de todos modos contra la API de Mercado Pago, que es la fuente de verdad (`server/api/mp-webhook.post.ts:82-97`).

**Stripe.** Camino alterno para cobrar con tarjeta, hoy apagado: el botón solo aparece si `NUXT_PUBLIC_STRIPE_ENABLED` vale `"1"`, y el valor por defecto en el código está vacío (`nuxt.config.ts:119-120`). Sus dos secretos son `NUXT_STRIPE_SECRET_KEY` y `NUXT_STRIPE_WEBHOOK_SECRET` (`.env.example:17-27`). El procedimiento completo de alta está en `SETUP.md:44-60`. Si hay o no llaves cargadas hoy en Vercel es algo que **no se puede verificar desde el repo**.

**GoHighLevel.** Es la herramienta de marketing que opera César: de ahí salen los correos de postcompra, la secuencia de reseña, la de carrito abandonado, el aviso de WhatsApp a Nancy para que surta y el aviso de envío al cliente. GHL no sabe nada de la tienda por sí solo; el sitio se lo cuenta con webhooks, uno por automatización (`server/utils/ghl.ts:57-63`). Dos rarezas que tienen razón dura detrás y conviene entender antes de tocar nada:

- **No hay un webhook global.** GHL genera una URL distinta por cada workflow, así que el evento no viaja como campo dentro del mensaje: el evento *es* la URL a la que se manda (`server/utils/ghl.ts:7-10`).
- **Cada disparo cuesta dinero.** Los triggers son premium y se cobran por uso (`server/utils/ghl.ts:12-17`, repetido en `.env.example:47-49`). Por eso quien tenga una de esas URLs puede disparar el workflow y generarle cobro a AMANTI sin necesitar ninguna contraseña. Son llaves, aunque parezcan simples direcciones.

El mapa de `server/utils/ghl.ts:57-63` declara **cinco** eventos, pero el sitio solo emite **cuatro**. `reactivacion` existe como miembro del tipo (`server/utils/ghl.ts:39`) y como fila del mapa (`server/utils/ghl.ts:60`), y ningún llamador lo dispara. Los cuatro vivos y quién los emite:

| Evento | Variable | Quién lo dispara |
|---|---|---|
| `compra_confirmada` | `NUXT_GHL_WEBHOOK_POSTCOMPRA` | `server/api/mp-webhook.post.ts:198` |
| `carrito_abandonado` | `NUXT_GHL_WEBHOOK_CARRITO_ABANDONADO` | `server/api/cart-save.post.ts:78` |
| `pedido_para_surtir` | `NUXT_GHL_WEBHOOK_AVISO_PEDIDO` | `server/utils/avisoPedido.ts:79` |
| `pedido_enviado` | `NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` | `server/api/pedido-enviado.post.ts:44` |
| `reactivacion` | `NUXT_GHL_WEBHOOK_REACTIVACION` | **Nadie.** Declarado y muerto |

La razón de que `reactivacion` esté muerto no es un olvido y está escrita en el propio paquete de entrega: el sitio no sabe «agendar algo a 60 días», GHL sí, y GHL ya recibe la fecha de cada compra dentro del aviso de postcompra. Por eso la reactivación es un workflow de César con su propio calendario, que no necesita nada del sitio (`AMANTI-Automatizaciones-2026-09-03.html:334`).

El sitio, además, embebe un formulario de GoHighLevel para el newsletter, servido desde `link.amanti.mx` (`components/NewsletterForm.vue:26-28,43`). Ese subdominio apunta a GHL: si alguien mueve el DNS de `amanti.mx`, el formulario del pie y el del modal se caen.

**n8n Cloud.** Es lo que le da respuestas al chat EROS. El sitio no habla con n8n desde el navegador: `server/api/chat.post.ts` hace de intermediario para que el cliente nunca vea la URL y para evitar CORS (`server/api/chat.post.ts:1-2`). La URL vive en `nuxt.config.ts:99` y se puede pisar con `NUXT_N8N_CHAT_WEBHOOK`.

> **Advertencia.** Esa URL por defecto está escrita en el código, no vacía, y apunta a un subdominio de n8n Cloud que **no es de AMANTI**. Es la misma trampa que ya se documentó con el teléfono de WhatsApp en `nuxt.config.ts:104-113`: mientras la variable de entorno exista, nadie se entera del respaldo; el día que falte —alguien la borra, un entorno nuevo, un despliegue de vista previa sin ella— el sitio manda las conversaciones de los clientes a un servicio de un tercero, en silencio. Vale la pena vaciar ese valor por defecto y dejar que el chat se apague limpio si no está configurado, que es lo que ya hace `server/api/chat.post.ts:8`.

**Google Ads.** Lo opera Emilio. La cuenta es el Customer ID `697-248-9635` (`BITACORA.md:57`). El sitio le manda dos cosas: la configuración de la cuenta de Ads, que se carga junto con GA4 desde `plugins/tracking.client.ts:15,52`, y la conversión de compra, cuya etiqueta está en `composables/useAnalytics.ts:7` y que —según el comentario de esa misma línea— la creó Emilio del lado de Ads. Hay un hueco conocido y anotado: la conversión se dispara en el navegador, en la página de confirmación, así que quien paga en OXXO o por transferencia y ya no vuelve al sitio nunca queda registrado. Ads siempre va a reportar de menos (`BITACORA.md:854-862`).

**Google Merchant Center.** Recibe el feed de productos que el sitio genera solo, en `/feeds/google.xml`, a partir de `data/products.json` (`server/routes/feeds/google.xml.get.ts:1-16`). El feed es público y no tiene autenticación, así que no hay ningún secreto que rotar aquí; lo que hay que cuidar es el acceso a la cuenta de Merchant.

**Google Analytics 4.** El identificador de medición está en `plugins/tracking.client.ts:14`. Ahí hay un punto delicado para el corte: la bitácora registra que la propiedad de AMANTI vive **bajo una cuenta personal del desarrollador saliente** (`BITACORA.md:414-415`). Si esa cuenta se cierra o se le retira el acceso antes de nombrar administrador a alguien de AMANTI, se pierde la propiedad y con ella el histórico. Y el histórico no se recupera: GA4 no rellena hacia atrás (`BITACORA.md:463`).

**Google Tag Manager.** No tiene dueño conocido. Emilio dijo textualmente que no lo tiene él (`BITACORA.md:58-59`). El sitio **no** carga Tag Manager: mete gtag.js directo desde `plugins/tracking.client.ts:43-52`, así que hoy no depende de esa cuenta para nada. Queda anotado porque un día alguien va a preguntar.

**Microsoft Clarity y Meta Pixel.** Sus identificadores están en `plugins/tracking.client.ts:16-17`. A diferencia de Google, estos dos **no se cargan sin aceptación explícita de cookies**, y la razón está escrita en `plugins/tracking.client.ts:7-8`: no tienen un estado «denegado» equivalente al Consent Mode de Google, y Clarity graba la sesión completa. Google sí se carga siempre, pero arranca con el consentimiento denegado en las cuatro señales (`plugins/tracking.client.ts:31-37`).

**Dominio y WhatsApp.** `amanti.mx` sirve el sitio y `link.amanti.mx` el formulario de GHL. El número de WhatsApp vive en `NUXT_PUBLIC_WHATSAPP_PHONE` y tiene respaldo en `nuxt.config.ts:114`. Ese respaldo estuvo mal durante meses y el comentario de `nuxt.config.ts:104-113` explica por qué importa: son nueve lugares del sitio los que arman enlaces de WhatsApp, incluido el carrito, que es por donde se piden pedidos. Verifica que la variable existe en producción antes de dar el corte por bueno.

---

## 2. Mapa de variables de entorno

Dónde vive cada cosa y qué pasa si falta. Las de producción se cargan en el panel de Vercel; en local van en un `.env` que nunca se commitea (`.gitignore:5-7`).

> **Este mapa está completo; `.env.example` no.** La plantilla del repo termina en la línea 57 y solo documenta WhatsApp, Mercado Pago, Stripe, las URLs públicas, Supabase y los cinco webhooks de GHL. No menciona `NUXT_RESENA_SECRET`, `NUXT_PEDIDOS_PIN`, `NUXT_N8N_CHAT_WEBHOOK`, `NUXT_ENVIO_COSTO`, `NUXT_PUBLIC_ENVIO_COSTO` ni `NUXT_PROMO_VIGENCIA`. Si levantas un entorno copiando `.env.example` tal cual, arrancas con la mitad de las cosas apagadas y sin ningún aviso.

### Variables del sitio en producción

| Variable | Servicio | ¿Es secreto? | Si falta |
|---|---|---|---|
| `SUPABASE_URL` | Supabase | No | El sitio no arranca contra la base |
| `SUPABASE_KEY` | Supabase (anon) | No, viaja al navegador | No hay cuentas ni sesión |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | **Sí, crítico** | Todo pago con Mercado Pago responde 500 |
| `NUXT_MP_ACCESS_TOKEN` | Mercado Pago | **Sí, crítico** | No se puede cobrar: checkout y webhook responden 400 |
| `NUXT_MP_WEBHOOK_SECRET` | Mercado Pago | **Sí** | Se omite la validación de firma (`server/api/mp-webhook.post.ts:66`); el pago se reverifica igual contra la API de MP |
| `NUXT_STRIPE_SECRET_KEY` | Stripe | **Sí** | `/api/stripe-checkout` responde 400 (Stripe está apagado) |
| `NUXT_STRIPE_WEBHOOK_SECRET` | Stripe | **Sí** | El webhook de Stripe queda apagado: responde 400 y ningún pago de Stripe se confirma (`server/api/stripe-webhook.post.ts:67`). Al revés que MercadoPago, aquí la firma es obligatoria y no hay modo degradado |
| `NUXT_GHL_WEBHOOK_POSTCOMPRA` | GoHighLevel | **Sí, genera cobro** | No sale el correo de postcompra ni la secuencia de reseña |
| `NUXT_GHL_WEBHOOK_CARRITO_ABANDONADO` | GoHighLevel | **Sí, genera cobro** | No sale la secuencia de carrito abandonado |
| `NUXT_GHL_WEBHOOK_REACTIVACION` | GoHighLevel | No, en la práctica | No pasa nada: el sitio nunca emite este evento (`server/utils/ghl.ts:39,60`, sin ningún llamador). La variable está declarada pero muerta |
| `NUXT_GHL_WEBHOOK_AVISO_PEDIDO` | GoHighLevel | **Sí, genera cobro** | Nancy no se entera de los pedidos |
| `NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` | GoHighLevel | **Sí, genera cobro** | El cliente no recibe su guía |
| `NUXT_RESENA_SECRET` | Propio (HMAC) | **Sí** | Las reseñas de invitado quedan apagadas (404 en `/api/resena`) |
| `NUXT_PEDIDOS_PIN` | Propio | **Sí** | `/api/pedidos` y `/api/pedido-enviado` se apagan con 404 |
| `NUXT_N8N_CHAT_WEBHOOK` | n8n | **Sí** | Cae al valor por defecto del código, que apunta a un tercero |
| `NUXT_PUBLIC_WHATSAPP_PHONE` | WhatsApp | No | Cae al respaldo de `nuxt.config.ts:114` |
| `NUXT_PUBLIC_SITE_URL` / `NUXT_PUBLIC_PUBLIC_BASE_URL` | Propias | No | Se rompen los enlaces absolutos y los redirects de pago |
| `NUXT_ENVIO_COSTO` / `NUXT_PUBLIC_ENVIO_COSTO` | Propias | No | Envío gratis para todos; los dos deben tener el mismo valor (`nuxt.config.ts:121-125`) |
| `NUXT_PROMO_VIGENCIA` | Merchant Center | No | El feed no manda fecha de corte de la promoción |

### La variable que no aparecía en ningún mapa y sí tiene poder

> ⚠️ **`MP_WEBHOOK_TEST_MODE` puede marcar pedidos como pagados sin que exista ningún pago.** Si está presente, y el cuerpo de la petición trae un `__test_secret` que coincida con su valor más un `__test_payment`, el webhook de Mercado Pago **se salta la validación de firma y se salta la consulta a la API de MP**, y toma como verdadero el pago que venga en el cuerpo (`server/api/mp-webhook.post.ts:54-61,84-85`). Lo único que impide eso en producción es la primera condición del `and`: `process.env.NODE_ENV !== 'production'` (`server/api/mp-webhook.post.ts:57`). Existe para que la suite e2e pueda simular pagos sin tocar Mercado Pago (`playwright.config.ts:41-45`). **Nunca la cargues en Vercel producción**, y si aparece ahí, bórrala y averigua quién la puso.

### Variables que solo existen en el shell de quien corre pruebas

No van en Vercel. Van en la máquina de quien corre la suite de punta a punta.

| Variable | Para qué | Si falta |
|---|---|---|
| `SB_SVC` | La service_role de Supabase que Playwright le pasa al servidor de prueba (`playwright.config.ts:35-37`) | Las pruebas que tocan pedidos quedan **saltadas**, no rojas |
| `SB_URL`, `SB_ANON` | URL y llave anon para que los specs siembren datos (`test/e2e/orders.spec.ts:6,14`) | Igual: `test.skip(...)`, verde engañoso |
| `MP_WEBHOOK_TEST_MODE` | El bypass de arriba, en local (`playwright.config.ts:45`) | Los e2e de pago no pueden simular un pago |
| `E2E_PORT` | Puerto del servidor de prueba, por defecto 3457 (`playwright.config.ts:6`) | Nada; el 3010 está descartado porque cae en el rango que Windows reserva |

### Las tres variables «propias» que sí son secretos y que quizá no parecen serlo

- **`NUXT_PEDIDOS_PIN`** protege `/api/pedidos`, que es la pantalla desde la que Nancy ve qué surtir. Ese endpoint expone nombre, teléfono y domicilio de clientes reales, y el propio código lo dice y explica por qué es un PIN y no autenticación de verdad (`server/api/pedidos.get.ts:6-12`). El mismo PIN protege el marcado de envío (`server/api/pedido-enviado.post.ts:11`). Sin PIN configurado el endpoint queda apagado con 404, no abierto: un descuido de configuración no puede terminar publicando domicilios.
- **`NUXT_RESENA_SECRET`** es la llave con la que se firma el permiso para dejar reseña sin tener cuenta. La firma amarra (pedido, producto) y solo se puede fabricar con la llave (`server/utils/resenaToken.ts:39-43`). Quien la tenga puede falsificar reseñas atadas a compras reales.
- **`NUXT_N8N_CHAT_WEBHOOK`**, ya explicado arriba.

---

## 3. Secretos que ya están fuera del sobre

Antes de la lista de rotación, los hechos concretos que son la razón de que la lista tenga que ejecutarse completa y no «por si acaso».

**Una contraseña quedó escrita en un chat de grupo.** El 31/08 se escribieron en el grupo el usuario y la contraseña de la cuenta compartida de Google `amanti.socialmedia@gmail.com`, que es la que tiene Google Ads, Tag Manager y Merchant Center. Se pidió ese mismo día que se cambiara y **no hay constancia de que se haya hecho** (`BITACORA.md:63-65` y `BITACORA.md:377-378`). El historial del grupo conserva ese mensaje, y un grupo de WhatsApp no se puede «des-enviar». Esta es la prioridad número uno de la lista.

**Una URL viva de GoHighLevel se puede reconstruir entera con el historial del repositorio.** No estuvo nunca escrita completa en un solo lugar; eran tres pedazos en tres lugares distintos que juntos la arman:

| Pedazo | Dónde vivía | Qué es |
|---|---|---|
| Host y forma | `test/unit/ghl.test.ts:21` | `services.leadconnectorhq.com` y el patrón `/hooks/<cuenta>/webhook-trigger/<id>`. Esto no es secreto: es el formato público de GHL |
| Tramo de cuenta | `BITACORA.md:528-529`, sustituido el 18/09 | El identificador de la cuenta de GHL de César, dentro de la explicación del error de transcripción del 31/08 |
| Identificador del trigger | `BITACORA.md:638`, sustituido el 18/09 | La comparación «vieja (muerta) / nueva (viva)» del trigger de **aviso de pedido** (`NUXT_GHL_WEBHOOK_AVISO_PEDIDO`) |

El 18/09, al preparar esta entrega, los dos identificadores se sustituyeron en la versión vigente de `BITACORA.md`. Se verificó con `grep` sobre todo el repositorio (sin `node_modules`) que ya no aparecen en ningún archivo. El id de ejecución que queda en `BITACORA.md:665` no es secreto: identifica una corrida, no sirve para disparar nada.

**Pero eso no desactiva el secreto: lo desactiva rotarlo.** Los dos identificadores siguen en el historial de git y en cualquier copia del repo hecha antes del 18/09. La única acción que vuelve inofensiva esa URL es que **César cree una URL nueva para el trigger de aviso de pedido** y se actualice la variable en Vercel. Compara la vieja y la nueva como texto para confirmar que de verdad cambió: volver a guardar un trigger no siempre cambia su URL (`BITACORA.md:664-665`).

**Y esto ya pasó antes, con la misma cadena.** Un identificador vivo de GHL se filtró desde esta misma bitácora a un documento hecho para copiarse a otros repos. No se detectó por casualidad: se detectó en una segunda pasada de verificación en la que se abrieron las 291 citas del documento una por una, y entre los 32 problemas que salieron, 7 graves, estaba ese (`BITACORA.md:350-357`). La lección que la propia bitácora saca vale para todo lo que escribas tú también: «un documento generado no está terminado hasta que sus citas se abrieron una por una» (`BITACORA.md:366-369`).

A esto se suma lo obvio: existe un archivo `.env` local en la máquina del desarrollador saliente, y la suite de punta a punta lee la llave de servicio de Supabase desde su shell como `SB_SVC` (`playwright.config.ts:35-37`). Todo secreto que alguna vez estuvo en esa máquina se considera conocido por él.

---

## 4. La lista de rotación del día del corte

Es un corte limpio. Todo secreto que pasó por manos del desarrollador saliente se rota. La lista está ordenada a propósito: **primero lo que no puede tumbar producción, al final lo que sí.**

### Regla que aplica a toda la lista, y que se ha cobrado tiempo antes

**En Vercel, una variable nueva o modificada no entra en vigor hasta que hay un despliegue nuevo.** Está registrado con nombre y apellido: el 27/08 hubo que hacer un commit vacío justo para eso (`BITACORA.md:865-868`). Si cambias una variable y no redespliegas, el sitio sigue usando el valor viejo y todo parece funcionar, hasta que deja de funcionar en un momento que no vas a poder relacionar con lo que hiciste.

#### Cómo se redespliega, en concreto

El único mecanismo que queda registrado en el repositorio es el **commit vacío** (`BITACORA.md:867-868`): un commit sin cambios sobre la rama que Vercel tiene conectada, empujado a GitHub, que dispara una construcción nueva desde cero.

```
git commit --allow-empty -m "redeploy: recarga de variables de entorno"
git push
```

Es el camino recomendado porque no depende de ningún detalle del panel y porque deja huella en el historial de por qué se redesplegó. Los otros dos caminos posibles —el botón «Redeploy» del panel de Vercel y `vercel --prod` desde la CLI— **no están documentados en el repositorio**, y en particular **no se puede verificar desde el repo** si el botón «Redeploy» reconstruye tomando las variables nuevas o reutiliza una construcción en caché. Hasta que alguien lo compruebe en el panel, usa el commit vacío.

Dos cosas más, y las dos son huecos que hay que cerrar tú:

- **Quién tiene permiso para desplegar** no se puede saber desde el repo. Averígualo **antes** de empezar la lista, no a mitad del Grupo D.
- La bitácora sí registra que alguien tenía la **CLI de Vercel** enlazada al proyecto, porque desde ella se corrió `vercel env ls production` (`BITACORA.md:602-604`). Si esa CLI estaba enlazada en la máquina del saliente, la sesión también se revoca.

#### Cómo comprobar qué variables están puestas, sin abrir el panel

```
vercel env ls production
```

Es exactamente lo que se usó el 31/08 para confirmar que `NUXT_GHL_WEBHOOK_AVISO_PEDIDO` y `NUXT_GHL_WEBHOOK_POSTCOMPRA` estaban cargadas, y desde cuándo (`BITACORA.md:602-604`). Lista nombres y antigüedad, no valores. Es la primera cosa que hay que correr el día del corte y otra vez al terminar.

#### Segunda regla, más corta

**Una URL, una llave o un identificador no se transcriben desde una captura de pantalla; se piden como texto.** El `0` y la `O`, el `1`, la `l` y la `I`, el `rn` y la `m` son indistinguibles en una imagen. Esa confusión ya mandó cuatro disparos a una cuenta inexistente y le costó tres horas a otra persona (`BITACORA.md:527-544`).

#### Advertencia — el código se contradice sobre el redespliegue

El comentario de `server/routes/feeds/google.xml.get.ts:48-51` dice que `NUXT_PROMO_VIGENCIA` «se cambia la variable en Vercel sin desplegar». Eso no cuadra con lo observado en la bitácora, y además esa variable se lee en el nivel superior del módulo (`server/routes/feeds/google.xml.get.ts:55`), no dentro del manejador de la petición, así que se evalúa una sola vez al cargarse. Trata ese comentario como equivocado: **redespliega siempre.**

### Paso 0 — Antes de rotar nada

1. **Asegúrate de que alguien de AMANTI tiene acceso de administrador o propietario a cada panel.** Si el único administrador de un servicio es el desarrollador saliente y le quitas el acceso primero, te quedas fuera tú también. Esto aplica con especial fuerza a **Google Analytics 4**, donde la propiedad está bajo una cuenta personal (`BITACORA.md:414-415`): nombra administrador a una cuenta de AMANTI **antes** de retirar la vieja, o pierdes el histórico completo.
2. **Ten a la mano quién puede desplegar en Vercel.** Media lista de abajo no sirve sin un despliegue.
3. **Corre `vercel env ls production` y guarda la salida.** Es tu foto del «antes». Si algo se rompe a mitad del corte, es con lo que comparas.
4. **Avisa a Nancy y a César.** Va a haber una ventana en la que los avisos automáticos pueden no salir. Es mejor que lo sepan antes que se enteren por un cliente.

### Grupo A — Sin riesgo para producción. Hacer primero, hoy mismo

| # | Qué se rota | Dónde | ¿Redespliegue? |
|---|---|---|---|
| A1 | Contraseña de `amanti.socialmedia@gmail.com` | Cuenta de Google | No |
| A2 | Retiro de accesos por usuario | Cada panel | No |

**A1 — La contraseña que quedó en el grupo.** Prioridad alta. Cambia la contraseña, activa verificación en dos pasos y **cierra todas las sesiones abiertas** de esa cuenta: cambiar la contraseña sin cerrar sesiones deja vivas las que ya estaban iniciadas. No afecta al sitio en absoluto: el sitio no usa esa cuenta en tiempo de ejecución, solo lleva identificadores de medición que son públicos. Puedes hacerlo sin ventana y sin avisar a nadie.

**A2 — Retirar al desarrollador saliente, usuario por usuario.** En Vercel, GitHub, Supabase, Mercado Pago, GoHighLevel, Google Ads (`697-248-9635`), Merchant Center, GA4, Clarity, Meta y n8n. Revisa también las **invitaciones pendientes**: la bitácora registra invitaciones enviadas a `guillermo.sanchezy@gmail.com` para Google Ads y Merchant el 31/08 y para GoHighLevel el 08/09, sin confirmación posterior de que se aceptaran (`BITACORA.md:54-62`). Una invitación sin aceptar que sigue viva es un acceso que se puede reclamar después; cancélalas.

### Grupo B — Secretos propios. Bajo impacto, requieren despliegue

| # | Qué se rota | Dónde | ¿Redespliegue? |
|---|---|---|---|
| B1 | `NUXT_PEDIDOS_PIN` | Vercel | **Sí** |
| B2 | `NUXT_RESENA_SECRET` | Vercel | **Sí** |

**B1 — El PIN de pedidos.** Genera uno nuevo, ponlo en Vercel, redespliega y pásale el nuevo a Nancy por un canal directo, no por el grupo. El propio código anticipa este movimiento: «si el PIN se filtra, se cambia la variable en Vercel y listo» (`server/api/pedidos.get.ts:9`). Mientras no redespliegues, el PIN viejo sigue sirviendo.

**B2 — La llave de firma de reseñas.** Cualquier cadena aleatoria larga sirve; la genera quien la rota.

> ⚠️ **Los enlaces de reseña ya enviados dejan de funcionar, y el cliente se entera tarde.** El formulario se sigue mostrando, porque la página solo comprueba que el enlace traiga `pedido` y `firma`, nunca que sean válidas (`pages/tienda/[slug].vue:49-54`). El fallo aparece **al enviar**: el servidor responde 403 y la ficha le pinta en rojo «Este enlace no es válido» (`server/api/resena.post.ts:34-36`, `pages/tienda/[slug].vue:85-87`). O sea que el cliente escribe su reseña completa y la pierde. Si molesta, la salida es que el correo del día 10 se regenere del lado de GHL con enlaces nuevos.

**Y el daño no es el que parece.** Mueren **todos** los enlaces acuñados antes de la rotación, sin importar su antigüedad: la firma es un HMAC sobre `${orderId}:${slug}` sin marca de tiempo (`server/utils/resenaToken.ts:39-43`) y la verificación no mira fechas (`server/utils/resenaToken.ts:52-58`), así que un enlace de hace meses sigue siendo válido hasta que se rota la llave, y con la rotación muere. Además, la URL se acuña **en el momento en que se confirma el pago**, dentro de `payloadCompra` (`server/utils/ghl.ts:192`), y se le entrega a GHL ahí mismo; GHL solo la guarda y la despacha al día 10. Por eso también quedan muertos los correos del día 10 que todavía no han salido, de compras previas a la rotación. El grupo afectado es **todo el que compró antes del corte**; a partir del corte, cada enlace nuevo sale firmado con la llave nueva.

### Grupo C — GoHighLevel. Lo más delicado del corte

Son **cuatro** URLs vivas las que hay que rotar: postcompra, carrito abandonado, aviso de pedido y pedido enviado. Todas son secretos que **generan cobro** y una de ellas es reconstruible desde el propio repositorio (sección 3). Pero esto no lo puedes hacer tú solo: **rotar una URL de GHL significa que César regenere el trigger**, y GHL entrega la URL nueva sin avisar de nada más (`BITACORA.md:641-643`).

**`NUXT_GHL_WEBHOOK_REACTIVACION` no entra en este procedimiento.** No se rota y no se verifica, porque el sitio nunca emite ese evento (`server/utils/ghl.ts:39,60`, sin llamador) y no hay ningún disparo real con el que comprobarla — si sigues la lista al pie de la letra te vas a atorar en el paso 4 sin entender por qué. Lo único que hay que hacer con ella: **si alguna vez se puso en Vercel, bórrala.** La reactivación a 60 días es un workflow propio de César, con su propio calendario, que no necesita nada del sitio (`AMANTI-Automatizaciones-2026-09-03.html:334`).

> ⚠️ **La trampa más traicionera de todo este proyecto: desde fuera de GHL no hay forma de distinguir una URL viva de una muerta.** Está comprobado pegándole a una cuenta inexistente con un identificador de puros ceros: responde `HTTP 200` con el mismo cuerpo, el mismo tamaño y las mismas cabeceras que un trigger real (`BITACORA.md:495-503`). Y como `emitirEventoGhl` solo mira si la respuesta fue exitosa (`server/utils/ghl.ts:100-104`), **el emisor reporta éxito siempre**. La ausencia de una advertencia `[ghl]` en los registros no prueba absolutamente nada.

Lo único que sí es señal es el cuerpo de la respuesta, y es una señal asimétrica —su presencia informa, su ausencia no (`BITACORA.md:493-513`):

| Respuesta del webhook | Qué significa |
|---|---|
| `Success: request sent to trigger execution server` más un `id` | Algo **sí** se ejecutó, y ese `id` se busca en el historial de ejecuciones |
| `Success: test request received` | **No dice nada.** Lo devuelve igual un trigger en muestra, una URL muerta y una cuenta que nunca existió. No confíes en la tabla vieja de `BITACORA.md:645-650`, que dice lo contrario y quedó desmentida |

**Procedimiento, una URL a la vez:**

1. César regenera **un** trigger y te pasa la URL nueva **como texto**.
2. La cargas en Vercel en la variable que corresponde según el mapa de `server/utils/ghl.ts:57-63`.
3. **Redespliegas.**
4. Verificas con un disparo real y confirmas del otro lado, en el historial de ejecuciones del workflow en GHL. Es el único lugar donde se ve la verdad, y no tenerlo a mano alargó el diagnóstico del 31/08: desde fuera no se podía distinguir si el workflow no corría o si corría y mandaba a otro número (`BITACORA.md:554-565`).
5. Recién entonces pasas a la siguiente.

**No dispares pruebas de más: cada una se cobra** (`server/utils/ghl.ts:12-17`). Y si hay tráfico real, un pedido real vale más que cualquier prueba sintética y sale gratis (`BITACORA.md:595-599`).

#### Dos notas sobre este grupo

**`NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` no existe hoy en Vercel producción.** Según la revisión del 15/09, las de aviso de pedido, carrito abandonado y postcompra sí están puestas; ésa no (`BITACORA.md:41-45`). Para esa, entonces, el trabajo no es rotarla sino crearla por primera vez. Mientras no exista, el sitio emite el evento y no tiene a dónde mandarlo, y `pages/envios.vue` le promete al cliente por escrito un número de rastreo que nadie manda.

**El aviso a Nancy tuvo una mina, ya arreglada, que conviene que conozcas porque este grupo toca las dos variables el mismo día.** Hasta el 31/08, la llamada a `avisarPedidoParaSurtir()` vivía dentro de un `if` que colgaba de `ghlConectado('compra_confirmada')`, o sea del webhook de **postcompra**, que es otra automatización con otro destinatario. Quitar `NUXT_GHL_WEBHOOK_POSTCOMPRA` apagaba el aviso de surtido **sin un solo error en los registros**, porque no era un fallo: la función simplemente no se llamaba (`BITACORA.md:606-624`). Hoy está corregido a `(ghlConectado('compra_confirmada') || ghlConectado('pedido_para_surtir'))` (`server/api/mp-webhook.post.ts:161`), y el `if` de afuera quedó solo para no pagar consultas a Supabase en balde (`server/api/mp-webhook.post.ts:158-160`). Es decir: **hoy las dos variables son independientes**. Si algún día alguien «simplifica» ese `if`, vuelve la mina.

### Grupo D — Pagos y base de datos. Aquí sí se puede tumbar la tienda

La regla general es **crear el secreto nuevo, cargarlo, desplegar, verificar, y solo entonces revocar el viejo.** Nunca al revés. Y hay una razón práctica detrás de ese orden que también es tu plan de reversa: **volver a cargar el valor viejo solo funciona mientras el proveedor no lo haya revocado.** En cuanto revocas, ya no hay marcha atrás; solo hacia adelante.

#### Cuándo hacerlo, quién aborta y cómo se revierte

**Cuándo.** El repositorio **no contiene ningún dato sobre a qué horas entran los pedidos** — la bitácora menciona compras sueltas, no un patrón. Pero el dato existe y lo puedes sacar tú antes del corte: la tabla `orders` guarda `created_at` (`server/api/pedidos.get.ts:31`), así que un `select` por hora del día sobre los últimos meses, corrido en el editor SQL de Supabase, te dice la ventana real en vez de suponerla. **Saca ese número antes de elegir hora**; «de madrugada» es una corazonada, no un criterio.

**Quién aborta.** Defínelo antes de empezar, con nombre. Es quien tenga el panel de Vercel abierto y pueda desplegar en el minuto. No puede ser alguien a quien haya que despertar.

**Cómo se revierte, paso por paso:**

| Momento | ¿Se puede revertir? | Cómo |
|---|---|---|
| Cargaste el valor nuevo, no has desplegado | Sí, gratis | Vuelves a poner el valor viejo. El sitio nunca dejó de usarlo |
| Desplegaste, aún no revocas el viejo | Sí | Vuelves a cargar el valor viejo y redespliegas. Son minutos |
| Ya revocaste el viejo | **No** | Solo hacia adelante: arreglar el valor nuevo. Por eso revocar va siempre al final |

**D1 — `NUXT_MP_WEBHOOK_SECRET`.** El orden natural (cambiarlo en Mercado Pago y luego en Vercel) abre una ventana en la que MP firma con el secreto nuevo y el sitio valida con el viejo: el webhook responde 401 y los pedidos no pasan a pagado (`server/api/mp-webhook.post.ts:71,78`). Hay una salida limpia que aprovecha cómo está escrito el código: la validación se omite si la variable está vacía (`server/api/mp-webhook.post.ts:66`). Entonces —vacías la variable en Vercel, redespliegas, cambias el secreto en el panel de MP, vuelves a cargar el valor nuevo en Vercel y redespliegas otra vez. Durante esa ventana pierdes la defensa en profundidad, pero no el cobro: el pago se reverifica de todos modos contra la API de Mercado Pago, que es la fuente de verdad (`server/api/mp-webhook.post.ts:82-97`). El código, además, asume que MP reintenta las notificaciones fallidas (`server/utils/ghl.ts:24-29`); eso es una suposición razonable pero **sin verificar desde el repo** contra la documentación de MP.

**D2 — `NUXT_MP_ACCESS_TOKEN`.** Genera la credencial nueva en el panel de Mercado Pago, cárgala en Vercel, redespliega, **haz una compra de prueba de punta a punta** y solo después revoca la vieja. Si revocas primero, el sitio no puede cobrarle a nadie hasta que el despliegue entre, y eso son minutos de tienda muerta en el mejor caso. **Sin verificar desde el repo:** si Mercado Pago permite tener dos credenciales vivas a la vez. Si no lo permite, no hay forma de evitar una ventana corta de indisponibilidad, y ahí sí necesitas la consulta de `created_at` de arriba para elegir la hora.

**D3 — `SUPABASE_SERVICE_ROLE_KEY`.** **La más peligrosa de la lista.** Rotarla en Supabase invalida la anterior de inmediato, y hasta que el despliegue nuevo entre, **todo pago con Mercado Pago responde HTTP 500** (`.env.example:38-40`), la pantalla de pedidos de Nancy deja de cargar y el marcado de envío deja de funcionar (`server/utils/supabaseAdmin.ts:13-19`). Ten el despliegue preparado para dispararlo en el mismo minuto, y verifica inmediatamente con una compra de prueba. Se rota porque estuvo en el `.env` local del desarrollador saliente.

> ⚠️ **Esta rotación tiene un efecto colateral fuera de Vercel, y es de los que se esconden en verde.** La llave también viaja por el shell de quien corre las pruebas de punta a punta, como `SB_SVC` (`playwright.config.ts:35-37`), junto con `SB_URL` y `SB_ANON`. Si no las actualizas, los specs que tocan pedidos, cupones y cuentas no se ponen rojos: se **saltan**, porque la comprobación es un `test.skip(...)` (`test/e2e/orders.spec.ts:14`, `test/e2e/coupons.spec.ts:17`, `test/e2e/account-auth.spec.ts:14`). La corrida del 10/09 dejó 62 verdes, 0 rojos y **16 saltados**, justamente por eso (`BITACORA.md:25-28`). O sea que la suite te dice «todo bien» mientras la llave nueva no se ejercitó nunca. Cuenta los saltados, no solo los rojos.

Sobre `SUPABASE_KEY` (la anon): no es un secreto —viaja al navegador de cualquier visitante por diseño (`.env.example:34`)— así que rotarla no cierra ninguna puerta. Si aun así la rotas, requiere despliegue igual. **Sin verificar desde el repo:** qué implica hoy rotarla en el panel de Supabase respecto de las sesiones ya iniciadas de los clientes.

**D4 — Stripe.** Está apagado, así que no urge. Si hay llaves cargadas en Vercel —cosa que **no se puede verificar desde el repo**— rótalas siguiendo `SETUP.md:48-58`, o bórralas si de plano no se va a usar Stripe. Ojo con una cosa: **`NUXT_STRIPE_WEBHOOK_SECRET` no se puede «vaciar sin consecuencia»** como se hace con la de Mercado Pago en D1. Sin ella, el endpoint responde 400 y no procesa nada (`server/api/stripe-webhook.post.ts:67`). Hoy eso da igual porque Stripe está apagado, pero si algún día se enciende, vaciarla apaga el cobro con tarjeta por completo. Y si la cuenta de Stripe está a nombre del desarrollador saliente, no se rota: se abre una nueva a nombre de AMANTI.

### Grupo E — n8n y cierre

**E1 — El webhook del chat EROS.** Regenera la URL en n8n, cárgala en `NUXT_N8N_CHAT_WEBHOOK` y redespliega. Y aprovecha para **vaciar el valor por defecto de `nuxt.config.ts:99`**, por lo explicado en el inventario: mientras tenga un valor escrito, el sitio puede caer en silencio a un servicio de un tercero.

> ⚠️ **Una URL de n8n muerta no produce ningún error visible.** `server/api/chat.post.ts:29-31` degrada con gracia: EROS contesta un mensaje fijo invitando a escribir por WhatsApp. Puedes tener el chat roto durante días y leerlo como que «el agente está siendo conservador». La única forma de verificar es hacerle una pregunta y confirmar que la respuesta **no** es ese texto de respaldo.

**E2 — Borrar el `.env` local.** Existe un archivo `.env` en la copia de trabajo del desarrollador saliente. Pídele que lo elimine junto con cualquier copia. Esto no es verificable desde aquí y, francamente, tampoco es lo que te protege: lo que te protege es que todos los valores que contenía ya estén rotados. Por eso va al final y no al principio.

### Lo que NO se rota, y por qué

Esta lista es tan importante como la de arriba, porque sin ella alguien va a intentar «rotar» cosas que no son secretos y perder un día en ello. Todo lo siguiente **está escrito en el código y viaja al navegador de cualquier visitante**. Rotarlos no cierra ninguna puerta; lo que se controla es quién puede entrar a la cuenta que hay detrás.

| Qué | Dónde está | Por qué no se rota |
|---|---|---|
| Medición de GA4, Google Ads, Clarity y Meta Pixel | `plugins/tracking.client.ts:14-17` | Son identificadores públicos: el navegador los ve para poder mandar los eventos |
| Etiqueta de conversión de compra de Ads | `composables/useAnalytics.ts:7` | Igual: la conversión se dispara desde el navegador. La creó Emilio del lado de Ads |
| `FORM_ID` del newsletter de GHL | `components/NewsletterForm.vue:26` | Es el id público del formulario embebido; va en el `src` del iframe (`components/NewsletterForm.vue:43`). Cambiarlo no cierra nada y sí rompe el formulario del pie y el del modal |
| Script `form_embed.js` de GHL | `components/NewsletterForm.vue:28` | Es un script público de `link.amanti.mx`, y sin él el botón de enviar del formulario queda cortado (`components/NewsletterForm.vue:12-16`) |
| El feed `/feeds/google.xml` | `server/routes/feeds/google.xml.get.ts` | Es público y sin autenticación por diseño: Google tiene que poder leerlo |
| `SUPABASE_KEY` (anon) | Vercel / `.env.example:34-36` | Viaja al navegador por diseño |
| `NUXT_PUBLIC_*` en general | `nuxt.config.ts:100-126` | El prefijo `PUBLIC` significa exactamente eso |

### Verificación final, cuando todo esté rotado

No des el corte por cerrado hasta que estas ocho cosas pasen:

1. `vercel env ls production` muestra las variables esperadas, con fecha de hoy en las que rotaste, y **sin** `MP_WEBHOOK_TEST_MODE`.
2. Una **compra de prueba de punta a punta** llega hasta pagado en Supabase.
3. `/api/pedidos` abre con el **PIN nuevo** y Nancy lo confirma desde su teléfono.
4. Marcar un pedido como enviado dispara el aviso, y aparece en el **historial de ejecuciones de GHL**.
5. La suite de punta a punta corre **con `SB_URL`/`SB_ANON`/`SB_SVC` nuevas puestas**, y el número de pruebas saltadas es cero.
6. `/feeds/google.xml` responde y Merchant Center no marca discrepancia de precio.
7. GA4 muestra tráfico en tiempo real.
8. EROS contesta algo que **no** es su mensaje de respaldo.

---

## 5. La base de datos que hay debajo de la llave

Rotar `SUPABASE_SERVICE_ROLE_KEY` cambia **quién** puede entrar, no **qué** puede hacer quien entre. Conviene tenerlo claro antes de que alguien suponga lo contrario.

**La service_role se salta RLS por diseño, y el proyecto depende de eso.** Está dicho en dos lugares del propio esquema: `supabase/abandoned-carts.sql:6-9` («la escritura la hace el server con service_role […] solo el service_role, que las omite») y `supabase/resenas-invitado.sql:11-13` («ese endpoint escribe con la llave de servicio, que se salta RLS. Abrirla aquí sería dejar la puerta que el endpoint justamente está cuidando»). O sea: los permisos de esa llave ya son totales sobre todas las tablas, y ninguna rotación los reduce. Lo que la protege es que solo vive en el servidor (`server/utils/supabaseAdmin.ts:3-5`).

**Las políticas que sí existen** aplican al camino del navegador, con la llave anon:

| Tabla | RLS | Políticas |
|---|---|---|
| `wishlist_items` | Activo | Select, insert y delete solo de las filas propias, por `auth.uid()` (`supabase/wishlist.sql:17-30`) |
| `reviews` | Activo | Lectura pública (`using (true)`); insert, update y delete solo de las propias (`supabase/reviews.sql:20-38`) |
| `abandoned_carts` | Activo, **sin ninguna política** | Nadie desde el navegador: solo el servidor con service_role (`supabase/abandoned-carts.sql:23-24`) |
| `leads` | Activo | Cualquiera puede insertar su correo; **nadie puede leerlos** por la API (`supabase/all.sql:15-19`) |

Hay un caso que ilustra bien el criterio: la reseña de invitado **no** abrió ninguna política a `anon`. Entra únicamente por `/api/resena`, que antes de escribir comprueba la firma del enlace, que el pedido esté pagado y que de verdad incluya ese producto (`server/api/resena.post.ts:6-13,34-36,48-56`). La alternativa —abrir RLS a `anon`— habría dejado justo la puerta que el endpoint está cuidando (`supabase/resenas-invitado.sql:9-13`).

**Qué SQL hay que haber corrido para que un proyecto nuevo funcione.** Los archivos de `supabase/` son el esquema, no documentación. Se corren en el editor SQL de Supabase y son idempotentes (`supabase/all.sql:3-4`). `supabase/all.sql` junta leads, wishlist, reviews, la columna `gift` de `orders` y los carritos abandonados; encima van los incrementales, entre ellos `supabase/orders-envio.sql` (columnas `shipped_at` y `tracking`) y `supabase/resenas-invitado.sql`, que fueron los dos que se corrieron el 27/08 (`BITACORA.md:870`).

> ⚠️ **Hueco real del repositorio, y de los que muerden el primer día.** En `supabase/` no existe ningún `create table` de `orders`, `order_items` ni `addresses`. Los únicos que se crean son `leads`, `wishlist_items`, `reviews` y `abandoned_carts`. De las tablas de pedidos solo hay `alter table ... add column` (`supabase/all.sql:60-61`, `supabase/orders-envio.sql:10-14`), que presuponen que las tablas ya existen. Es decir: **el esquema base de pedidos no está en el repositorio** y solo vive en el proyecto de Supabase en la nube. Si alguna vez hay que levantar un entorno nuevo desde cero, no se puede reconstruir con lo que hay aquí. Antes de que se pierda el acceso al proyecto actual, **saca un volcado del esquema y guárdalo en `supabase/`**.

---

## 6. Lo que no se pudo verificar leyendo el repositorio

Estos huecos son reales y hay que cerrarlos entrando a los paneles. Ninguno se puede resolver desde el código.

- Qué variables están efectivamente cargadas hoy en Vercel producción. Lo hay dos formas de saberlo: `vercel env ls production` desde la CLI (`BITACORA.md:602-604`) o el panel. El último registro escrito es del 15/09 (`BITACORA.md:41-45`).
- Quién tiene permiso para desplegar en Vercel, y si el botón «Redeploy» del panel recarga las variables o reutiliza la caché de construcción.
- Quién es propietario de la cuenta de Vercel, del repositorio de GitHub y del proyecto de Supabase.
- El esquema base de `orders`, `order_items` y `addresses`, que no está en el repo.
- Si las invitaciones de Google Ads, Merchant Center y GoHighLevel llegaron a aceptarse (`BITACORA.md:54-62`).
- Si la contraseña de `amanti.socialmedia@gmail.com` se cambió alguna vez (`BITACORA.md:63-65`).
- A qué horas entran los pedidos, para elegir la ventana del Grupo D. El dato existe en `orders.created_at` y hay que consultarlo en Supabase.
- Quién controla la cuenta de n8n Cloud que responde por EROS.
- Quién controla la cuenta de Microsoft Clarity y el administrador comercial de Meta.
- Dónde está registrado el dominio `amanti.mx` y quién administra su DNS, incluido el registro de `link.amanti.mx` que apunta a GoHighLevel.
- Si hay llaves de Stripe cargadas en Vercel y a nombre de quién está esa cuenta.
- Si Mercado Pago permite dos credenciales de acceso vivas simultáneamente, que es lo que decide si D2 tiene o no una ventana de indisponibilidad.
- Si Mercado Pago reintenta las notificaciones que fallan, que es la suposición sobre la que descansa D1.
- Qué le pasa a las sesiones de los clientes si se rota la llave anon de Supabase.
- A nombre de quién está la línea de WhatsApp que recibe los pedidos.
