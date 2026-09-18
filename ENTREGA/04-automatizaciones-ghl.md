# Automatizaciones y GoHighLevel

Esta capa es un **puente de una sola dirección**: el sitio avisa a GoHighLevel (GHL) de que pasó algo, y GHL decide qué correo o qué WhatsApp mandar. El sitio no manda correos, no manda WhatsApp y no guarda contactos de marketing. Todo eso vive del otro lado, en workflows que arma César (`BITACORA.md:8`).

El archivo central es `server/utils/ghl.ts`. Las demás piezas de este documento cuelgan de él.

> **Antes de tocar nada de aquí, lee tres cosas:** la sección 10 (GHL puede regenerar la URL del Inbound Webhook), la sección 7 (el candado del carrito, que hoy está roto de una forma que **cobra de más**) y la sección 13 (cómo probar sin gastar dinero).

---

## 1. Por qué hay una URL por automatización y no una global

GHL no expone un webhook único al que se le mande un campo `tipo_de_evento` para que él enrute. **Genera una URL de "Inbound Webhook" distinta por cada workflow** (`server/utils/ghl.ts:7-10`, `.env.example:43-45`). Eso invierte el diseño normal: aquí **el evento no viaja como dato, el evento ES la URL a la que se hace el POST**.

El cuerpo sí lleva un campo `evento` (`server/utils/ghl.ts:97`), pero es **solo para depurar**: si mañana ese campo se borrara, el enrutamiento seguiría igual porque depende de a qué URL se pegó.

Consecuencias prácticas, y son las que importan para operar:

- **Cada automatización se enciende y se apaga por separado.** Poner la URL de postcompra no enciende el carrito abandonado. Hay un test que lo fija (`test/unit/ghl.test.ts:47-53`).
- **Si dos variables se cruzan, el correo equivocado le llega al cliente equivocado — y cobrado.** Hay un test dedicado a eso, con ese razonamiento escrito en el comentario (`test/unit/ghl.test.ts:63-76`).
- **Las URLs son credenciales.** Llevan el id de la cuenta de GHL, y quien las tenga puede disparar el workflow y generar cobro. Por eso no se commitean: viven en `.env` local y en las variables de entorno de Vercel (`server/utils/ghl.ts:50-56`, `.env.example:47-49`). El mapa evento → nombre de variable está en `server/utils/ghl.ts:57-63`.

---

## 2. Catálogo de eventos que el sitio sabe emitir

Los cinco eventos están declarados en el tipo `GhlEvento` (`server/utils/ghl.ts:36-48`).

| Evento | Variable de entorno | Quién lo dispara | Cuándo |
|---|---|---|---|
| `compra_confirmada` | `NUXT_GHL_WEBHOOK_POSTCOMPRA` | `server/api/mp-webhook.post.ts:198` | Cuando **Mercado Pago** confirma un pago y el `UPDATE` a `paid` gana la carrera |
| `carrito_abandonado` | `NUXT_GHL_WEBHOOK_CARRITO_ABANDONADO` | `server/api/cart-save.post.ts:78` | Primera vez que aparece un carrito vivo para un correo (ver el candado, sección 7) |
| `pedido_para_surtir` | `NUXT_GHL_WEBHOOK_AVISO_PEDIDO` | `server/utils/avisoPedido.ts:79`, llamado desde `server/api/mp-webhook.post.ts:186` | Mismo momento que `compra_confirmada`, pero es otro destinatario y otro workflow |
| `pedido_enviado` | `NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` | `server/api/pedido-enviado.post.ts:44` | Cuando quien surte marca el pedido como enviado desde `/pedidos` |
| `reactivacion` | `NUXT_GHL_WEBHOOK_REACTIVACION` | **nadie** | Nunca: está declarado y mapeado, pero no hay una sola línea del sitio que lo emita |

Sobre `reactivacion`: aparece en el tipo (`server/utils/ghl.ts:39`), en el mapa (`:60`), en `.env.example:52` y en los tests, pero **ningún endpoint ni plugin lo llama**. Es una ranura reservada para el workflow de recompra, no una función viva. Está cableada en `ENV_POR_EVENTO`, así que `ghlConectado('reactivacion')` funcionaría si alguien le pusiera URL; lo que falta es el emisor. **No es código muerto: no lo borres del mapa.**

Las dos automatizaciones que salen del mismo momento —`compra_confirmada` y `pedido_para_surtir`— son deliberadamente distintas: **una es marketing para el comprador, la otra es un aviso operativo para quien empaca**. Dos URLs, dos workflows, dos destinatarios (`server/api/mp-webhook.post.ts:150-151`, `:183-185`).

Solo tres archivos del repo importan `utils/ghl`: `server/api/cart-save.post.ts:8`, `server/api/mp-webhook.post.ts:16` y `server/api/pedido-enviado.post.ts:8` (más `server/utils/avisoPedido.ts:18`, que lo importa como `./ghl`). Ese dato importa para la sección que sigue.

---

## 3. ⚠️ El otro camino de pago: Stripe no avisa a nadie

El sitio tiene **dos** webhooks de pago, no uno. `server/api/mp-webhook.post.ts` es el de Mercado Pago, y es el que dispara los eventos de GHL. Pero existe también `server/api/stripe-webhook.post.ts`, que marca pedidos como `paid` con el mismo `UPDATE` atómico (`server/api/stripe-webhook.post.ts:121-129`) y **no importa `server/utils/ghl.ts` ni llama a `avisarPedidoParaSurtir()`**.

Traducido: **un pedido pagado con tarjeta por Stripe no dispara `compra_confirmada` ni el aviso a quien surte.** El cliente no recibe postcompra, no entra a la secuencia de reseña del día 10, y —más grave— **nadie se entera de que hay un pedido que empacar**, más que entrando a `/pedidos` a mirar.

Hoy eso no está mordiendo a nadie porque el botón «Pagar con tarjeta» solo se pinta si `NUXT_PUBLIC_STRIPE_ENABLED` está puesta (`pages/carrito.vue:20`, `:430`; `nuxt.config.ts:119-120`), y el propio código anota que ese camino está apagado (`pages/carrito.vue:198-201`).

> ⚠️ **Mina.** El día que alguien ponga `NUXT_PUBLIC_STRIPE_ENABLED=1` para aceptar tarjetas, **se abre un camino de venta sin ninguna automatización**, y sin un solo error en los logs: no es un fallo, es código que no existe. Es la misma forma de fallo que la de la sección 11 (el aviso que colgaba de la variable equivocada), solo que más grande. Antes de encender Stripe, hay que replicar en `stripe-webhook.post.ts` el bloque de `mp-webhook.post.ts:161-210`.

---

## 4. El contrato de datos, campo por campo

### Campos que lleva todo evento

`emitirEventoGhl` envuelve cualquier payload con dos campos antes de mandarlo (`server/utils/ghl.ts:97`):

| Campo | Tipo | Para qué |
|---|---|---|
| `evento` | texto | El nombre del evento. **Solo para depurar**, el enrutamiento es por URL |
| `enviado_en` | ISO 8601 | Momento de emisión, en UTC (`new Date().toISOString()`) |

Es un `POST` con `content-type: application/json` y un timeout de **4000 ms** (`server/utils/ghl.ts:66`, `:94-99`).

> **Regla para quien agregue el sexto evento:** el cuerpo se arma como `{ evento, enviado_en, ...datos }` (`server/utils/ghl.ts:97`), con el *spread* **al final**. O sea que un campo del payload que se llame `evento` o `enviado_en` **pisa** al del sobre y GHL recibe otra cosa de la que cree. Hoy ninguno de los cinco payloads usa esos dos nombres, así que no muerde a nadie; es una regla que hay que conocer antes de bautizar un campo nuevo.

### `compra_confirmada` — `payloadCompra()` (`server/utils/ghl.ts:156-201`)

| Campo | Tipo | Notas |
|---|---|---|
| `pedido_id` | texto | El `id` de la fila en `orders` |
| `email` | texto o `null` | Del usuario de Supabase si hay cuenta; si no, del correo que la persona tecleó en el carrito (`server/api/mp-webhook.post.ts:177-182`) |
| `nombre` | texto o `null` | Sale de `shipping_address.recipient` |
| `telefono` | texto o `null` | Sale de `shipping_address.phone` |
| `total` | número | |
| `num_articulos` | número | **Suma de cantidades, no de renglones** (`server/utils/ghl.ts:185`) |
| `items[]` | arreglo | Cada uno: `slug`, `nombre`, `precio`, `cantidad`, `url_producto` |
| `producto_principal` | texto o `null` | El primer renglón, aplanado |
| `producto_principal_slug` | texto o `null` | |
| `url_producto` | texto o `null` | Ficha del producto principal |
| `url_resena` | texto o `null` | Enlace firmado del producto principal |
| `urls_resena[]` | arreglo | Un enlace firmado **por producto**: `producto`, `slug`, `url` |

Dos decisiones que parecen redundancia y no lo son:

1. **`nombre` y `telefono` van aunque el contacto ya exista en GHL.** Sin ellos, GHL no puede armar un contacto de verdad: la plantilla saluda «Hola ,» y el comprador queda en el CRM como un ID sin persona. Está documentado con ese detalle en `server/utils/ghl.ts:178-181` y fijado con test en `test/unit/ghl.test.ts:184-195`.
2. **El producto principal va aplanado además de dentro de `items`.** GHL sufre para iterar arreglos dentro de una plantilla de correo, así que se le da masticado (`server/utils/ghl.ts:186-188`).

Los campos nulos se mandan como `null` explícito, **nunca como cadena vacía ni `undefined`** (`test/unit/ghl.test.ts:190-195`). Eso es parte del contrato: la plantilla necesita poder distinguir "no hay dato" de "dato vacío".

### `carrito_abandonado` (`server/api/cart-save.post.ts:78-84`)

| Campo | Tipo | Notas |
|---|---|---|
| `email` | texto | Normalizado a minúsculas y sin espacios (`server/api/cart-save.post.ts:21`) |
| `total` | número | |
| `num_articulos` | número | Suma de cantidades |
| `items[]` | arreglo | Cada uno: `slug`, `name`, `price`, `quantity` |
| `url_carrito` | texto | `NUXT_PUBLIC_SITE_URL` + `/carrito` |

> **Ojo con esto al mapear campos en GHL:** aquí los renglones van con llaves **en inglés** (`name`, `price`, `quantity`), porque se reusa el objeto tal como se guarda en la tabla (`server/api/cart-save.post.ts:28-30`). En `compra_confirmada` los mismos renglones van **en español** (`nombre`, `precio`, `cantidad`, `server/utils/ghl.ts:166-172`). Es una inconsistencia real del contrato: un mapeo copiado de un workflow a otro se va a romper en silencio.

### `pedido_para_surtir` (`server/utils/avisoPedido.ts:79-91`)

| Campo | Tipo | Notas |
|---|---|---|
| `pedido_id` | texto | |
| `total` | número | |
| `articulos` | texto | Ya formateado: `"2x Mini Antojo Nubby, 1x Antifaz"` |
| `direccion` | texto | La dirección completa **en una sola línea**, lista para pegar en una guía |
| `sin_direccion` | booleano | `true` si el pedido no trae calle |
| `es_regalo` | booleano | Cambia cómo se empaca: caja neutra, sin precios |
| `telefono` | texto o `null` | |
| `email` | texto o `null` | Para contactar al cliente si el paquete rebota o falta un dato |
| `mensaje` | texto multilínea | El WhatsApp ya redactado, listo para que el workflow lo mande tal cual |
| `url_pedidos` | texto | Enlace al panel de pedidos |

Aquí casi todo el trabajo es de formato, y es a propósito: **el destino es un mensaje de WhatsApp en un teléfono**. La dirección se manda armada en una línea, no en campos sueltos, porque quien surte necesita copiarla de un jalón, no rearmarla a mano (`server/utils/avisoPedido.ts:41-58`). Y cuando el pedido no trae dirección, el texto lo grita con un aviso explícito en vez de dejar un hueco, porque un pedido sin dirección no se puede surtir y hay que pedírsela al cliente antes de empacar nada (`server/utils/avisoPedido.ts:68`, test en `test/unit/aviso-pedido.test.ts:49-54`).

**Por qué el aviso a quien surte va por GHL y no por la API de WhatsApp directamente:** GHL es el único canal de WhatsApp que el proyecto ya tiene conectado y andando. Meter la API de WhatsApp implicaría credenciales nuevas y un canal más que mantener (`server/utils/avisoPedido.ts:7-13`).

### `pedido_enviado` — `payloadEnvio()` (`server/utils/ghl.ts:216-249`)

| Campo | Tipo | Notas |
|---|---|---|
| `pedido_id` | texto | |
| `email` | texto o `null` | De `shipping_address.email` |
| `nombre` | texto o `null` | De `shipping_address.recipient` |
| `telefono` | texto o `null` | De `shipping_address.phone` |
| `guia` | texto o `null` | **`null` explícito** si no hay número, nunca cadena vacía |
| `tiene_guia` | booleano | El interruptor que usa la plantilla |
| `total` | número | |
| `num_articulos` | número | Suma de cantidades |
| `items[]` | arreglo | Cada uno: `nombre`, `cantidad` |
| `items_texto` | texto multilínea | La misma lista, ya impresa: `"2 × Jock 6\n1 × Antifaz Princesa"` |

Dos cosas que hay que entender antes de "limpiar" este payload:

- **`guia: null` + `tiene_guia: false` no es lo mismo que `guia: ""`.** A veces se marca el envío antes de tener el número, y la plantilla necesita poder elegir entre «ya salió, en cuanto tengamos la guía te la pasamos» y el mensaje con número, en vez de pintar un hueco (`server/utils/ghl.ts:211-214`, test en `test/unit/ghl.test.ts:293-301`).
- **`items_texto` va ADEMÁS del arreglo, no en vez de.** GHL no itera arreglos dentro de una plantilla de correo: `items` a secas sale como `[object Object]`. El CSS `white-space: pre-line` que César dejó puesto en la plantilla solo hace algo si el valor ya trae saltos de línea de verdad — por eso existe este campo (`server/utils/ghl.ts:236-247`, `BITACORA.md:270-271`). Si alguien lo borra por parecer duplicado, la lista de artículos del correo se rompe.

---

## 5. Las tres reglas que no se negocian

Están escritas en la cabecera de `server/utils/ghl.ts:19-31`. No son estilo: cada una tapa un agujero que ya se abrió alguna vez.

### Regla 1 — Sin URL configurada, no hace nada

`emitirEventoGhl` mira la variable de su evento y, si viene vacía, devuelve `false` sin tocar la red (`server/utils/ghl.ts:90-91`; test en `test/unit/ghl.test.ts:57-61`). `ghlConectado()` se pregunta **por evento**, no global (`server/utils/ghl.ts:76-78`).

**Por qué:** permite que el sitio se comporte exactamente igual con GHL conectado o desconectado, y que cada automatización se vaya encendiendo de a una conforme César publica su workflow. Un entorno de desarrollo sin esas variables no dispara nada y no genera cobro. Esta regla es además la **palanca de apagado de emergencia** (sección 13).

### Regla 2 — Nunca lanza

Ni un error de red, ni un timeout, ni un DNS caído, ni un JSON no serializable salen de este módulo: todo cae en el `catch` y muere ahí, devolviendo `false` (`server/utils/ghl.ts:100-109`).

**Por qué:** este módulo va enganchado al webhook de Mercado Pago, que es **el camino por el que se confirma un pago**. Si un fallo de red con GHL tumbara ese handler, Mercado Pago lo reintentaría y el pedido podría quedarse sin marcar como pagado. Dicho como está en el código: un correo de marketing que no sale es un problema; un pago que no se registra es otro tamaño de problema (`server/utils/ghl.ts:25-29`). El test que lo fija es `test/unit/ghl.test.ts:118-132`, y comprueba además que no queden promesas rechazadas sueltas en el runtime.

### Regla 3 — No bloquea al cliente

Timeout corto (4 s) y el llamador no espera el resultado: para eso está `emitirEventoGhlSinEsperar` (`server/utils/ghl.ts:119-124`), que es la variante que usan los handlers con un cliente del otro lado. El `void` y el `.catch(() => false)` son redundantes a propósito, para garantizar que nada escape como *unhandled rejection*.

---

## 6. ⚠️ La entrega NO está garantizada, y no hay red que la atrape

Esto es consecuencia directa de las reglas 2 y 3, y hay que decirlo con todas sus letras porque un desarrollador nuevo va a asumir lo contrario.

**En este repo no hay:**

- **reintento.** `emitirEventoGhl` hace un `fetch` y ya (`server/utils/ghl.ts:93-109`). Si falla, devuelve `false` y nadie lo vuelve a intentar.
- **cola ni dead-letter.** No existe tabla, archivo ni servicio donde caiga un evento que no salió.
- **registro de entregas.** Nada persiste qué evento se mandó, a qué hora, ni con qué resultado. Lo único que queda es un `console.warn` en los logs de Vercel (`server/utils/ghl.ts:101`, `:107`), que se pierde con la retención de logs.

**Y encima, el disparo queda en vuelo después de que el handler ya contestó.** `emitirEventoGhlSinEsperar` hace `void emitirEventoGhl(...)` (`server/utils/ghl.ts:123`) y el handler devuelve su respuesta sin esperarlo: `server/api/cart-save.post.ts:78-86`, `server/api/mp-webhook.post.ts:198`, `server/api/pedido-enviado.post.ts:44-55`. `avisarPedidoParaSurtir` hace lo mismo con un `void ... .catch()` (`server/utils/avisoPedido.ts:79-91`). En un entorno serverless como Vercel eso es un riesgo real: la función puede congelarse o terminarse en cuanto devuelve la respuesta, y una petición que no había salido todavía se pierde sin dejar rastro.

**La consecuencia operativa que importa:** *no hay warning en los logs* **no significa** *el evento llegó*. Significa únicamente que `fetch` no lanzó y que GHL, si contestó, contestó con `res.ok`. Es exactamente la misma trampa que la sección 10 describe desde el otro lado, y por eso ahí la única prueba válida es el historial de ejecuciones del workflow.

Si algún día hace falta entrega confiable (por ejemplo, si el aviso a quien surte se vuelve crítico), el arreglo no es subir el timeout: es persistir el evento antes de mandarlo y reintentar desde un job. Eso no existe hoy.

---

## 7. El candado del carrito abandonado

**Los triggers de GHL son premium y se cobran POR USO** (`server/utils/ghl.ts:12-17`, `.env.example:47-49`, `BITACORA.md:798-801`). Eso cambia el criterio de diseño: no basta con que funcione, tiene que dispararse el mínimo de veces posible.

El problema concreto: `/api/cart-save` se llama muchísimo. El plugin del cliente guarda con un *debounce* de 4 s en cada cambio del carrito y manda un `sendBeacon` cada vez que la pestaña se oculta o se abandona (`plugins/cart-recovery.client.ts:39-51`). **Un solo comprador genera fácilmente 8-10 llamadas** (`server/api/cart-save.post.ts:35-39`). Seguir cada guardado sería tirar dinero y, peor, volver a meter al mismo contacto en la secuencia de 1h/24h/48h una y otra vez.

El candado vive en `debeAvisarCarrito()` (`server/utils/ghl.ts:138-146`), y está fuera del endpoint a propósito, para poder probarlo. Toma tres entradas y solo devuelve `true` en la **transición de "sin carrito abandonado" a "con carrito abandonado"**:

| Entrada | Qué significa DE VERDAD | Efecto |
|---|---|---|
| `recuperado` | El carrito se vació o ya compró | No avisa: de sacar al cliente de la secuencia se encargan los extractores del lado de GHL (`server/utils/ghl.ts:143`) |
| `episodioVivo` | Ya hay una fila sin recuperar para ese correo | No avisa: de este mismo episodio ya se avisó (`server/utils/ghl.ts:145`) |
| `registroDisponible` | **No explotó la construcción del cliente de Supabase** — *no* «la lectura de la tabla salió bien» | Si es `false`, no avisa (`server/utils/ghl.ts:144`) |

El estado vive en la tabla `abandoned_carts`, con `unique (email)` (`supabase/abandoned-carts.sql:12-21`), que es lo que hace posible el `upsert` con `onConflict: 'email'` (`server/api/cart-save.post.ts:63-66`). Cuando el carrito se recupera, la fila se marca `recovered: true` (`server/api/cart-save.post.ts:53`) y **eso es lo que rearma el candado para el siguiente carrito**.

El bloque de pruebas que protege esta regla es `test/unit/ghl.test.ts:139-167`, y su comentario dice para qué está: es la regla que evita la factura.

### ⚠️ Deuda conocida: el candado promete más de lo que cumple

Dentro de `debeAvisarCarrito()` la regla «ante la duda, no dispara» es cierta: con `registroDisponible: false` devuelve `false`, siempre (`server/utils/ghl.ts:144`, test en `test/unit/ghl.test.ts:158-162`). **El problema está en quién calcula esa entrada.**

En `server/api/cart-save.post.ts:62`, `registroDisponible` se pone en `true` **justo después del `select`, sin mirar si ese `select` devolvió error**. Y el error se descarta al destructurar: la línea 55 es `const { data: previo } = await admin...`, sin `error`. `supabase-js` **no lanza** cuando PostgREST devuelve error: `shouldThrowOnError` arranca en `false` por defecto (`node_modules/@supabase/postgrest-js/src/PostgrestBuilder.ts:80`, `:133`), así que la consulta resuelve con `{ data: null, error }` en vez de rechazar.

El `catch` de `server/api/cart-save.post.ts:68-73` —el que lleva el comentario «La tabla puede no existir aun»— **solo se alcanza si `supabaseAdmin()` lanza**, o sea si faltan `SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY` (`server/utils/supabaseAdmin.ts:13-19`). Nunca por una tabla que no existe. El comentario describe una intención que ese `catch` no puede cumplir.

> ⚠️ **Trampa operativa, y cuesta dinero:** si la tabla `abandoned_carts` desaparece, se renombra o pierde su índice único, **nada truena**. El `select` devuelve `{ data: null, error }`, así que `previo` es `null` → `episodioVivo = false` (`:61`), `registroDisponible = true` (`:62`), y el `upsert` de `:63` también falla en silencio sin escribir fila. Resultado: `debeAvisarCarrito({recuperado:false, episodioVivo:false, registroDisponible:true})` devuelve `true` **en cada llamada**. O sea **8-10 disparos premium por comprador**, y el mismo contacto reinyectado una y otra vez en la secuencia de 1h/24h/48h.
>
> **El síntoma no es que dejen de llegar los correos de carrito: es una factura de GHL disparada y clientes spameados.** Lo mismo pasa si se pierde el `unique (email)`: el `upsert` con `onConflict: 'email'` devuelve error `42P10` en vez de lanzarlo, nunca se escribe fila, y `episodioVivo` se queda en `false` para siempre.
>
> Si sospechas de esto: revisa que la tabla y su índice existan (sección 12), y considera comprobar el `error` de las dos consultas de `server/api/cart-save.post.ts:55-66` antes de fiarte del candado. **Para que la regla valga lo que dice, hay que capturar ese `error` y poner `registroDisponible = false` cuando venga.** Hoy, la promesa de «ante la duda, no dispara» solo cubre el caso de credenciales de Supabase ausentes.

Detalle relacionado: `episodioVivo` arranca en `true`, o sea en pesimista (`server/api/cart-save.post.ts:44`), pero se sobrescribe sin condiciones en `:61`. Ese valor inicial solo sobrevive si `supabaseAdmin()` lanzó — y en ese caso `registroDisponible` ya es `false` y el candado cierra por la otra vía.

**Quién entra hoy a la secuencia:** solo se guarda carrito si hay correo — de la sesión de Supabase, o de `localStorage('amanti_email')` (`plugins/cart-recovery.client.ts:11-15`). Esa llave la escribe **un solo lugar del sitio**: el formulario de envío del carrito, cuando la persona teclea un correo válido (`pages/carrito.vue:130-141`). O sea que un invitado entra a la secuencia de recuperación **solo si llegó hasta el formulario y escribió su correo**. Antes esa llave la escribía el modal de bienvenida, que fue sustituido por el formulario de GHL, y quedó huérfana: durante ese periodo ningún invitado entraba a la secuencia (`pages/carrito.vue:133-137`, `BITACORA.md:754-757`).

---

## 8. Reseñas de invitado con enlace firmado

`server/utils/resenaToken.ts` + `server/api/resena.post.ts`.

### Qué problema resuelve

Hasta el 27 de agosto de 2026, dejar reseña exigía iniciar sesión. Ese mismo día se descubrió que **quien compra sin cuenta es la mayoría**. La secuencia del día 10 que arma César manda al cliente a la ficha del producto a dejar su reseña; sin esto, todos esos clientes llegaban a un «Inicia sesión» y se iban (`server/utils/resenaToken.ts:1-8`, `supabase/resenas-invitado.sql:1-7`).

### Por qué un enlace firmado y no un enlace de acceso (magic link)

César propuso mandar un enlace de acceso para que el invitado se cree cuenta y reseñe. Se eligió el enlace firmado por dos razones, escritas en `server/utils/resenaToken.ts:15-19`:

1. **No obliga a nadie a crear cuenta para opinar.** Cada paso que se le pide a alguien que ya compró es gente que se cae del embudo.
2. **La reseña queda amarrada a una compra real.** Con el sistema de cuentas, cualquier usuario registrado podía reseñar cualquier producto sin haberlo comprado nunca. El camino del invitado quedó **más estricto** que el de quien tiene cuenta (`server/api/resena.post.ts:11-13`).

### Cómo funciona

- La firma es un **HMAC-SHA256 de `"<orderId>:<slug>"`** con la llave `NUXT_RESENA_SECRET`, que solo vive en el servidor, recortado a **32 caracteres hex** (`server/utils/resenaToken.ts:39-43`). Se recorta porque el enlace va en un correo, lo lee gente y a veces lo teclea; 128 bits sobran para lo que protege.
- La comparación es de **tiempo constante** (`timingSafeEqual`). Comparar con `===` filtra byte a byte qué tan cerca anduvo quien lo intenta, y con suficientes intentos eso permite construir una firma válida sin conocer la llave (`server/utils/resenaToken.ts:45-59`).
- Se **acepta la firma en mayúsculas**, porque algunos clientes de correo reescriben la URL y perder por eso la reseña de alguien que sí compró sería un error caro (`server/utils/resenaToken.ts:56`, `test/unit/resena-token.test.ts:48-53`).
- El enlace queda así: `/tienda/<slug>?pedido=<id>&firma=<hmac>#resenas` (`server/utils/resenaToken.ts:67-71`). La ficha lo lee de la query y lo manda a `/api/resena` (`pages/tienda/[slug].vue:45-53`, `:71-78`).

### Los tres candados del endpoint

En este orden (`server/api/resena.post.ts:6-13`):

1. **La firma es válida.** Se revisa antes de tocar la base: si no lo es, no hay por qué gastar una consulta ni revelar si ese pedido existe (`server/api/resena.post.ts:32-36`).
2. **El pedido está en `paid`** (`server/api/resena.post.ts:54-56`).
3. **Ese pedido de verdad incluye ese producto** (`server/api/resena.post.ts:58-65`).

Además: una firma **no sirve para otro producto del mismo pedido ni para otro pedido** (`test/unit/resena-token.test.ts:31-40`), y hay un índice único parcial `(order_id, product_slug) where order_id is not null` que garantiza **una reseña por producto y por compra**, devuelta al cliente como un 409 con mensaje amable (`supabase/resenas-invitado.sql:22-30`, `server/api/resena.post.ts:80-86`). Ese índice es parcial a propósito: el índice viejo `(user_id, product_slug)` no cubre nada cuando `user_id` es `NULL`, porque en Postgres los `NULL` no chocan entre sí.

El nombre que se publica es **solo el que la persona teclea**; si lo deja en blanco va la etiqueta neutra `Cliente AMANTI` (`utils/nombreResena.ts:17-21`). Nunca el del envío ni el pedazo del correo antes de la arroba. La razón está escrita completa en `utils/nombreResena.ts:6-16`: la ficha es pública, AMANTI vende con entrega discreta, y antes había gente firmando en público la reseña de un juguete sexual con su nombre real.

### Interruptor y trampa

Sin `NUXT_RESENA_SECRET` la función **queda apagada entera**: no se firman enlaces, el endpoint responde 404, y `urlResena()` devuelve el enlace de siempre sin permiso, así que la ficha se abre igual y quien tenga cuenta reseña como antes (`server/utils/resenaToken.ts:21-23`, `:30-33`, `:66-71`; `server/api/resena.post.ts:20`; `test/unit/resena-token.test.ts:72-91`).

> ⚠️ **Rotar `NUXT_RESENA_SECRET` invalida de golpe todos los enlaces ya enviados.** Con otra llave, una firma emitida antes deja de valer (`test/unit/resena-token.test.ts:55-59`). Como los correos del día 10 se abren días después de mandarse, cambiar esa llave significa que la gente que recibió el correo la semana pasada llega a la ficha y se topa con «Este enlace no es válido». No la rotes sin una razón de seguridad de verdad.

---

## 9. El aviso de envío al cliente, y quién puede entrar a `/pedidos`

`server/api/pedido-enviado.post.ts` + `server/api/pedidos.get.ts` + `pages/pedidos.vue`.

El aviso lo pidió Raúl el 31 de agosto de 2026, y hasta ese día la respuesta era que no se avisaba nada — aunque `pages/envios.vue:29` ya lo promete por escrito: *«Recibirás un número de rastreo por email una vez que tu pedido sea enviado»* (`server/utils/ghl.ts:43-48`).

Cómo funciona:

1. Quien surte entra a `/pedidos`, escribe el número de guía (opcional) y da «Marcar enviado» (`pages/pedidos.vue:70-81`, `:166-171`).
2. El endpoint valida el **mismo PIN** que `GET /api/pedidos`, contra `NUXT_PEDIDOS_PIN`. Sin PIN configurado, el endpoint responde 404 y no existe (`server/api/pedido-enviado.post.ts:11-15`).
3. Escribe `shipped_at` y `tracking` en `orders`. **No toca el estado del pago**, que es autoridad exclusiva del webhook de Mercado Pago (`server/api/pedido-enviado.post.ts:4-5`, `:22-27`).
4. Emite `pedido_enviado` con `payloadEnvio()` (`server/api/pedido-enviado.post.ts:44-55`).

Tres decisiones que hay que respetar:

- **Existe un "deshacer"**, porque marcar de más pasa y sin esto habría que entrar a la base a corregirlo (`server/api/pedido-enviado.post.ts:20-25`).
- **Deshacer NO dispara nada.** Un «ya va en camino» seguido de nada es peor que no avisar (`server/api/pedido-enviado.post.ts:30-31`, `:37`).
- **El aviso va envuelto en `try/catch` y sin esperar respuesta.** Si GHL está caído o la URL no está puesta, quien surte tiene que poder seguir marcando pedidos: un aviso que no sale se reenvía, un pedido que no se puede marcar como enviado detiene el trabajo de quien empaca (`server/api/pedido-enviado.post.ts:32-36`, `:56-58`).

### El modelo de seguridad de `/pedidos`, dicho completo

Esto **no es un interruptor de encendido**, es lo único que separa a cualquiera de los domicilios de los clientes. Hay que entenderlo tal como está antes de tocarlo:

- Es **un PIN compartido, en texto plano**, leído de `NUXT_PEDIDOS_PIN` y comparado con `!==` —no con comparación de tiempo constante— en los dos endpoints: `server/api/pedido-enviado.post.ts:15` y `server/api/pedidos.get.ts:21`.
- No hay cuentas, no hay roles y no hay registro de quién entró. El propio código lo dice sin adornos: «No es autenticación de verdad… Cuando haya más gente surtiendo, esto debe pasar a cuentas con rol» (`server/api/pedidos.get.ts:6-12`).
- El PIN **viaja en el cuerpo de cada POST** (`pages/pedidos.vue:73-76`) y **en la query string del GET** (`pages/pedidos.vue:27`, `server/api/pedidos.get.ts:20-21`). Una query string es justo lo que acaba en historiales de navegador y en registros de acceso.
- Se guarda en `localStorage` del navegador de quien surte para no teclearlo cada vez (`pages/pedidos.vue:30`, `:41-42`). Cómodo desde el teléfono, y también significa que el teléfono de esa persona guarda la llave.
- Lo que hay del otro lado son **nombre, teléfono, domicilio completo y qué compró** cada cliente (`server/api/pedidos.get.ts:29-35`, `pages/pedidos.vue:51-59`).
- La pantalla se protege de buscadores con un `<meta name="robots" content="noindex, nofollow">` (`pages/pedidos.vue:83-89`) y con `Disallow: /pedidos` en `public/robots.txt:6`. Eso evita que se indexe; **no evita que entre quien tenga el enlace y el PIN**.

Lo único que está bien resuelto es el fallo por omisión: **sin `NUXT_PEDIDOS_PIN` configurada los dos endpoints responden 404**, no quedan abiertos (`server/api/pedidos.get.ts:11-12`, `:17-18`). Un descuido de configuración no publica domicilios.

**Si el PIN se filtra:** se cambia la variable en Vercel y se redespliega (`server/api/pedidos.get.ts:9`). No hay forma de saber si alguien lo usó.

---

## 10. ⚠️ Trampa conocida: GHL puede regenerar la URL del Inbound Webhook

**Esto costó un día entero de diagnóstico. Es lo más importante de este documento.**

### El fallo

GoHighLevel **puede regenerar la URL del Inbound Webhook al volver a guardar el trigger, y no avisa a nadie**. En palabras del propio César: *«el sistema solo te da la URL y ya»* (`BITACORA.md:641-643`). La URL vieja que quedó guardada en Vercel:

- **sigue contestando HTTP 200**, rápido, con las mismas cabeceras;
- **ya no entra a ningún workflow.**

El caso real: el historial de ejecuciones del workflow estaba **vacío** —César: *«Tampoco hay registros»*— mientras el sitio recibía 200 en cada disparo. Quien surte confirmó por su lado: *«Me metí a los pedidos y sí lo marca, pero al WhatsApp no me avisó»*. El sitio registraba, GHL no avisaba (`BITACORA.md:586-599`). La causa se confirmó al comparar la URL guardada contra la que mostraba el trigger ese día: eran distintas (`BITACORA.md:633-643`).

> **Ojo: es "puede", no "siempre".** Pasó el 28/08 (`BITACORA.md:633-643`) y **no** pasó en el guardado posterior de ese mismo día: en `PRUEBA-0004`, ya con el flujo republicado, *«la URL sigue siendo la misma después del último guardado»* (`BITACORA.md:664-665`). Tomarlo como regla determinista manda a error por los dos lados: quien vea la URL igual tras un guardado va a descartar esta causa cuando sigue siendo posible, y quien la dé por regenerada va a redesplegar a ciegas tras cada edición.
>
> **Por eso la regla operativa no es deducirlo, es comprobarlo: después de cada edición del trigger, pide la URL que muestra HOY y compárala contra la que está en Vercel antes de dar nada por bueno.**

### Por qué el código no lo detecta

`emitirEventoGhl` solo mira `res.ok` (`server/utils/ghl.ts:100`). Como GHL **siempre contesta 200**, el emisor reporta éxito siempre. **La ausencia de un warning `[ghl]` en los logs no prueba absolutamente nada sobre si el evento llegó a ejecutarse** (`BITACORA.md:505-508`). Súmale lo de la sección 6 —ni reintento, ni cola, ni registro de entregas— y queda claro por qué aquí no hay nada que mirar del lado del sitio.

### 🚦 La única señal que sirve, y solo en un sentido

El código HTTP no dice nada: GHL contesta 200 a todo. La pista está en el **cuerpo** de la
respuesta, pero **solo sirve en un sentido** (`BITACORA.md:493-513`):

| Respuesta del webhook | Qué significa |
|---|---|
| `{"status":"Success: request sent to trigger execution server","id":"…"}` | Algo **sí** se ejecutó, y ese `id` se puede buscar en el historial de ejecuciones del workflow |
| `{"status":"Success: test request received"}` | **No dice nada.** Ese mismo cuerpo lo devuelve un trigger capturando muestra, una URL muerta **y una cuenta que nunca existió**. No lo uses como diagnóstico |

La prueba que lo desmintió: el 31 de agosto se le pegó a un endpoint con una cuenta inventada y un
id de puros ceros, y contestó `HTTP 200` con ese mismo cuerpo, 43 bytes, mismas cabeceras
(`BITACORA.md:496-503`). **Su presencia informa, su ausencia no** (`BITACORA.md:510-513`).

> ⚠️ **La bitácora trae una tabla vieja que dice lo contrario.** En `BITACORA.md:645-650`, del 28 de
> agosto, `test request received` aparece como «el trigger NO está vivo». Esa tabla quedó desmentida
> tres días después por la prueba de la URL falsa, y el desmentido está en el mismo archivo, más
> arriba. Actuar sobre la tabla vieja ya costó una tarde: con ese razonamiento se le dijo a César que
> su trigger estaba atorado y lo mandaron a moverlo en balde. El problema real era una URL mal
> transcrita desde una captura de pantalla (`BITACORA.md:515-544`).

### Qué hacer cuando "no llegan" los correos o los avisos

Este es el orden que funcionó, y está pensado para no mandar a nadie a mover cosas en balde:

1. **Comprueba tu propia herramienta antes de culpar al servicio del otro.** Ya pasó una vez que la terminal de la máquina estaba colgada —`curl`, `cat` y `git status` también se atoraban— y se reportó como si GHL estuviera colgado. GHL respondía en 0.54 s (`BITACORA.md:841-846`).
2. **Verifica del lado de acá:** que la variable exista en Vercel producción (`vercel env ls production`) y que el despliegue que la incluye ya esté vivo. En Vercel, **una variable nueva solo entra con un despliegue nuevo** (`BITACORA.md:601-604`, `:865-868`).
3. **Dispara una prueba y lee el cuerpo de la respuesta**, no el código HTTP. Aplica el semáforo de arriba. Antes lee la sección 13: cada disparo cuesta.
4. **Si el cuerpo NO trae `request sent to trigger execution server` con su `id`, todavía no sabes nada.** Lo primero que se duda es la propia URL, no el sistema ajeno: pide la que muestra HOY el trigger en GHL, **como texto y nunca leída de una captura de pantalla**, y compárala carácter por carácter contra la que está en Vercel. Así se cerraron los dos incidentes: el del 28 de agosto (la URL había cambiado) y el del 31 (un carácter mal transcrito).
5. **Pide el historial de ejecuciones del workflow.** Si está vacío, el evento no está entrando. Si hay corridas y fallan, el historial dice en qué paso. Ese panel resuelve el caso en una mirada — y hace falta acceso a GHL para verlo (ver sección 18 para cómo conseguirlo).

---

## 11. Otras trampas del módulo

**El aviso a quien surte colgaba de la variable equivocada.** `server/api/mp-webhook.post.ts:161` pregunta hoy por `(ghlConectado('compra_confirmada') || ghlConectado('pedido_para_surtir'))`. Antes preguntaba **solo** por `compra_confirmada`, y dentro de ese `if` vive también la llamada a `avisarPedidoParaSurtir()`. O sea que el aviso operativo colgaba de que estuviera puesta la URL de una automatización de marketing distinta: si se quitara `NUXT_GHL_WEBHOOK_POSTCOMPRA`, o se configurara el aviso antes que el postcompra, **quien surte deja de recibir avisos sin un solo error en los logs**, porque no es un fallo — la función simplemente no se llama (`BITACORA.md:606-619`). El `if` que quedó **solo existe para no pagar consultas a Supabase en balde** cuando no hay nada que mandar: cada emisor ya se auto-protege por su cuenta (`server/api/mp-webhook.post.ts:158-160`). Si agregas un sexto evento a ese bloque, **acuérdate de sumarlo a esa condición**.

**El evento de compra va después del `UPDATE` atómico y solo si ese `UPDATE` ganó la carrera**, para que un reintento de Mercado Pago no dispare el correo dos veces (`server/api/mp-webhook.post.ts:136`, `:143-144`).

**El enlace al panel de pedidos está escrito a mano como `https://amanti.mx/pedidos`** en `server/utils/avisoPedido.ts:69` y `:90`, en vez de salir de `NUXT_PUBLIC_SITE_URL` como en los demás payloads. Si el dominio cambia, ese enlace del WhatsApp se rompe y nadie se va a enterar hasta que alguien lo pique.

**El enlace de reseña apunta al ancla `#resenas` de la ficha.** Hay un test que lo amarra justo para que, si alguien renombra ese ancla, truene en la suite y no en el correo del día 10 (`test/unit/ghl.test.ts:203-208`).

---

## 12. Arranque de cero: las tablas se crean a mano

Esta capa **no tiene migraciones automáticas**. Los `.sql` de `supabase/` se pegan a mano en Supabase → SQL Editor. Está escrito en la cabecera de los propios archivos (`supabase/abandoned-carts.sql:3`, `supabase/all.sql:1-6`) y así se hizo el 27/08: *«SQL corrido hoy: `supabase/orders-envio.sql` y `supabase/resenas-invitado.sql`»* (`BITACORA.md:870`).

Lo que esta capa necesita en la base:

| Archivo | Qué crea | Sin esto |
|---|---|---|
| `supabase/abandoned-carts.sql` | Tabla `abandoned_carts` con `unique (email)`, RLS activo y sin políticas (solo `service_role` escribe) | El candado del carrito entra en el estado roto de la sección 7: **dispara en cada guardado y cobra de más** |
| `supabase/resenas-invitado.sql` | `reviews.user_id` deja de ser obligatorio, se agrega `reviews.order_id` y el índice único parcial `(order_id, product_slug)` | Las reseñas de invitado revientan al insertar y se pueden duplicar |

`supabase/all.sql` trae todo junto y es **idempotente**: se puede correr varias veces sin romper nada, e incluye `abandoned_carts` entre sus bloques (`supabase/all.sql:1-6`).

> ⚠️ **Verifica `abandoned_carts` antes que nada en un entorno nuevo.** En toda la bitácora **no hay un solo registro de que ese SQL se haya corrido** (búsqueda insensible a mayúsculas de `abandoned` sobre `BITACORA.md`: cero coincidencias). No quiere decir que no exista en producción —eso no se puede leer desde el repo—, quiere decir que nadie lo dejó anotado. Y como el fallo no produce ningún error, un entorno sin esa tabla se ve exactamente igual que uno sano hasta que llega la factura de GHL.

---

## 13. Cómo probar sin gastar, y cómo apagar de emergencia

**No hay modo dry-run.** Se buscó en todo el repo y no existe variable de simulación, bandera de prueba ni receptor falso para GHL: si la URL está puesta, `emitirEventoGhl` hace el `fetch` de verdad (`server/utils/ghl.ts:90-99`). Y cada disparo contra un trigger premium **cuesta** (`server/utils/ghl.ts:12-17`, `.env.example:47-49`).

Las palancas que sí existen, todas basadas en la regla 1 (`server/utils/ghl.ts:90-91`):

- **En local, deja las variables `NUXT_GHL_WEBHOOK_*` vacías.** Así vienen en `.env.example:50-56`, y con la variable vacía el emisor devuelve `false` sin tocar la red — hay test que lo comprueba (`test/unit/ghl.test.ts:57-61`). Es la forma normal de trabajar sin gastar.
- **Si necesitas ver el payload real, apunta la variable a un receptor tuyo** (un endpoint propio que imprima el cuerpo). El módulo no valida el dominio: manda a donde diga la variable (`server/utils/ghl.ts:68-70`).
- **La forma de los payloads se prueba sin red**, con la suite de Vitest: `payloadCompra` y `payloadEnvio` son funciones puras y ahí están cubiertas (`test/unit/ghl.test.ts:169-208`, `:293-301`). Para verificar un cambio de contrato, esa es la vía barata.

Cuidados al probar contra producción, aprendidos a golpes:

- Hubo un día en que **no se corrió el script de disparo a propósito**, porque una compra real ya había hecho la prueba sola (`BITACORA.md:596-599`). Si ya hay tráfico real, no dupliques el gasto.
- Un **payload de prueba con campos que producción no manda no prueba nada** sobre producción, y puede contaminar el mapeo del lado de GHL si se manda justo después de que alguien liberó la captura de muestra (`BITACORA.md:570-579`).

> 🚨 **Palanca de emergencia.** Si un workflow empieza a spamear clientes o a quemar disparos, lo único que lo apaga **desde el lado del repo** es **borrar (o vaciar) la variable de ese evento en Vercel y redesplegar**. Con la variable vacía el evento queda muerto y el resto del sitio sigue igual (`server/utils/ghl.ts:90-91`, `.env.example:45`). Ojo con el segundo paso: en Vercel **los cambios de variables solo entran con un despliegue nuevo** (`BITACORA.md:867-868`), así que borrarla y no redesplegar no apaga nada. La otra palanca, más rápida si tienes acceso, es despublicar el workflow del lado de GHL.

---

## 14. Datos personales que salen del sitio hacia GHL

Vale la pena tenerlo escrito porque no es obvio desde el código y porque es el pendiente más grande de esta capa.

**Qué se manda:**

| Evento | Datos personales en el payload |
|---|---|
| `compra_confirmada` | correo, nombre, teléfono, qué compró (`server/utils/ghl.ts:176-199`) |
| `carrito_abandonado` | correo, qué tenía en el carrito (`server/api/cart-save.post.ts:78-84`) |
| `pedido_para_surtir` | correo, teléfono y **el domicilio completo armado en una sola línea** —destinatario, teléfono, calle, colonia, ciudad, estado y C.P.— tanto en `direccion` como dentro de `mensaje` (`server/utils/avisoPedido.ts:47-58`, `:83`, `:89`) |
| `pedido_enviado` | correo, nombre, teléfono, guía, qué compró (`server/utils/ghl.ts:226-247`) |

Y qué se vende: el catálogo es de juguetes sexuales, con entrega discreta. Que el nombre de un producto viaje junto al nombre y el domicilio de una persona no es un dato cualquiera — es el mismo razonamiento por el que las reseñas nunca publican el nombre del envío (`utils/nombreResena.ts:6-16`).

**Lo que el repo dice sobre esto:**

- El aviso de privacidad declara que se recaban identificación, contacto y domicilio de entrega, y que pueden compartirse con «proveedores de tecnología y analítica» (`pages/privacidad.vue:10-11`, `:17-18`). **No nombra a GoHighLevel.**
- Las solicitudes ARCO —acceso, rectificación, cancelación, oposición— se atienden en `nan.cerva@icloud.com` (`pages/privacidad.vue:21`).

**Lo que el repo NO resuelve, y hay que saberlo:**

- **No hay ningún mecanismo en el sitio para borrar un contacto de GHL.** El puente es de una sola dirección: se emiten eventos y no hay ninguna llamada de baja, supresión ni consulta (todo `server/utils/ghl.ts` es `POST` de eventos). Si alguien ejerce cancelación, borrarlo de Supabase **no lo borra de GHL**: eso se hace a mano en el panel de GHL.
- **Tampoco hay retención**: `abandoned_carts` guarda correos y carritos sin fecha de expiración ni proceso de limpieza (`supabase/abandoned-carts.sql:12-21`); no existe job ni endpoint que purgue nada.
- **De quién es la cuenta de GHL, cuánto se queda ahí el dato y bajo qué acuerdo, no se puede saber desde el repo.** La bitácora la trata como la cuenta que opera César, con accesos que se piden por invitación (`BITACORA.md:60-62`), pero la titularidad no está escrita en ninguna parte del código.

**Lo mínimo que hay que preguntar en la entrega:** quién es el titular de la cuenta de GHL, cuánto tiempo viven ahí los datos, y cuál es el procedimiento cuando llegue una solicitud de supresión al correo del aviso de privacidad. Es más grande que el pendiente del Pixel de Meta (sección 16), y a diferencia de aquél no tiene ni siquiera un dueño identificado.

---

## 15. Qué está conectado en producción y qué no

Lo que sigue sale de la bitácora, que registra una revisión contra Vercel hecha el 15/09/2026 (`BITACORA.md:40-45`). **El panel de Vercel no se puede leer desde el repo**, así que esto es el último estado registrado, no una verificación de hoy.

| Variable | Estado registrado | Fuente |
|---|---|---|
| `NUXT_GHL_WEBHOOK_POSTCOMPRA` | **Puesta** en producción | `BITACORA.md:41-43` |
| `NUXT_GHL_WEBHOOK_CARRITO_ABANDONADO` | **Puesta** en producción | `BITACORA.md:41-43` |
| `NUXT_GHL_WEBHOOK_AVISO_PEDIDO` | **Puesta** en producción, sobrescrita con la URL nueva tras la trampa del webhook | `BITACORA.md:41-43`, `:666` |
| `NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` | **NO existe** en producción | `BITACORA.md:41-45` |
| `NUXT_GHL_WEBHOOK_REACTIVACION` | Sin registro de que se haya puesto. Está declarada y mapeada (`server/utils/ghl.ts:39`, `:60`) y `ghlConectado('reactivacion')` la leería, pero **ningún emisor del sitio dispara ese evento** | grep del repo; sin mención en `BITACORA.md` |
| `NUXT_RESENA_SECRET` | Puesta en Vercel el 27/08/2026 | `BITACORA.md:865-868` |
| `NUXT_PEDIDOS_PIN` | Puesta en Vercel el 27/08/2026 | `BITACORA.md:865-868` |

**Consecuencia viva de la fila roja:** el sitio emite `pedido_enviado` y no tiene a dónde mandarlo. El cliente no se entera de que su pedido salió, **mientras `pages/envios.vue:29` se lo sigue prometiendo por escrito**. Es el hueco de esta capa que más urge cerrar: pedir la URL del workflow de aviso de envío, ponerla en Vercel producción y redesplegar.

**Hueco de documentación que te va a morder al montar un entorno nuevo:** `.env.example` documenta las cinco variables de GHL con sus advertencias (`.env.example:43-56`), pero **no menciona `NUXT_RESENA_SECRET` ni `NUXT_PEDIDOS_PIN`** — el archivo termina en la línea 57 y ninguna de las dos aparece. Si copias `.env.example` a `.env` y nada más, las reseñas de invitado quedan apagadas y `/api/pedido-enviado` responde 404 sin que nada te diga por qué.

---

## 16. El formulario de newsletter vive en GHL, no aquí

`components/NewsletterForm.vue` no es un formulario del sitio: es un **iframe del formulario de GHL**, servido desde el subdominio de Amanti en GHL. El id del formulario y la URL del script están en `components/NewsletterForm.vue:26-28`.

Por qué: los correos se recaban directamente en GHL, que es de donde salen los flujos de bienvenida, carrito abandonado, postcompra y la newsletter. Sustituyó a dos puntos de captura que no alimentaban a GHL —el modal que guardaba en la tabla `leads` de Supabase, y un campo en el pie que solo abría un `mailto`—, así que las automatizaciones no tenían de dónde disparar (`components/NewsletterForm.vue:1-11`).

Detalles que parecen arbitrarios y no lo son:

- **El script `form_embed.js` es obligatorio.** El alto que declara el formulario no alcanza para su propio contenido; ese script mide el contenido real y le manda el alto al iframe. Sin él, el botón de enviar queda cortado y **nadie puede suscribirse**. Se carga una sola vez aunque el componente aparezca dos veces en la página (`components/NewsletterForm.vue:12-16`, `:32-38`).
- **El iframe se deja visible desde el principio.** El que manda GHL trae `display:none` y un trigger `showAfter`, pensado para un pop-up que ellos disparan. Aquí el iframe ya vive dentro del modal y del pie, así que si dependiéramos de su script para revelarlo, el hueco se quedaría en blanco (`components/NewsletterForm.vue:18-21`).
- **El formulario no ofrece descuento.** El primero que se montó ofrecía 10% en la primera compra, y ese 10% no existía como cupón en la tienda: quien se suscribiera esperaba algo que no se le podía cobrar (`components/NewsletterForm.vue:22-25`).

`components/WelcomeModal.vue` es solo el envoltorio: aparece una vez, 6 segundos después de aceptar el age-gate, y marca "ya visto" **en cookie y en localStorage a la vez**, porque los navegadores in-app de WhatsApp e Instagram y el modo privado borran localStorage entre visitas y el modal "seguía pidiendo el correo" a gente que ya lo había dado (`components/WelcomeModal.vue:9-21`, `:31-43`).

> ⚠️ **Pendiente de privacidad, del lado de GHL:** el formulario descarga `connect.facebook.net/.../fbevents.js` aunque la persona haya rechazado las cookies. Comprobado contra producción en 4 de 4 cargas con el consentimiento en `rejected`. El sitio no carga ese script por su cuenta y no se observó ninguna petición de evento a Facebook: descarga la librería y no la usa, y el formulario no tiene Pixel asignado. Se le pidió a César apagarlo el 10/09/2026 y quedó pendiente de su lado. **No se arregla desde el repo**: el interruptor está en la configuración del formulario en GHL (`BITACORA.md:67-78`).

---

## 17. Qué cubren las pruebas

| Archivo | Qué amarra |
|---|---|
| `test/unit/ghl.test.ts` | Que cada evento vaya a **su** URL; que nada de este módulo pueda lanzar pase lo que pase con la red; el candado del carrito; la forma exacta de los dos payloads |
| `test/unit/aviso-pedido.test.ts` | Que la dirección salga en una sola línea y sin separadores sueltos, y que un pedido **sin dirección avise fuerte** |
| `test/unit/resena-token.test.ts` | Que una firma inventada, prestada de otro producto o de otro pedido **no pase**, y que sin llave no se acepte ninguna |

Los comentarios de cabecera de esos tres archivos explican qué riesgo cubre cada uno. No son decorativos: `test/unit/ghl.test.ts:1-10` dice literalmente que los dos riesgos son tumbar el webhook de pagos y disparar de más, y que por eso `debeAvisarCarrito` tiene bloque propio.

**Lo que las pruebas NO cubren, y conviene saberlo:** todo lo de este documento que vive en el endpoint y no en el módulo. En particular, **no hay ninguna prueba de `server/api/cart-save.post.ts`**: el candado está probado como función pura, con sus tres entradas dadas a mano (`test/unit/ghl.test.ts:139-167`), pero nadie prueba que el endpoint las calcule bien — que es justo donde está el defecto de la sección 7. Una suite verde no dice nada sobre eso.

Corre la suite con el runner del proyecto (Vitest) antes de tocar cualquier cosa de esta capa.

---

## 18. Lo que no se puede verificar desde el repo (y cómo conseguirlo)

- El estado **actual** de las variables de entorno en el panel de Vercel. La tabla de la sección 15 sale de la bitácora del 15/09/2026, no de una lectura del panel. Se comprueba con `vercel env ls production` teniendo acceso al proyecto.
- Si las tablas `abandoned_carts` y las columnas de `resenas-invitado.sql` existen de verdad en la base de producción. Se comprueba en Supabase → Table Editor. Ver sección 12: **de `abandoned_carts` no hay registro en la bitácora de que se haya corrido nunca.**
- Qué workflows existen hoy dentro de GoHighLevel, cómo están mapeados sus campos, si están publicados y si su historial de ejecuciones tiene corridas.
- Qué URL muestra hoy cada trigger de GHL — que es justo el dato que hace falta para descartar la trampa de la sección 10.
- Si el Pixel de Meta del formulario de newsletter ya se apagó del lado de GHL.
- A qué número manda el workflow el aviso de pedido para surtir, y si de verdad se está entregando.
- El contenido de las plantillas de correo de GHL y qué campos del payload están realmente mapeados en cada una.
- Quién es el titular de la cuenta de GHL, cuánto se retienen ahí los datos personales y cómo se atiende una solicitud de supresión (sección 14).

### Cómo conseguir el acceso a GHL, que es lo que desbloquea la mitad de esta lista

Casi todo lo de arriba se resuelve con una cosa: **acceso al panel de GoHighLevel**. Sin él, el diagnóstico de la sección 10 no se puede cerrar nunca — el paso 5 (mirar el historial de ejecuciones) es el único que da una respuesta definitiva.

Lo que la bitácora registra sobre ese acceso, para que sepas a quién escribirle y con qué expectativa (`BITACORA.md:60-62`):

- **Quien lo da es Emilio.** El 08/09/2026 a las 12:13 p.m. reenvió la invitación: *«Listoo! … el correo que llega es de lead conector o go high level»*.
- **Era la tercera vez que se pedía**, y **no hay constancia posterior de que el acceso haya funcionado**. Dicho de otro modo: pedirlo una vez no ha bastado nunca; cuenta con insistir y con confirmar por tu cuenta que entraste.
- La invitación llega por correo a nombre de **LeadConnector / GoHighLevel**, así que revisa spam.
- **César** es quien arma y publica los workflows del otro lado (`BITACORA.md:8`): es a quien hay que pedirle la URL que muestra hoy un trigger, el historial de ejecuciones y los cambios de plantilla mientras no tengas panel propio.
- **Raúl** es el dueño y quien decide comercialmente (`BITACORA.md:7`); si el acceso se traba, es el escalón de arriba.

> ⚠️ Anotado en la misma sección de la bitácora, y hay que tratarlo como pendiente de seguridad: el 31/08 **la contraseña de `amanti.socialmedia@gmail.com`** —la cuenta que tiene Google Ads, Tag Manager y Merchant Center— **quedó escrita en el grupo de WhatsApp**. Se pidió cambiarla ese mismo día y **no hay constancia de que se haya hecho** (`BITACORA.md:63-65`). No es de GHL, pero es del mismo bloque de accesos que vas a heredar.
