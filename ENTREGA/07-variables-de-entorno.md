# Variables de entorno

Esta sección es el inventario completo de las variables de entorno que la tienda lee, de dónde sacas los valores el día uno, qué pasa si falta cada una, cómo comprobar que cada una quedó bien, y las trampas que en este proyecto ya costaron dinero o estuvieron a punto de costarlo.

Todo lo de aquí sale de leer el repo, salvo la sección 0, que se leyó del panel de Vercel el día del
corte. Donde el resto del documento dice «sin verificar desde el repo» respecto a qué hay cargado
en Vercel, la sección 0 ya lo resolvió.

En ningún punto de este documento aparece el valor de un secreto. Solo el nombre de la variable y dónde vive.

---

## 0. Lo que hay de verdad en Vercel producción (verificado el 18/09/2026)

Salida de `vercel env ls production` sobre el proyecto `izalith/amanti-store-cake`, cruzada contra
todo lo que el código lee. Son **nombres**, no valores.

**Cargadas (15):**

| Variable | Entornos | Cargada hace |
|---|---|---|
| `NUXT_MP_ACCESS_TOKEN` | Production, Preview | 55 días |
| `NUXT_MP_WEBHOOK_SECRET` | Production, Preview | 50 días |
| `SUPABASE_URL` | Production | 95 días |
| `SUPABASE_KEY` | Production | 95 días |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | 94 días |
| `NUXT_GHL_WEBHOOK_POSTCOMPRA` | Production | 23 días |
| `NUXT_GHL_WEBHOOK_CARRITO_ABANDONADO` | Production | 23 días |
| `NUXT_GHL_WEBHOOK_AVISO_PEDIDO` | Production | 22 días |
| `NUXT_ENVIO_COSTO` | Production | 22 días |
| `NUXT_PUBLIC_ENVIO_COSTO` | Production | 22 días |
| `NUXT_PEDIDOS_PIN` | Production | 22 días |
| `NUXT_RESENA_SECRET` | Production | 22 días |
| `NUXT_PUBLIC_WHATSAPP_PHONE` | Production | 101 días |
| `NUXT_PUBLIC_PUBLIC_BASE_URL` | Production | 112 días |
| `NUXT_PUBLIC_SITE_URL` | Production | 112 días |

**Ausentes, y qué significa cada ausencia:**

| Variable | ¿Es un problema? |
|---|---|
| `NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` | **Sí.** El sitio emite el evento (`server/api/pedido-enviado.post.ts:44`) y no tiene a dónde mandarlo. El cliente no se entera de que su pedido salió, y `/envios` se lo promete |
| `NUXT_GHL_WEBHOOK_REACTIVACION` | No. Ningún código emite ese evento: está declarado en `server/utils/ghl.ts:39,60` y nada lo llama |
| `NUXT_STRIPE_SECRET_KEY`, `NUXT_STRIPE_WEBHOOK_SECRET`, `NUXT_PUBLIC_STRIPE_ENABLED` | No. Stripe está apagado a propósito; sin `NUXT_PUBLIC_STRIPE_ENABLED` el botón no aparece |
| `NUXT_PROMO_VIGENCIA` | No, es deliberado: el feed sale sin fecha de fin de oferta para no desfasarse de la campaña (`02-catalogo.md`) |
| `NUXT_N8N_CHAT_WEBHOOK` | No. El código trae la URL por defecto (`nuxt.config.ts:99`) |
| `MP_WEBHOOK_TEST_MODE` | **Bien que falte.** Es el modo de prueba del webhook de pago y **nunca debe existir en producción**; además el código lo bloquea con `NODE_ENV !== 'production'` (`server/api/mp-webhook.post.ts:54-61`) |

Dos observaciones sobre las fechas. Las de GoHighLevel se cargaron entre el 26 y el 27 de agosto;
la de aviso de pedido se sobrescribió el 28 con la URL nueva, pero Vercel conserva la fecha de
creación original. Y las de Mercado Pago son las únicas que existen también en Preview: un
despliegue de preview puede cobrar de verdad.

---

## 1. Cómo funciona la convención de Nuxt (léelo antes que la tabla)

Nuxt tiene un bloque `runtimeConfig` en `nuxt.config.ts:88-127`. Ahí se declara cada opción con un valor por defecto, y en tiempo de ejecución Nuxt la sobreescribe con la variable de entorno correspondiente. La regla del nombre es mecánica:

| Dónde está declarada la llave | Variable de entorno que la pisa | ¿Llega al navegador? |
|---|---|---|
| `runtimeConfig.loQueSea` | `NUXT_LO_QUE_SEA` | **No.** Solo servidor. |
| `runtimeConfig.public.loQueSea` | `NUXT_PUBLIC_LO_QUE_SEA` | **Sí.** Va dentro del HTML que se le sirve a cualquiera. |

**Por qué esto importa y no es trivia:** todo lo que se declara bajo `public` se serializa dentro de la página y viaja al navegador de cada visitante. Quien abra «ver código fuente» lo lee.

Por eso el token de Mercado Pago y la llave secreta de Stripe están declarados **fuera** de `public` (`nuxt.config.ts:90-96`). La `service_role` de Supabase ni siquiera pasa por `runtimeConfig`: se lee con `process.env.SUPABASE_SERVICE_ROLE_KEY` en `server/utils/supabaseAdmin.ts:12`, que es otra forma de que nunca llegue al navegador. El propio código lo deja escrito: `.env.example:19` dice «SOLO server-side, NUNCA con prefijo publico» de la llave de Stripe, y `.env.example:38` lo repite de la `service_role`.

> **Advertencia.** Si alguien declara un secreto bajo `public` en `nuxt.config.ts` —y entonces sí lo puede pisar un `NUXT_PUBLIC_…`—, ese secreto queda publicado en el HTML del sitio. No hay error, no hay alerta: simplemente queda expuesto y hay que rotarlo.
>
> Lo que **no** pasa: cargar en Vercel un `NUXT_PUBLIC_MP_ACCESS_TOKEN` suelto no publica nada, porque no existe la llave `public.mpAccessToken` y Nuxt solo sobreescribe llaves declaradas. La variable simplemente se ignora. El riesgo real es únicamente mover o declarar la llave bajo `public` en el config.

### Una vuelta de tuerca: no todo pasa por `runtimeConfig`

Una variable **solo** entra a `useRuntimeConfig()` si su llave está declarada en `nuxt.config.ts`. Buena parte de las variables de este proyecto no lo están: se leen directo con `process.env` desde el servidor. Ejemplos verificables:

- Los cinco webhooks de GoHighLevel: `server/utils/ghl.ts:57-63` y `server/utils/ghl.ts:69`.
- El PIN de la pantalla de pedidos: `server/api/pedidos.get.ts:17` y `server/api/pedido-enviado.post.ts:11`.
- La llave de firma de reseñas: `server/utils/resenaToken.ts:27`.
- El costo de envío autoritativo: `server/utils/costoEnvio.ts:23`.
- La vigencia de la promoción del feed: `server/routes/feeds/google.xml.get.ts:55`.
- La `service_role` de Supabase: `server/utils/supabaseAdmin.ts:12`.

Funcionan igual —el servidor de Nitro sí ve `process.env`—, pero **nunca las vas a encontrar llamando a `useRuntimeConfig()`**. Si buscas una variable y no aparece en `nuxt.config.ts`, búscala con `process.env` en `server/`.

Hay además dos lugares que leen `NUXT_PUBLIC_SITE_URL` **como variable de entorno cruda**, no por `runtimeConfig`: `server/utils/ghl.ts:165` y `server/api/cart-save.post.ts:83`. Cada uno trae su propio respaldo escrito a mano (`'https://amanti.mx'`). O sea: el valor por defecto de `nuxt.config.ts:116` no los cubre.

### El caso aparte: `SUPABASE_URL` y `SUPABASE_KEY`

Estas dos no las lee el sitio: las lee el módulo `@nuxtjs/supabase`. El módulo las resuelve en sus `defaults` (`node_modules/@nuxtjs/supabase/dist/module.mjs:16-18`) y las deposita él mismo en `runtimeConfig.public.supabase.*` durante el `setup` (`module.mjs:43-53`). Por eso `server/utils/supabaseAdmin.ts:11` las encuentra ahí (`config.public.supabase.url`).

Dos consecuencias prácticas:

- **No les hace falta el prefijo `NUXT_PUBLIC_`** aunque acaben siendo públicas: el módulo es quien las lee, no `runtimeConfig`.
- El módulo documenta `SUPABASE_URL` / `SUPABASE_KEY` como *legacy fallback*. Sus nombres preferidos son `NUXT_PUBLIC_SUPABASE_URL` y `NUXT_PUBLIC_SUPABASE_KEY`, y **si alguien carga los dos pares, gana el `NUXT_PUBLIC_`** (`module.mjs:16-18`). Si un día la URL de Supabase «no cambia por más que la cambies», busca si existe también la variante `NUXT_PUBLIC_`.
- Esa resolución pasa **al construir**, no en cada petición. Son de las que más claramente exigen redespliegue (ver sección 5).

---

## 2. De dónde salen los valores el día uno

Este es el primer bloqueo real de quien recibe el proyecto, así que quede escrito.

**El archivo `.env` no viaja en el repo.** `.gitignore:5-7` ignora `.env` y `.env.*`, y hace una sola excepción: `.env.example`. Ese ejemplo no trae ningún valor real (`.env.example:7` es un número de WhatsApp explícitamente ficticio, `.env.example:11` y las demás están vacías). O sea: **clonar el repo no te da un solo valor bueno**.

De dónde sale cada cosa:

| Tipo de valor | De dónde se saca |
|---|---|
| Lo que está corriendo hoy en producción | Panel de Vercel → proyecto → Settings → Environment Variables. Es la única fuente de verdad de lo que está vivo. **No se puede ver desde el repo.** |
| Secretos de pago | Se regeneran en el proveedor (Mercado Pago, Stripe). No hace falta que nadie te pase el valor viejo: ver sección 9, el día del corte se rotan de todas formas. |
| Llaves de Supabase | Supabase → Project Settings → API. Igual: se leen del proyecto, no se heredan de nadie. |
| Las cinco URLs de GoHighLevel | Solo existen dentro de la cuenta de GHL, una por workflow (`server/utils/ghl.ts:57-63`). Hay que entrar a cada workflow y copiar su Inbound Webhook, o regenerarlo. |
| Webhook de n8n del chat EROS | `nuxt.config.ts:99` trae una URL escrita como valor por defecto en el repo, así que ese sí lo tienes. |
| `NUXT_PEDIDOS_PIN`, `NUXT_RESENA_SECRET` | Son valores que alguien eligió. Si nadie te los pasa, **no los recuperas**: se ponen nuevos y se avisa (el PIN a quien surte; la llave de reseñas tiene el efecto secundario de la sección 9). |
| `NUXT_ENVIO_COSTO`, `NUXT_PUBLIC_ENVIO_COSTO` | Decisión comercial, no técnica. Hay que preguntarle a quien lleva el negocio cuánto se cobra hoy de envío. `BITACORA.md:865-866` registra que el 27-ago-2026 se pusieron en `70`; **sin verificar desde el repo** si ese sigue siendo el valor vivo. |

**Lo que hay que hacer el día uno, en este orden:** abrir el panel de Vercel, exportar o listar las variables cargadas, y compararlas **variable por variable** contra la tabla de la sección 3. Lo que sobre, lo que falte y lo que no reconozcas es exactamente la lista de preguntas que hay que hacer antes de tocar nada.

---

## 3. Inventario completo

Columna «Dónde vive»: **Local** = tu archivo `.env`; **Vercel** = variables del proyecto en el panel; **Ambas** = hace falta en los dos lados.

### Pagos

| Variable | Para qué sirve | Pública / Privada | Dónde vive | Obligatoria | Qué se rompe si falta |
|---|---|---|---|---|---|
| `NUXT_MP_ACCESS_TOKEN` | Token de Mercado Pago. Crea la preferencia de pago y luego re-consulta el pago real en la API de MP. | **Privada** (`nuxt.config.ts:90`) | Ambas | Sí, si se cobra con MP | `/api/checkout` responde **400** con «Falta configurar el token de MercadoPago» (`server/api/checkout.post.ts:65-67`): el botón de pagar truena. Y el webhook responde 400 (`server/api/mp-webhook.post.ts:87`), así que ningún pedido pasa nunca a `paid`. |
| `NUXT_MP_WEBHOOK_SECRET` | Secreto con el que se valida la firma HMAC `x-signature` de las notificaciones de MP. | **Privada** (`nuxt.config.ts:92`) | Ambas | Recomendada en prod | Nada visible: sin secreto, el bloque de validación de firma **se salta entero** (`server/api/mp-webhook.post.ts:65-66`). El pago sigue verificándose contra la API de MP, pero pierdes la capa que impide que alguien golpee el webhook a mano. Falla en silencio, que es lo peligroso. |
| `NUXT_STRIPE_SECRET_KEY` | Llave secreta de Stripe (`sk_…`). Crea la Checkout Session. | **Privada** (`nuxt.config.ts:94`) | Ambas | Sí, si el botón de tarjeta está encendido | `/api/stripe-checkout` responde **400** «Falta configurar la llave de Stripe» (`server/api/stripe-checkout.post.ts:18-20`). Además, en un reembolso el webhook no puede resolver a qué pedido pertenece el cargo (`server/api/stripe-webhook.post.ts:85-89`). |
| `NUXT_STRIPE_WEBHOOK_SECRET` | Signing secret (`whsec_…`) con el que se verifica la firma de los eventos de Stripe. | **Privada** (`nuxt.config.ts:96`) | Ambas | **Sí, sin excepción** si Stripe está encendido | **Todos** los eventos de Stripe se rechazan con 400 (`server/api/stripe-webhook.post.ts:67`). El cliente paga con tarjeta, Stripe cobra, y el pedido se queda en `pending` para siempre. Nadie lo surte y nadie se entera. Ver la advertencia de abajo. |

> **Advertencia — esta es la que cobra de más sin avisar.** El webhook de Stripe es la autoridad sobre el estado final del pago (`server/api/stripe-checkout.post.ts:7`; el equivalente para Mercado Pago está en `server/api/pedido-enviado.post.ts:4-5`). Encender `NUXT_PUBLIC_STRIPE_ENABLED` sin tener cargado `NUXT_STRIPE_WEBHOOK_SECRET` produce exactamente esto: se cobra y no se registra. Si enciendes Stripe, verifica primero que el endpoint conteste, no al revés.

### Base de datos (Supabase)

| Variable | Para qué sirve | Pública / Privada | Dónde vive | Obligatoria | Qué se rompe si falta |
|---|---|---|---|---|---|
| `SUPABASE_URL` | URL del proyecto de Supabase. La lee el módulo `@nuxtjs/supabase` (así está documentado en `nuxt.config.ts:12`) y también sirve de respaldo en `server/utils/supabaseAdmin.ts:11`. | No es secreto (el propio código lo dice en `server/utils/supabaseAdmin.ts:4`) | Ambas | **Sí** | Cuentas y pedidos dejan de funcionar. En los endpoints de servidor, `supabaseAdmin()` lanza **500** «Supabase admin no configurado» (`server/utils/supabaseAdmin.ts:13-19`). |
| `SUPABASE_KEY` | Llave **anon / pública** de Supabase. La consume el módulo (`nuxt.config.ts:12`). | Pública por diseño (la anon key está hecha para el navegador) | Ambas | **Sí** | Registro e inicio de sesión en `/cuenta` dejan de funcionar. No lleva prefijo `NUXT_PUBLIC_` y aun así acaba del lado del cliente: ver «El caso aparte» en la sección 1. |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave `service_role`. Salta RLS: es la que crea pedidos, los marca pagados y lee la pantalla de surtido. | **Privada, la más sensible del proyecto** (`server/utils/supabaseAdmin.ts:5`) | Ambas | **Sí en producción** | Todo el camino de pedidos revienta con **500**. La lista exacta —y lo que en cambio degrada en silencio— está en la sección 6. `.env.example:39-40` lo resume corto: «Sin ella TODO pago con MercadoPago devuelve HTTP 500». |

### Marketing — GoHighLevel

Las cinco salen de `server/utils/ghl.ts:57-63`. **Cada una es una URL de webhook distinta**: GoHighLevel no da un buzón global, genera una dirección por workflow, así que el evento no viaja como campo —el evento *es* la URL a la que se manda (`server/utils/ghl.ts:7-9`).

| Variable | Para qué sirve | Pública / Privada | Dónde vive | Obligatoria | Qué se rompe si falta |
|---|---|---|---|---|---|
| `NUXT_GHL_WEBHOOK_POSTCOMPRA` | Aviso de compra confirmada → correo de confirmación, reseña del día 10, cross-selling del 21. | **Privada** | Vercel (y local si vas a probar) | No | Ese evento queda apagado en silencio: la función devuelve `false` y no hace nada (`server/utils/ghl.ts:90-91`). El cliente paga y no recibe correo de confirmación. Nada aparece roto en el sitio. |
| `NUXT_GHL_WEBHOOK_CARRITO_ABANDONADO` | Aviso de carrito abandonado → secuencia de 1 h / 24 h / 48 h. | **Privada** | Vercel | No | No sale ninguna secuencia de recuperación de carrito. Sin error visible. |
| `NUXT_GHL_WEBHOOK_REACTIVACION` | Workflow de reactivación / recompra. | **Privada** | Vercel | No | El evento no se emite. Sin error visible. |
| `NUXT_GHL_WEBHOOK_AVISO_PEDIDO` | Avisa por WhatsApp a **quien surte** que entró un pedido que hay que preparar (`server/utils/ghl.ts:40-42`). | **Privada** | Vercel | No, pero es operativamente crítica | Entra un pedido pagado y **nadie del equipo se entera**. El pedido existe en la base, pero quien empaca no recibe nada. |
| `NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` | Avisa al **cliente** que su pedido ya salió, con número de guía (`server/utils/ghl.ts:43-48`). | **Privada** | Vercel | No | El sitio emite el evento y no tiene a dónde mandarlo. El cliente nunca recibe el «ya va en camino», aunque `pages/envios.vue` se lo promete por escrito. `BITACORA.md:41-45` registra que al 15/09/2026 esta variable **no existía en Vercel**, mientras que `_AVISO_PEDIDO`, `_CARRITO_ABANDONADO` y `_POSTCOMPRA` sí — *sin verificar desde el repo si eso sigue igual*. |

> **Advertencia de costo.** Estos triggers son **premium y GoHighLevel los cobra por uso** (`server/utils/ghl.ts:12-17`, `.env.example:46-49`). Dos consecuencias prácticas: (1) **no pongas estas URLs en un entorno de pruebas** que dispare tráfico real, porque cada disparo se paga; (2) **estas URLs son un secreto de facto** — quien las tenga puede disparar el workflow y generar cobro sin ninguna credencial (`server/utils/ghl.ts:53-55`). Por eso no se commitean y por eso van en la lista de rotación.
>
> Del mismo diseño sale el candado de `server/api/cart-save.post.ts:77` y `server/utils/ghl.ts:138-146`: el endpoint de guardar carrito se llama 8-10 veces por comprador, así que solo se avisa **una vez por episodio** de carrito. Si alguien «simplifica» eso, la factura de GHL se multiplica por ocho.

### Operación

| Variable | Para qué sirve | Pública / Privada | Dónde vive | Obligatoria | Qué se rompe si falta |
|---|---|---|---|---|---|
| `NUXT_PEDIDOS_PIN` | PIN compartido que protege la pantalla de pedidos por surtir. | **Privada** (`server/api/pedidos.get.ts:17`, `server/api/pedido-enviado.post.ts:11`) | Ambas | Sí, para que la pantalla exista | Sin PIN, los dos endpoints responden **404 «No disponible»**, no 401. Es a propósito: apagados, no abiertos, porque exponen nombre, teléfono y domicilio de clientes y un descuido de configuración no puede terminar publicando domicilios (`server/api/pedidos.get.ts:6-12`). Quien surte se queda sin su pantalla. |
| `NUXT_RESENA_SECRET` | Llave HMAC con la que se firman los enlaces de «deja tu reseña» que van en el correo del día 10. | **Privada** (`server/utils/resenaToken.ts:27`) | Ambas | No | Los enlaces salen **sin firma** y `/api/resena` responde 404 (`server/api/resena.post.ts:20`): quien compró sin cuenta llega a un «Inicia sesión» y se va (`server/utils/resenaToken.ts:21-22, 67-71`). El sitio se comporta como antes del **27-ago-2026** (`server/utils/resenaToken.ts:4-8`). |
| `NUXT_ENVIO_COSTO` | **El costo de envío que realmente se cobra.** Valor autoritativo del servidor. | **Privada** (`server/utils/costoEnvio.ts:23`) | Ambas | No (vacío = gratis) | Vacía o en `0` ⇒ envío **gratis para todos**. Ese fue el comportamiento del sitio hasta el 27-ago-2026, cuando cada pedido bajo el umbral le costaba el envío a Amanti (`server/utils/costoEnvio.ts:4-8`). Vive en variable y no en código para que quien lleva el negocio la mueva sin tocar el repo ni depender de un programador. **Ojo: en Vercel sigue haciendo falta redesplegar para que el valor nuevo entre** (ver sección 5). |
| `NUXT_PROMO_VIGENCIA` | Fechas de vigencia de la promoción para Google Shopping, en ISO 8601 con offset y separadas por diagonal. | **Privada** (`server/routes/feeds/google.xml.get.ts:55`) | Vercel | No | El feed sale sin la etiqueta de vigencia: el descuento se ve igual, pero sin fecha de corte (`server/routes/feeds/google.xml.get.ts:44-53`). Mismo caso que arriba: el comentario dice «se cambia la variable en Vercel sin desplegar», pero **sí hay que redesplegar**. |
| `NUXT_N8N_CHAT_WEBHOOK` | Webhook del agente de chat EROS en n8n. `/api/chat` hace de proxy para evitar CORS y **para que el cliente nunca vea la URL** (`nuxt.config.ts:97-99`, `server/api/chat.post.ts:1-2`). | **Privada** (`nuxt.config.ts:99`) | Opcional en ambas | No | **Tiene una URL escrita como valor por defecto en `nuxt.config.ts:99`**, así que sin la variable el chat sigue apuntando ahí. Si ese destino deja de existir, `/api/chat` no falla: devuelve el mensaje de respaldo «Justo ahora no puedo responder. Escríbenos por WhatsApp…» (`server/api/chat.post.ts:15, 29-32`). Síntoma observable: **el chat contesta siempre lo mismo**. |

### Públicas (viajan al navegador)

| Variable | Para qué sirve | Pública / Privada | Dónde vive | Obligatoria | Qué se rompe si falta |
|---|---|---|---|---|---|
| `NUXT_PUBLIC_WHATSAPP_PHONE` | El número de WhatsApp de AMANTI. Formato `52` + `1` + 10 dígitos, sin `+` ni espacios. | **Pública** (`nuxt.config.ts:102-114`) | Ambas | **Sí** | No se rompe nada visible: **cae al respaldo escrito en `nuxt.config.ts:114`**. Ver la sección 4, es el caso más importante de todo este documento. |
| `NUXT_PUBLIC_SITE_URL` | URL canónica del sitio. Alimenta `canonical`, Open Graph, Twitter Card, el feed de Google, el catálogo de EROS y los enlaces que se le mandan a GHL. | **Pública** (`nuxt.config.ts:116`) | Ambas | Sí en prod | Cae al respaldo `https://amanti.mx`. Si el dominio cambia y nadie actualiza esto, las etiquetas `canonical` y `og:image` de todo el sitio apuntan al dominio viejo (`app.vue:6-13`), y los enlaces dentro de los correos de GHL también (`server/utils/ghl.ts:165`). |
| `NUXT_PUBLIC_PUBLIC_BASE_URL` | Base de las URLs de retorno y de notificación que se le entregan a la pasarela de pago. **Sí, lleva `PUBLIC` dos veces**: el prefijo es `NUXT_PUBLIC_` y la llave se llama `publicBaseUrl` (`nuxt.config.ts:117-118`). | **Pública** | Ambas | Sí en prod | Ver la advertencia de abajo. Hay una red de seguridad, pero solo funciona en Vercel. |
| `NUXT_PUBLIC_STRIPE_ENABLED` | Muestra el botón «Pagar con tarjeta» en el carrito; vacío lo oculta. | **Pública** (`nuxt.config.ts:119-120`) | Ambas | No | El botón de tarjeta no aparece (`pages/carrito.vue:19-20`). Mercado Pago y WhatsApp siguen funcionando. Ver el formato exacto en la sección 3.1: **no basta con que diga «1», basta con que no esté vacía.** |
| `NUXT_PUBLIC_ENVIO_COSTO` | El costo de envío que **se pinta** en el resumen del carrito y en el mensaje de WhatsApp. | **Pública** (`nuxt.config.ts:121-125`) | Ambas | No | Ver la advertencia de abajo: esta y `NUXT_ENVIO_COSTO` tienen que valer lo mismo. |
| `NUXT_PUBLIC_BRAND_NAME` | Pisa `runtimeConfig.public.brandName` (`nuxt.config.ts:101`, valor por defecto `AMANTI`). | **Pública** | — | No | **Nada: hoy ningún archivo del sitio lee `brandName` fuera del propio config.** La menciono solo porque es una llave declarada —y por tanto pisable por entorno— y este documento se presenta como inventario completo. No la busques en Vercel y no la cargues. |

> **Advertencia — `NUXT_PUBLIC_PUBLIC_BASE_URL` en producción.** Su respaldo es `http://localhost:3000` (`nuxt.config.ts:118`), que está bien para desarrollo. Si la variable faltara en producción, ese respaldo tomaría el control y el sitio le diría a Mercado Pago que mande las notificaciones de pago a `localhost`: **el cobro sí se hace, pero el webhook no llega nunca**. Los pedidos se quedan en `pending` para siempre, nadie los marca como pagados, GHL no se entera, quien surte no sabe que hay algo que enviar, y el cliente que ya pagó aterriza en una página muerta — todo sin un solo error en ningún lado. Por eso existe `server/utils/baseUrl.ts`: corriendo en Vercel, un `localhost` se trata como configuración rota y se sustituye por el dominio público (`server/utils/baseUrl.ts:26-34`). **Esa red solo existe cuando `process.env.VERCEL` está presente** (`server/utils/baseUrl.ts:33`); si algún día esto se despliega en otro lado, la red desaparece y la variable vuelve a ser obligatoria de verdad.

> **Advertencia — las dos variables del envío tienen que valer lo mismo.** `NUXT_ENVIO_COSTO` (servidor) es la autoritativa: es la que se cobra (`server/utils/costoEnvio.ts:23`, usada en `server/utils/orders.ts:116`). `NUXT_PUBLIC_ENVIO_COSTO` solo pinta la cifra que ve el cliente (`nuxt.config.ts:121-125`, `pages/carrito.vue:86-93`). Si quedan desalineadas, el carrito muestra un total y en la pasarela se cobra otro. El mismo valor público alimenta el mensaje de WhatsApp del pedido (`stores/cart.ts:140`), y el comentario de ese archivo lo dice sin rodeos: si el mensaje dijera un total y en la pantalla de quien surte apareciera otro, «alguien acaba cobrando de menos». **Cuando muevas una, mueve la otra en el mismo momento.** (Ese mismo comentario, en `stores/cart.ts:139`, dice que «el monto sale de la misma variable que usa el servidor»; no es exacto: son dos variables distintas que **tienen** que coincidir, y de ahí el riesgo.)

> **Advertencia — el umbral de envío gratis NO es una variable.** Los $1,000 a partir de los cuales el envío sale gratis están **escritos en el código, en dos lugares**: `server/utils/costoEnvio.ts:19` (`UMBRAL_ENVIO_GRATIS`, el autoritativo, usado en `costoEnvio.ts:44`) y `stores/cart.ts:9` (`FREE_SHIPPING_THRESHOLD`, el que pinta el carrito, usado en `stores/cart.ts:65` y `:69`). El propio comentario de `costoEnvio.ts:18` reconoce la duplicación: «Igual que en `stores/cart.ts`». **No busques una variable del umbral en Vercel: no existe.** Para moverlo hay que tocar los dos archivos, dejarlos con el mismo número y desplegar. Si mueves solo uno, el carrito le promete envío gratis a alguien a quien el servidor le va a cobrar, o al revés.

### Plataforma y pruebas (no se cargan a mano en producción)

| Variable | Para qué sirve | Dónde vive | Notas |
|---|---|---|---|
| `VERCEL` | La pone Vercel sola. Decide el proveedor de imágenes (`nuxt.config.ts:18`) y activa la red de seguridad de la URL base (`server/utils/baseUrl.ts:33`). | La inyecta Vercel | No la cargues tú. En local no existe y no debe existir. |
| `NODE_ENV` | El runtime la pone. En el webhook de MP bloquea el modo de prueba (`server/api/mp-webhook.post.ts:57`). | Automática | — |
| `MP_WEBHOOK_TEST_MODE` | Permite simular pagos contra el webhook de MP sin tocar Mercado Pago. Exige además un secreto compartido en el cuerpo (`server/api/mp-webhook.post.ts:54-61`). | Solo pruebas (`playwright.config.ts:45`) | **Nunca la cargues en Vercel.** El código la desactiva cuando `NODE_ENV === 'production'`, pero ese es el cinturón, no el motivo para saltarse el tirante. |
| `E2E_PORT` | Puerto del servidor que levanta Playwright; por defecto `3457`. Es configurable porque el `3010` cae en el rango que Windows reserva y ningún e2e podía correr (`playwright.config.ts:3-6`). | Solo pruebas | — |
| `SB_URL`, `SB_ANON`, `SB_SVC` | Credenciales de Supabase que los e2e reciben desde el shell, nunca hardcodeadas (`playwright.config.ts:35-37`, `test/e2e/orders.spec.ts:4-17`). | Solo pruebas, en tu shell | Sin ellas, esos specs se **saltan** en vez de fallar. Una corrida «verde» con tests saltados no prueba lo que parece. |

> **La suite de e2e pisa variables reales.** El bloque `webServer.env` de `playwright.config.ts:32-45` **fuerza** valores para la corrida: `NUXT_PUBLIC_WHATSAPP_PHONE='5214431112233'` (un número de prueba, **no el de AMANTI**), `NUXT_MP_ACCESS_TOKEN='TEST-MP-INVALID'` (un token dummy que deja pasar el check y hace que la llamada a MP falle con 401 a propósito), `NODE_ENV='test'` y `MP_WEBHOOK_TEST_MODE='1'`. Por eso `test/e2e/flujo.spec.ts:44` afirma que el enlace de WhatsApp contiene `wa.me/5214431112233` y eso **no** es un error: es el número que Playwright inyectó. Si algún día cambias el teléfono real, no toques ese assert; si cambias el de `playwright.config.ts:34`, sí.

### 3.1. Formato y rango esperado de cada valor

Esto no está documentado en ningún otro lado del repo y es lo que más hace perder tiempo el primer día.

| Variable | Formato | Detalle que importa |
|---|---|---|
| `NUXT_PUBLIC_WHATSAPP_PHONE` | `52` + `1` + 10 dígitos, sin `+`, sin espacios, sin guiones | Se interpola tal cual en `https://wa.me/${phone}` (`stores/cart.ts:160`). Un `+` o un espacio rompe el enlace sin dar error. |
| `NUXT_ENVIO_COSTO` | **Entero en pesos**, p. ej. `70` | Se pasa por `Number()` y se redondea dos veces: `Math.round` en `server/utils/costoEnvio.ts:24` y otra vez en `:39`. Un `70.50` se cobra como `71`. El comentario de `costoEnvio.ts:36-38` explica por qué: un cargo de «$99.60» se ve a error y además Mercado Pago suma centavos por su cuenta y el total dejaría de cuadrar. Vacío, `0` o cualquier cosa no numérica ⇒ **gratis**. |
| `NUXT_PUBLIC_ENVIO_COSTO` | Mismo entero, mismo valor que la de arriba | En el cliente se lee con `Number(...) \|\| 0` (`pages/carrito.vue:90`, `stores/cart.ts:140`): no redondea, solo cae a 0 si no es número. |
| `NUXT_PUBLIC_STRIPE_ENABLED` | La convención escrita es el string `"1"` (`nuxt.config.ts:119`, `.env.example:26-27`) | **Pero el código evalúa verdad, no igualdad:** `!!useRuntimeConfig().public.stripeEnabled` (`pages/carrito.vue:20`). Cualquier cadena no vacía enciende el botón, incluidos `"0"` y `"false"`. Para apagarlo hay que **borrar la variable o dejarla vacía**, no ponerle `0`. |
| `NUXT_PROMO_VIGENCIA` | ISO 8601 con offset, dos fechas separadas por `/` | El ejemplo literal está en `server/routes/feeds/google.xml.get.ts:53`: `2026-08-01T00:00-06:00/2026-08-31T23:59-06:00`. Es el único formato que acepta Google (`google.xml.get.ts:45-46`). Se hace `.trim()` (`:55`). |
| `NUXT_PEDIDOS_PIN` | Cadena libre, se le hace `.trim()` (`server/api/pedidos.get.ts:17`) | **No hay longitud mínima, no hay rate limit y la comparación es en claro** (`pedidos.get.ts:21-23`, `pedido-enviado.post.ts:15`). Elige algo largo. El propio código admite que «no es autenticación de verdad» y que cuando haya más gente surtiendo esto debe pasar a cuentas con rol (`pedidos.get.ts:8-10`). |
| `NUXT_RESENA_SECRET` | Cadena aleatoria larga, se le hace `.trim()` (`server/utils/resenaToken.ts:27`) | Es la llave de un HMAC-SHA256 (`resenaToken.ts:42`). Cualquier longitud «funciona», pero una corta se adivina. Vacía = función apagada (`resenaToken.ts:31-33`). |
| `NUXT_MP_ACCESS_TOKEN` | El token tal cual del panel de MP | Se manda como `Bearer` (`server/api/mp-webhook.post.ts:90`). |
| `NUXT_STRIPE_SECRET_KEY` | `sk_test_…` en pruebas, `sk_live_…` en real (`nuxt.config.ts:93`) | — |
| `NUXT_STRIPE_WEBHOOK_SECRET` | `whsec_…` (`nuxt.config.ts:95`) | — |
| `NUXT_PUBLIC_SITE_URL` / `NUXT_PUBLIC_PUBLIC_BASE_URL` | URL absoluta con esquema | La barra final da igual: todos los consumidores la recortan (`server/utils/baseUrl.ts:24`, `server/utils/ghl.ts:165`, `server/api/cart-save.post.ts:83`). |

---

## 4. Valores de respaldo en el código: el riesgo que esconden

Varias variables tienen un valor por defecto escrito en el repo. Eso hace que el sitio arranque siempre, y ese es justo el problema: **cuando una variable falta, no truena nada. Se usa el respaldo, en silencio.**

El caso documentado, y el que hay que entender antes de tocar nada, es el teléfono de WhatsApp. Está contado por extenso en `nuxt.config.ts:102-114`:

- Hasta el 31-ago-2026 el respaldo de `nuxt.config.ts` traía un número viejo. Cuando el número de AMANTI cambió, **solo se actualizó la variable en Vercel** y esa línea se quedó atrás.
- Nadie lo notó nunca, porque en producción la variable siempre le gana al respaldo.
- Lo que estaba en juego: si esa variable llegara a faltar —alguien la borra, un entorno nuevo, un deploy de *preview* sin ella— **todos los lugares que arman enlaces de WhatsApp caerían al respaldo**, incluido `stores/cart.ts`, que es por donde se piden pedidos. Serían pedidos yéndose a un número ajeno, sin un solo error en ningún lado.

Ese respaldo aparece hoy en **nueve construcciones de enlace repartidas en ocho archivos**: `components/ChatWidget.vue:96`, `components/WhatsAppButton.vue:4`, `components/BottomNav.vue:5`, `stores/cart.ts:131,160` (lee el número en 131, arma el `wa.me` en 160), `pages/tienda/[slug].vue:242`, `pages/terminos.vue:4`, `pages/garantias.vue:4` y `pages/contacto.vue` (líneas 4 y 23).

**La regla que se desprende, y que hay que respetar:** el valor de respaldo de `nuxt.config.ts:114` **tiene que ser el número bueno en todo momento**. No es decoración ni un placeholder: es lo que va a usar el sitio el día que la variable no esté. Cuando el número de AMANTI cambie, se cambian **los dos**: la variable en Vercel y esa línea del repo, en el mismo movimiento.

Los otros respaldos con la misma forma de fallar:

| Dónde | Respaldo | Qué pasa si la variable falta |
|---|---|---|
| `nuxt.config.ts:118` | `http://localhost:3000` | Notificaciones de pago a localhost (ver advertencia arriba). Mitigado solo en Vercel. |
| `nuxt.config.ts:116` | `https://amanti.mx` | Canonical, OG y enlaces de correo al dominio equivocado si el dominio cambia. |
| `nuxt.config.ts:99` | Una URL de n8n ya escrita en el repo | El chat apunta a ese destino aunque nadie configure nada. |
| `server/utils/ghl.ts:165` | `https://amanti.mx` | Respaldo **propio**, independiente del de `nuxt.config.ts`: lee `process.env.NUXT_PUBLIC_SITE_URL` crudo. Alimenta las URLs de producto y de reseña que van en los correos de GHL. |
| `server/api/cart-save.post.ts:83` | `https://amanti.mx` | Igual que el anterior, `process.env` crudo. Es el `url_carrito` del evento de carrito abandonado. |
| `server/api/catalog.get.ts:14` | `https://amanti.mx` | Lee `runtimeConfig` y **aun así trae su propio literal**. Es la base de las URLs que el agente EROS le recomienda al cliente. |
| `server/routes/feeds/google.xml.get.ts:107` | `https://amanti.mx` | Base del feed de Google Shopping. Con una salvedad: `google.xml.get.ts:108-111` intenta primero el `origin` de la petición y solo cae al literal si eso falla, así que en la práctica este es el menos expuesto de los cuatro. |

> **El día que cambie el dominio hay que tocar los cuatro últimos**, no solo la variable. Los dos primeros (`ghl.ts`, `cart-save`) leen `process.env` crudo y los dos últimos (`catalog`, `feed`) leen `runtimeConfig` pero con su propio literal de respaldo. Ninguno de los cuatro está cubierto por el valor por defecto de `nuxt.config.ts:116`.

> **Criterio general para este repo:** un respaldo que hace que el sitio siga funcionando *mal* sin avisar es peor que un error. Antes de agregar uno nuevo, pregúntate qué se ve desde afuera el día que se active. Si la respuesta es «nada», no lo pongas.

---

## 5. La trampa de Vercel: una variable nueva no entra hasta el siguiente despliegue

**Cargar una variable en el panel de Vercel no la activa.** Las variables se inyectan en el momento del build/despliegue, así que hasta que no haya un despliegue nuevo, producción sigue corriendo con el conjunto de variables que tenía cuando se construyó.

Esto ya se pagó en este proyecto. `BITACORA.md:865-868` lo deja registrado: el día que se pusieron `NUXT_ENVIO_COSTO`, `NUXT_PUBLIC_ENVIO_COSTO`, `NUXT_PEDIDOS_PIN`, `NUXT_RESENA_SECRET` y `NUXT_GHL_WEBHOOK_AVISO_PEDIDO`, **hubo que hacer un commit vacío** para forzar el despliegue.

Dos matices que conviene tener claros, porque cambian dónde buscar cuando algo «no agarra»:

- **Las que se resuelven al construir.** `SUPABASE_URL` y `SUPABASE_KEY` las lee el módulo en sus `defaults` (`node_modules/@nuxtjs/supabase/dist/module.mjs:16-18`) y las congela en `runtimeConfig.public.supabase.*` durante el `setup` (`module.mjs:43-53`). `NUXT_PROMO_VIGENCIA` se lee a nivel de módulo, fuera del handler (`server/routes/feeds/google.xml.get.ts:55`), así que también queda fija al arrancar el servidor. Estas exigen redespliegue sí o sí.
- **Las que se leen por petición.** El PIN (`pedidos.get.ts:17`), el costo de envío (`costoEnvio.ts:23`) y las URLs de GHL (`ghl.ts:69`) sí se consultan en cada llamada. Aun así hace falta redesplegar, porque el valor que ese proceso ve es el que Vercel inyectó en el despliegue.

Cómo se ve el síntoma si no lo sabes: cargas la variable, recargas el sitio, y se comporta exactamente igual que antes. Vas a creer que el código está mal. No lo está.

**Procedimiento, siempre:** cargar la variable → redesplegar (o commit vacío) → **verificar el comportamiento en vivo** con la prueba de la sección 8, no el panel. El panel solo te dice que la escribiste.

### Entornos de Vercel: Production, Preview y Development

Vercel permite marcar cada variable para uno, dos o los tres entornos. **Qué está marcado hoy no se puede ver desde el repo — sin verificar.** Lo que sí se puede afirmar es qué necesita cada entorno para no hacer daño:

| Entorno | Qué hay que marcar | Por qué |
|---|---|---|
| **Production** | Todas las de la sección 3 que dicen «Vercel» o «Ambas». | Es el sitio real. |
| **Preview** | Como mínimo `NUXT_PUBLIC_WHATSAPP_PHONE`, `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NUXT_PUBLIC_SITE_URL` y `NUXT_PUBLIC_PUBLIC_BASE_URL`. **Nunca los cinco `NUXT_GHL_WEBHOOK_*`.** | Un Preview **sin** `NUXT_PUBLIC_WHATSAPP_PHONE` cae al respaldo del repo (`nuxt.config.ts:114`), que es exactamente el escenario de la advertencia de la sección 4: enlaces de pedido a un número que puede no ser el bueno. Y un Preview **con** las URLs de GHL dispara workflows premium de verdad, contra clientes de verdad, y se paga (`server/utils/ghl.ts:12-17`). |
| **Development** | Nada. | El `.env` local manda. Marcar aquí solo confunde. |
| **Cualquiera** | `MP_WEBHOOK_TEST_MODE` **jamás**. | Es el bypass del webhook de pagos (`server/api/mp-webhook.post.ts:54-61`). El código lo apaga en producción por `NODE_ENV`, pero en un Preview `NODE_ENV` no es `production` y el bypass **sí** quedaría activo para quien conozca el secreto. |

---

## 6. Lo que truena vs. lo que degrada en silencio

Cuando falta `SUPABASE_SERVICE_ROLE_KEY` (o `SUPABASE_URL`), `supabaseAdmin()` lanza un 500 (`server/utils/supabaseAdmin.ts:13-19`). Pero **no todos los endpoints dejan que ese error salga**, y esa diferencia es la mitad del trabajo de depurar.

**Revientan con 500** (llaman a `supabaseAdmin()` sin `try`/`catch`):

| Endpoint | Dónde | Qué ve el usuario |
|---|---|---|
| `/api/checkout` (Mercado Pago) | vía `server/utils/orders.ts:22,90` | El botón de pagar truena. |
| `/api/stripe-checkout` | `server/api/stripe-checkout.post.ts:12` + `orders.ts:90` | El botón de tarjeta truena. |
| `/api/order-whatsapp` | vía `server/utils/orders.ts:22,90` | **El cliente no ve nada raro**: el propio endpoint dice que «el cliente degrada con gracia: si esto falla, igual abre WhatsApp» (`server/api/order-whatsapp.post.ts:5`). El chat se abre y el pedido **no queda registrado en la base**. Como el pedido por WhatsApp es el canal principal de la tienda, este es el que más caro sale y el más difícil de notar. |
| `/api/mp-webhook` y `/api/stripe-webhook` | `mp-webhook.post.ts`, `stripe-webhook.post.ts:17` | Ningún pedido pasa nunca a `paid`. |
| `/api/pedidos` y `/api/pedido-enviado` | `pedidos.get.ts:25`, `pedido-enviado.post.ts:18` | La pantalla de surtido no carga. |
| `/api/resena` | `server/api/resena.post.ts:45` | Error al mandar la reseña. Solo si `NUXT_RESENA_SECRET` está puesta: sin ella el endpoint devuelve 404 antes de llegar ahí (`resena.post.ts:20`). |

**Degradan en silencio** (atrapan el error y devuelven una respuesta normal):

| Endpoint | Dónde atrapa | Qué pasa realmente |
|---|---|---|
| `/api/cart-save` | `server/api/cart-save.post.ts:47-73`, el `catch` en `:68-73` | **No truena.** Pone `registroDisponible = false` y termina devolviendo `{ ok: true }` (`:86`). Efecto real: deja de registrar carritos abandonados y, como `debeAvisarCarrito` exige `registroDisponible` (`server/utils/ghl.ts:144`), **tampoco sale el evento de GHL**. El carrito abandonado nunca se recupera y nadie ve un error. Ojo: ese comportamiento es deliberado, porque ante la duda no disparar es lo barato (`cart-save.post.ts:69-72`). |
| `/api/coupon-validate` | `server/api/coupon-validate.post.ts:29-32` | Devuelve `{ valid: false, message: 'No se pudo validar el cupón. Intenta más tarde.' }`. Síntoma: **«el cupón nunca aplica»**. Si alguien te reporta eso, revisa primero la `service_role`, no la tabla de cupones. |

Lo mismo aplica a GoHighLevel: `emitirEventoGhl` **nunca lanza** (`server/utils/ghl.ts:83-84, 105-109`), por diseño explícito — va enganchada al webhook de pago y un fallo de red con GHL no puede tumbar la confirmación de un cobro (`ghl.ts:25-29`). Consecuencia: **un webhook de GHL mal puesto o caído no produce ningún error visible en el sitio**, solo un `console.warn` en los logs de Vercel.

---

## 7. Prueba de humo por variable

«Verificar el comportamiento en vivo» no es una intención si está escrito cómo. Esta es la lista mínima; corre la de cada variable que muevas, después de redesplegar.

| Variable | Prueba | Qué tiene que pasar |
|---|---|---|
| `NUXT_PEDIDOS_PIN` | `GET /api/pedidos?pin=loquesea` con un PIN incorrecto | **401 «PIN incorrecto»**, no 404. Si da **404**, la variable no entró (`server/api/pedidos.get.ts:18` vs `:21-23`). Este es el mejor detector de la trampa de la sección 5, porque distingue «mal PIN» de «sin PIN». |
| `NUXT_PUBLIC_WHATSAPP_PHONE` | Abre cualquier página y busca `wa.me/` en el HTML servido | El número que aparece tiene que ser el bueno. Si es el de `nuxt.config.ts:114` **y la variable estaba puesta**, no entró el despliegue. |
| `NUXT_ENVIO_COSTO` / `NUXT_PUBLIC_ENVIO_COSTO` | Carrito con subtotal **menor** a $1,000 | El resumen tiene que pintar el envío (`pages/carrito.vue:86-93`) **y** el total de la preferencia de pago tiene que traer el mismo cargo. Repite con subtotal **mayor** a $1,000: ahí el envío debe ser 0 (`server/utils/costoEnvio.ts:44`). |
| `NUXT_PROMO_VIGENCIA` | `GET /feeds/google.xml` | Tiene que aparecer la etiqueta de vigencia de la promoción. Si el feed sale sin ella, la variable no entró o el formato es inválido (`server/routes/feeds/google.xml.get.ts:44-55`). |
| `NUXT_N8N_CHAT_WEBHOOK` | Abre el chat EROS y manda dos mensajes distintos | Tiene que contestar **dos cosas distintas**. Si contesta siempre «Justo ahora no puedo responder. Escríbenos por WhatsApp…», está cayendo al respaldo (`server/api/chat.post.ts:15, 29-32`). |
| `NUXT_MP_ACCESS_TOKEN` + `SUPABASE_SERVICE_ROLE_KEY` + `NUXT_PUBLIC_PUBLIC_BASE_URL` | Pago de prueba de punta a punta | El pedido tiene que **pasar a `paid` en Supabase**, no quedarse en `pending`. `SETUP.md:57` lo dice igual para Stripe. Un pedido que se queda en `pending` después de un cobro real es el síntoma de las tres advertencias de este documento a la vez. |
| `NUXT_STRIPE_WEBHOOK_SECRET` | Panel de Stripe → Developers → Webhooks → tu endpoint | El último evento entregado tiene que dar **200**. Un 400 ahí significa que la firma no valida y que **cada cobro que entre se va a quedar sin registrar**. Compruébalo **antes** de encender `NUXT_PUBLIC_STRIPE_ENABLED`. |
| `SUPABASE_SERVICE_ROLE_KEY` (aislada) | `POST /api/coupon-validate` con un cupón que sabes bueno | Si responde «No se pudo validar el cupón», la `service_role` no está entrando (`server/api/coupon-validate.post.ts:29-32`). Es la prueba más barata porque no crea un pedido. |
| Los cinco `NUXT_GHL_WEBHOOK_*` | Logs de Vercel después de un pedido de prueba | Ausencia de `[ghl] <evento>: …` en los warnings. Como la función nunca lanza (`server/utils/ghl.ts:105-109`), el log es la **única** señal. Hazlo con un pedido de prueba tuyo, consciente de que cada disparo se cobra. |
| `SUPABASE_URL` / `SUPABASE_KEY` | Registro o inicio de sesión en `/cuenta` | Tiene que completar. Si el módulo no encontró la URL deja un `warn` al construir (`module.mjs:58-60`), visible en el log del build de Vercel. |

---

## 8. Qué hay que rotar el día del corte

Estas son credenciales que dan acceso a dinero, a datos de clientes o a un servicio que cobra por uso. Todas deben **regenerarse en su servicio de origen** y recargarse en Vercel (y en el `.env` de quien siga). Rotar no es cambiar el valor en Vercel: es **invalidar el viejo del lado del proveedor**, para que un valor filtrado deje de servir.

| Variable | Dónde se rota | Nota |
|---|---|---|
| `NUXT_MP_ACCESS_TOKEN` | Panel de Mercado Pago → Tus integraciones | Da acceso a cobrar y a consultar pagos. |
| `NUXT_MP_WEBHOOK_SECRET` | Panel de MP → Webhooks | Al rotarlo, las notificaciones firmadas con el anterior se rechazan. Rota y redespliega junto. |
| `NUXT_STRIPE_SECRET_KEY` | Stripe → Developers → API keys | Acceso completo a la cuenta de Stripe. |
| `NUXT_STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks | Si lo rotas sin redesplegar, **todos** los eventos empiezan a rechazarse con 400 y cada cobro que entre en esa ventana se queda sin registrar. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | La más sensible: salta RLS y lee/escribe todo, incluidos domicilios de clientes. |
| `SUPABASE_KEY` (anon) | Supabase → Project Settings → API | Rotarla implica rotar la llave de firma del proyecto, lo que **cierra la sesión de todos los usuarios**. Decisión consciente, no automática. |
| Los cinco `NUXT_GHL_WEBHOOK_*` | GoHighLevel: regenerar la URL de Inbound Webhook de cada workflow | Son secreto de facto: quien tenga la URL dispara el workflow y **genera cobro** (`server/utils/ghl.ts:53-55`). Son cinco URLs distintas, una por workflow. |
| `NUXT_N8N_CHAT_WEBHOOK` | n8n | La URL por defecto está **escrita en el repo** (`nuxt.config.ts:99`), así que quien tenga el código la tiene. Si importa, regenérala en n8n y ponla como variable. |
| `NUXT_PEDIDOS_PIN` | Se elige uno nuevo | Protege nombre, teléfono y domicilio de clientes, y la comparación es en claro y sin rate limit (`server/api/pedidos.get.ts:21-23`). Avísale a quien surte, porque su pantalla deja de abrir con el PIN viejo. |
| `NUXT_RESENA_SECRET` | Se genera una cadena nueva | **Ojo al efecto secundario:** al rotarla, los enlaces de reseña ya enviados por correo dejan de validar (`server/utils/resenaToken.ts:39-59`, `server/api/resena.post.ts:34-36`). Es el precio correcto a pagar; solo no te sorprendas si alguien reporta que su enlace «ya no sirve». |

No requieren rotación (no son secretos): `NUXT_PUBLIC_WHATSAPP_PHONE`, `NUXT_PUBLIC_SITE_URL`, `NUXT_PUBLIC_PUBLIC_BASE_URL`, `NUXT_PUBLIC_STRIPE_ENABLED`, `NUXT_PUBLIC_ENVIO_COSTO`, `NUXT_ENVIO_COSTO`, `NUXT_PROMO_VIGENCIA`, `SUPABASE_URL`.

Los identificadores de rastreo (GA4, Google Ads, Clarity, Meta Pixel) **no son variables de entorno**: están escritos directo en `plugins/tracking.client.ts:14-17`. No los busques en Vercel. Si hay que cambiarlos, se cambian en el código y se despliega.

---

## 9. Dos documentos del repo que ya no están al día

Los vas a encontrar y te van a confundir, así que quede dicho:

- **`.env.example` está incompleto.** Tiene 16 variables. **Le faltan seis** que el código sí lee: `NUXT_N8N_CHAT_WEBHOOK`, `NUXT_ENVIO_COSTO`, `NUXT_PUBLIC_ENVIO_COSTO`, `NUXT_PEDIDOS_PIN`, `NUXT_RESENA_SECRET` y `NUXT_PROMO_VIGENCIA`. Si copias `.env.example` a `.env` y arrancas, el envío sale gratis, la pantalla de pedidos da 404 y los enlaces de reseña salen sin firma. Todo sin un error. **Esta tabla, no `.env.example`, es el inventario bueno.**
- **`SETUP.md:31-38` lista solo ocho variables** (las líneas 29-30 son el encabezado de la tabla) y es de una etapa anterior del proyecto. Su información sobre Stripe (`SETUP.md:44-58`) sigue siendo útil como procedimiento de alta; su tabla de variables no.

---

## 10. Arranque en limpio, en orden

1. `npm install` y copia `.env.example` a `.env` (`SETUP.md:12-16`). Recuerda que `.env` **no viaja en el repo** (`.gitignore:5-7`): el ejemplo no trae un solo valor bueno.
2. Completa en `.env` **las seis que faltan**, listadas en la sección 9.
3. Mínimo para que el sitio levante y navegue: `SUPABASE_URL`, `SUPABASE_KEY`, `NUXT_PUBLIC_WHATSAPP_PHONE`, `NUXT_PUBLIC_PUBLIC_BASE_URL=http://localhost:3000`.
4. **Añade `SUPABASE_SERVICE_ROLE_KEY` cuanto antes, aunque no vayas a probar pagos.** Sin ella no se registra **ningún** pedido, tampoco el de WhatsApp —y el pedido por WhatsApp es el canal principal de la tienda—: el cliente abre el chat igual y en la base no queda nada (`server/api/order-whatsapp.post.ts:5`, `server/utils/orders.ts:22,90`). Además el cupón «nunca aplica» y los carritos abandonados no se guardan. Ver la sección 6 antes de dar por bueno que «funciona».
5. Para probar el flujo de pago con tarjeta hace falta además el token de MP o la llave de Stripe.
6. **En local, deja los `NUXT_GHL_WEBHOOK_*` vacíos.** Cada disparo se paga, y una prueba tuya dispararía correos reales a clientes reales.
7. `npm run dev` → `http://localhost:3000`.
8. Corre la prueba de humo de la sección 7 para lo que hayas configurado. Las pruebas automáticas se corren con `npm run test` (`package.json:11`), pero **no sustituyen** esto: la suite de e2e pisa las variables con valores propios (`playwright.config.ts:32-45`), así que verde no significa «mi `.env` está bien».

Para la lista de variables que hay que cargar del lado de Vercel, usa la tabla de la sección 3 filtrando por «Dónde vive», y la tabla de entornos de la sección 5 para decidir en cuáles marcarlas. **No hay forma de verificar desde el repo cuáles están cargadas hoy, con qué valor ni en qué entornos**: eso hay que abrirlo en el panel y compararlo contra esta tabla, variable por variable. Es lo primero que yo haría el día uno.
