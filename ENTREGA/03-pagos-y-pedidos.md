# El camino del dinero (pagos y pedidos)

Esta sección describe todo lo que pasa entre que alguien agrega un producto al carrito y el pedido queda marcado como pagado y listo para surtir. Es la parte del sistema donde un error cuesta dinero de verdad: cobrar de menos, cobrar de más, cobrar y no poder enviar, o cobrar dos veces.

Todo lo que sigue está verificado leyendo el repo. Lo que no se puede leer desde el repo (qué hay cargado en Vercel, en el panel de Mercado Pago o en Supabase) va marcado como **sin verificar desde el repo**.

---

## 0. Desde el 24 de octubre de 2026: PayPal

A pedido de AMANTI, el botón «Pagar» del carrito ya no manda a Mercado Pago sino a **PayPal** (Checkout Orders v2, cobro inmediato). Mercado Pago sigue en el código y se vuelve a activar con `NUXT_PUBLIC_PASARELA=mercadopago`, sin tocar nada más.

| Archivo | Qué hace |
|---|---|
| `server/api/paypal-checkout.post.ts` | Crea el pedido `pending` y la orden de PayPal (`custom_id` = id del pedido). Devuelve la URL de aprobación |
| `server/api/paypal-return.get.ts` | A donde PayPal regresa al cliente. **Aquí se cobra** (captura) y se marca el pedido; luego manda a `/carrito?status=…` |
| `server/api/paypal-webhook.post.ts` | Respaldo: cobra si el cliente cerró la pestaña después de aprobar, y aplica rechazos y reembolsos. Valida la firma con PayPal y re-consulta la captura antes de tocar nada |
| `server/utils/paypal.ts` | Lo puro: montos en centavos, desglose, dirección, lectura de respuestas, mapeo de estados. Pruebas en `test/unit/paypal.test.ts` |
| `server/utils/paypalPedido.ts` | Captura + marcado del pedido, compartido por el regreso y el webhook |
| `server/utils/pagoConfirmado.ts` | **La autoridad sobre el estado del pedido**, ahora compartida por las dos pasarelas: idempotente, solo hacia adelante, atómica, y el aviso a GoHighLevel |
| `server/utils/comprador.ts` | Correo y nombre del comprador (regla compartida) |
| `supabase/orders-paypal.sql` | Dos columnas opcionales: `paypal_order_id`, `paypal_capture_id` |
| `server/api/keepalive.get.ts` | Toque diario a Supabase (cron de Vercel) para que el plan Free no pause el proyecto |

Variables: `NUXT_PAYPAL_CLIENT_ID`, `NUXT_PAYPAL_CLIENT_SECRET`, `NUXT_PAYPAL_WEBHOOK_ID`, `NUXT_PAYPAL_ENV` (`live`/`sandbox`) y `NUXT_PUBLIC_PASARELA`. Ver la sección 07.

El flujo: carrito → `POST /api/paypal-checkout` → el cliente aprueba en PayPal → `GET /api/paypal-return?order=…&token=…` cobra y redirige a `/carrito?status=success|pending|failure`. El webhook (`CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.*`) llega aparte y termina igual. Lo que sigue describe el camino de Mercado Pago; las reglas de dinero (precios del servidor, cupón re-validado, sin dirección no se cobra, el total cuadra al centavo) son las mismas.

---

## 1. Mapa de archivos

| Archivo | Qué hace |
|---|---|
| `stores/cart.ts` | El carrito en el navegador. Totales de **previsualización**, umbral de envío gratis, armado del mensaje de WhatsApp |
| `pages/carrito.vue` | La pantalla: formulario de envío, cupón, botones de pago, analítica del retorno |
| `server/api/coupon-validate.post.ts` | Valida un cupón para pintarlo en el carrito. No cobra nada |
| `server/api/checkout.post.ts` | Crea el pedido y la preferencia de Mercado Pago. **Aquí se decide cuánto se cobra** |
| `server/utils/orders.ts` | Crea el pedido `pending` + sus renglones. Re-valida el cupón, suma el envío |
| `server/utils/orderItems.ts` | Resuelve precios contra el catálogo del servidor. Rechaza agotados |
| `server/utils/coupons.ts` | Lógica pura de cupones (pura = sin base de datos, por eso es probable) |
| `server/utils/costoEnvio.ts` | Cuánto se cobra de envío y cuándo es gratis |
| `server/utils/envio.ts` | Normaliza y valida la dirección y el correo |
| `server/utils/baseUrl.ts` | De dónde salen las URLs que se le entregan a la pasarela |
| `server/utils/supabaseAdmin.ts` | El cliente de Supabase con `service_role`. **Todo el camino del dinero escribe por aquí** |
| `server/api/mp-webhook.post.ts` | **La autoridad sobre si un pedido está pagado.** Firma, idempotencia, transiciones |
| `server/api/mp-webhook.get.ts` | Solo responde el ping de validación del panel de MP. No procesa nada |
| `server/api/pedidos.get.ts` | El panel de Nancy: lista los pedidos surtibles detrás de un PIN |
| `server/api/pedido-enviado.post.ts` | Marca un pedido como enviado y avisa al cliente. **No toca el estado del pago** |
| `server/api/order-whatsapp.post.ts` | Camino alterno: registra el pedido antes de abrir WhatsApp |
| `server/api/stripe-checkout.post.ts` / `stripe-webhook.post.ts` | Stripe, escrito y apagado detrás de una bandera |

Pruebas relacionadas: `test/unit/orders.test.ts`, `checkout-payer.test.ts`, `costo-envio.test.ts`, `coupons.test.ts`, `envio.test.ts`, `base-url.test.ts` y la parte de envío de `cart.test.ts`. Cómo correrlas, en el punto 17.

---

## 2. El recorrido, de punta a punta

1. **El cliente agrega productos.** `stores/cart.ts` guarda `items` y `gift` en `localStorage` (`stores/cart.ts:166`). El cupón **no** se persiste a propósito: se vuelve a aplicar y a validar cada sesión, para que nunca quede un descuento viejo guardado en el navegador.
2. **Abre `/carrito`.** Al montar se llama `cart.refreshPrices()` (`pages/carrito.vue:83`, `stores/cart.ts:121-126`), que vuelve a leer el precio de cada renglón del catálogo vigente. Sin esto, un carrito guardado hace semanas mostraría un precio y el servidor cobraría otro.
3. **Opcionalmente aplica un cupón.** El navegador llama a `POST /api/coupon-validate` (`pages/carrito.vue:33-38`). Eso es **solo previsualización**: el endpoint no toca `used_count` y no decide nada del cobro.
4. **Llena la dirección de envío.** `pages/carrito.vue:380-396`. Se guarda en `localStorage` bajo `amanti_envio` para que quien regrese no la vuelva a teclear (`pages/carrito.vue:130-141`).
5. **Pica "Pagar".** El navegador frena primero si falta algo (`pages/carrito.vue:166-170`) y luego manda `POST /api/checkout` con los items, el regalo, el código del cupón y la dirección (`pages/carrito.vue:181-189`).
6. **El servidor arma el pedido real.** `createPendingOrder()` resuelve precios, re-valida el cupón, calcula envío y total, e inserta `orders` (estado `pending`) + `order_items` (`server/utils/orders.ts:78-174`, el insert en `:128-154`).
7. **El servidor valida y crea la preferencia de Mercado Pago** con `external_reference = order.id` y `notification_url` apuntando al webhook (`server/api/checkout.post.ts:104-139`), guarda `mp_preference_id` (`:142`) y devuelve el `init_point`.
8. **El cliente paga en Mercado Pago** y regresa a `/carrito?status=success&order=<id>` (`server/api/checkout.post.ts:131`).
9. **Mercado Pago notifica al webhook.** `POST /api/mp-webhook` valida la firma, vuelve a consultar el pago en la API de MP, y **solo entonces** marca el pedido como `paid` (`server/api/mp-webhook.post.ts`).
10. **Se disparan los avisos.** Ya con el pedido pagado, el webhook emite el aviso a quien surte y el evento de postcompra a GoHighLevel (`server/api/mp-webhook.post.ts:161-214`).
11. **Nancy lo surte** desde `/pedidos`, que solo lista pedidos `paid` y `refunded` (`server/api/pedidos.get.ts:30-33`), y al marcarlo enviado se dispara el aviso al cliente (`server/api/pedido-enviado.post.ts`).

Dos ideas sostienen todo el diseño y conviene tenerlas presentes desde ahora:

- **El precio lo decide el servidor, siempre.**
- **El estado del pago lo decide el webhook, nunca el navegador ni la página de retorno.**

---

## 3. Los cuatro estados de un pedido

Es lo primero que se necesita al abrir la tabla `orders` sin contexto. Solo hay cuatro valores de `status` en todo el código, y solo dos archivos los escriben.

| `status` | Qué significa para el negocio | Quién lo escribe | Dónde se ve |
|---|---|---|---|
| `pending` | Pedido creado, **no cobrado**. Es el estado inicial de todo pedido, sin excepción (`server/utils/orders.ts:132`) | `createPendingOrder()`, al insertar | En ninguna pantalla. Solo en Supabase |
| `paid` | Cobrado y confirmado por la pasarela. Es lo único que se surte | El webhook de MP (`mp-webhook.post.ts:131`) o el de Stripe (`stripe-webhook.post.ts:125`) | `/pedidos` |
| `cancelled` | El pago fue rechazado, cancelado o la sesión expiró | Los mismos dos webhooks | En ninguna pantalla |
| `refunded` | Se devolvió el dinero | Los mismos dos webhooks | `/pedidos`, **mezclado con los pagados** (ver punto 12) |

Dos hechos verificados que conviene tener claros:

- **Solo hay dos lugares en todo el servidor que escriben `orders.status`**: `server/api/mp-webhook.post.ts:131` y `server/api/stripe-webhook.post.ts:125`. No existe ninguna pantalla, endpoint ni script para cambiar el estado a mano. Si hace falta corregir un pedido, hoy es entrando a Supabase.
- `POST /api/pedido-enviado` **no toca `status`**: solo escribe `shipped_at` y `tracking` (`server/api/pedido-enviado.post.ts:22-26`). "Enviado" y "pagado" son dos ejes distintos.

---

## 4. Por qué el precio es autoritativo del servidor

El navegador manda `slug`, `name`, `price` y `quantity` (`pages/carrito.vue:184`), pero `resolveItems()` **ignora el `price` del cliente** y toma el del catálogo del servidor por `slug` (`server/utils/orderItems.ts:54-83`). El comentario del archivo lo dice sin rodeos: la fuente de verdad es `data/products.json`, nunca el precio que mande el cliente, y eso es lo que cierra el agujero de manipulación de precios (`server/utils/orderItems.ts:1-3`).

El `name` sí se toma del cliente si viene, porque es cosmético (es un *snapshot* de cómo se llamaba el producto ese día). Solo el **precio** es de seguridad (`server/utils/orderItems.ts:75-77`).

La misma función hace tres cosas más:

- **Coacciona la cantidad** a entero en `[1, 99]` y rechaza cualquier otra cosa con 400 (`server/utils/orderItems.ts:57-61`, tope en `MAX_QTY`, `server/utils/orderItems.ts:35`).
- **Rechaza slugs desconocidos** con 400.
- **Rechaza productos agotados** con 409 (`server/utils/orderItems.ts:67-72`). Esto vive en el servidor y no solo escondiendo el botón en la ficha, porque hay gente con la página abierta desde antes, con el carrito guardado en el navegador, o entrando por el enlace directo de un anuncio. Si el rechazo viviera solo en la vista, esa persona pagaría por algo que no se le puede enviar, y devolver un cobro cuesta más que perder la venta.

**La campaña de descuento se aplica aquí también**, en el mismo lugar del que sale el precio que se cobra (`server/utils/orderItems.ts:18-21`, que llama a `aplicarCampana` de `utils/campana.ts`). Si se aplicara solo en la vista, el cliente vería 40% menos y Mercado Pago le cobraría el precio completo.

Los precios que se cobraron quedan congelados en `order_items` (`server/utils/orderItems.ts:94-103`): si mañana cambia el catálogo, el pedido viejo sigue diciendo lo que de verdad se pagó.

Probado en `test/unit/orders.test.ts:14-20` (ignora el `price` del atacante), `:28-34` (cantidades) y `:57-75` (agotados, incluido el carrito mixto).

### El precio se cambia desplegando, no desde un panel

Esta es probablemente la diferencia más grande con cualquier otra tienda que hayas tocado, y conviene decirla explícito: **el catálogo es un archivo del repositorio**, `data/products.json`, que se importa en tiempo de compilación (`server/utils/orderItems.ts:5`, `stores/cart.ts:2`, `composables/useProducts.ts:1`, `server/routes/feeds/google.xml.get.ts:18`). No hay panel de administración, no hay tabla de productos en Supabase y **ningún endpoint del sitio escribe ese archivo** (verificado: los únicos archivos que lo tocan son scripts locales, `scripts/sync-fotos.mjs`, `scripts/match-fotos.py`, `scripts/gen-inventario.py`).

Consecuencias prácticas:

- Cambiar un precio, marcar un producto como agotado (`"agotado": true`) o dar de alta uno nuevo **exige editar el JSON, hacer commit y desplegar**. No hay forma de hacerlo desde el teléfono ni de pedírselo a alguien que no programe.
- Como el precio se resuelve en el arranque del servidor a partir de ese archivo, hasta que no hay despliegue nuevo el sitio sigue cobrando el precio viejo, aunque el archivo ya esté en `main`.
- El catálogo trae 152 productos a la fecha de corte (`test/smoke/catalog.test.ts:12`).

Las recetas paso a paso están en `10-operacion.md`; el porqué del formato, en `02-catalogo.md`.

---

## 5. El campo `payer`: el botón de pagar que nunca se habilitaba

Esta es la falla más cara que ha tenido el proyecto y explica varias decisiones que si no, parecen paranoia.

**El síntoma:** sin `payer.email` en la preferencia, Mercado Pago pinta el checkout completo —tarjeta, mensualidades, todo— pero **el botón de pagar nunca se habilita**. El cliente llega hasta el final y no puede cerrar la compra, y **no aparece ningún mensaje de error** que lo explique. Está documentado en el encabezado de la función que resuelve el comprador (`server/api/checkout.post.ts:15-27`), con el reporte de Raúl del 26-ago-2026 usando dos tarjetas distintas.

> **Ojo con ese mismo comentario.** Sus líneas 28-31 quedaron desactualizadas y dicen lo contrario al código: afirman que si no hay correo «se manda sin `payer`». No es cierto desde hace tiempo: `datosDelComprador` devuelve `undefined` (`checkout.post.ts:49`) y el handler frena con 400 (`:94-99`). Conviene corregir ese comentario en el primer cambio que se toque ahí, porque manda al lector en dirección opuesta a lo que hace el archivo.

**La consecuencia colateral:** la conversión de compra de Google Ads llevaba marcando cero. No es que no disparara; es que nunca hubo una compra que la disparara.

**La causa raíz:** para un invitado, el correo se leía de `localStorage` bajo la llave `amanti_email`, que escribía el modal de bienvenida. Ese modal se sustituyó por un formulario de GoHighLevel, la llave quedó huérfana y para todo invitado el correo era `null` (`server/api/checkout.post.ts:40-47`). Como hasta ese momento prácticamente todas las compras eran de invitado, prácticamente nadie podía pagar.

**Cómo quedó resuelto.** `datosDelComprador()` (`server/api/checkout.post.ts:33-60`) resuelve el correo en este orden:

1. La sesión de Supabase, si la hay.
2. `body.envio.email` — el correo que el cliente escribió en el formulario del carrito.
3. `body.payer.email`.
4. Si no hay ninguno: devuelve `undefined` y el checkout **se detiene con un 400** antes de mandar al cliente a Mercado Pago (`server/api/checkout.post.ts:94-99`).

Ese último punto es deliberado: es mejor frenar aquí, donde el cliente puede escribir su correo y seguir, que mandarlo a una pared sin mensaje de error.

Detalles que importan y que ya mordieron:

- El correo se valida **en el servidor**, no solo en el navegador, porque un correo mal formado hace que MP rechace la preferencia entera (`server/utils/envio.ts:32-45`). La validación es deliberadamente laxa (`algo@algo.algo`): validar correos "bien" es imposible y rechazar uno bueno cuesta una venta.
- Los campos vacíos **no se mandan**: `payer: {}` es peor que no mandar `payer`, porque MP lo rechaza (`server/api/checkout.post.ts:55-59`).
- El nombre de quien recibe se usa como nombre del pagador, solo el primer nombre, porque MP valida el formato de lo que recibe (`server/api/checkout.post.ts:51-54`).
- El navegador replica el mismo requisito: `envioCompleto` exige correo válido o sesión (`pages/carrito.vue:144-150`), con el comentario que apunta de vuelta al endpoint.

**Probado en `test/unit/checkout-payer.test.ts` (8 casos).** Ojo con el alcance, porque importa: el test **replica la regla en su propia función** `resolverComprador` (`test/unit/checkout-payer.test.ts:24-33`) en vez de importar `datosDelComprador`, porque ese archivo arrastra el runtime de Nuxt. Lo único que importa del repo es `correoValido` (`:15`). O sea que la suite cubre **la regla, no el handler**: un cambio en `checkout.post.ts:48` o en el 400 de `:94-99` **no pone roja esta suite**. La única verificación real de esa ruta es cerrar una compra de invitado de punta a punta.

> **Advertencia.** Si alguien toca el formulario de envío y quita el campo de correo, o cambia el nombre del campo que viaja en `envio.email`, la tienda vuelve exactamente al estado en que nadie podía pagar, **sin un solo error en los logs y sin un solo test en rojo**. Cualquier cambio en ese formulario se prueba cerrando una compra real de invitado de punta a punta.

---

## 6. Sin dirección no se cobra

Antes del 27-ago-2026 el sitio solo guardaba dirección si el cliente tenía cuenta y la había dado de alta en su perfil. Las compras de invitado —la mayoría— se cobraban con `shipping_address` en `null`. Se detectó con tres pedidos pagados ese día: los tres cobrados, ninguno con a dónde enviarse (`server/utils/envio.ts:7-12`).

Hoy:

- `normalizarEnvio()` recorta cada campo a 200 caracteres (es una entrada pública y sin sesión) y **devuelve `null` si falta calle o código postal** (`server/utils/envio.ts:58-74`). Guardar media dirección es peor que no guardar nada, porque parece que el pedido se puede enviar y el error aparece hasta que alguien intenta surtirlo.
- `createPendingOrder()` usa la dirección que el cliente acaba de escribir y, solo si no hay, la predeterminada de su perfil (`server/utils/orders.ts:123-126`). La de este pedido manda sobre la guardada.
- `/api/checkout` **rechaza con 400 si el pedido quedó sin dirección** (`server/api/checkout.post.ts:80-85`). Es mejor frenar donde el cliente puede corregir que después de cobrarle.
- El correo del invitado se guarda **dentro de** `shipping_address` (`server/utils/envio.ts:15-20`), porque `orders` no tiene columna de correo. Ese detalle es load-bearing: el webhook lo lee de ahí para avisarle a GoHighLevel (ver punto 10).

Probado en `test/unit/envio.test.ts:24-73` (dirección completa, sin calle, sin CP, basura, recortes) y `:82-109` (correo).

---

## 7. Pedidos fantasma: lo que deja atrás un checkout frenado

Esto no aparece en ningún lado del código como problema, pero va a confundir al primer dev que cuente pedidos en Supabase, así que se dice aquí explícito.

**El orden de las operaciones en `/api/checkout` es este:**

1. `createPendingOrder()` **inserta el pedido y sus renglones** (`server/api/checkout.post.ts:75`).
2. Recién entonces se valida que haya dirección → 400 (`:80-85`).
3. Recién entonces se resuelve el comprador y se valida el correo → 400 (`:94-99`).
4. Recién entonces se crea la preferencia en Mercado Pago; si eso falla, 502 (`:145-148`).

O sea: **los dos 400 que celebra este documento se lanzan con el pedido ya escrito en la base.** Cada checkout frenado deja un `orders` en `pending` con sus `order_items`, y si traía cupón, con `used_count` ya incrementado (`server/utils/orders.ts:157`). El propio comentario del catch del 502 lo dice: «El order queda 'pending'» (`checkout.post.ts:146`).

Los pedidos `pending` que se acumulan vienen de cinco orígenes distintos:

| Origen | ¿Se va a cobrar algún día? |
|---|---|
| Checkout frenado por falta de dirección o de correo (400) | No |
| Falló la creación de la preferencia en MP (502) | No |
| El cliente llegó a Mercado Pago y nunca pagó | No |
| Pedido de WhatsApp (ver punto 15) | Se cobra fuera del sitio; el estado nunca cambia |
| Pago en OXXO o transferencia, todavía sin liquidar (ver punto 11) | **Sí, y se vuelve `paid` solo** |

**No hay ninguna limpieza ni conciliación.** Verificado: el único `delete` sobre `orders` en todo el servidor es el rollback de `server/utils/orders.ts:151`, que solo corre cuando falla el insert de los renglones. No hay tarea programada, ni endpoint, ni script que borre o caduque pedidos viejos.

> **Advertencia operativa.** `SELECT count(*) FROM orders` **no es el número de ventas**, ni de lejos. Para cualquier cifra de negocio hay que filtrar `status = 'paid'`. Y antes de mover un pedido `pending` de más de unos días, hay que confirmar en el panel de Mercado Pago que no sea un pago en efectivo todavía vivo.

---

## 8. Envío y umbral de envío gratis

Hasta el 27-ago-2026 el carrito decía "Envío: se calcula al pagar" y nunca lo calculaba ni lo sumaba: cada pedido bajo el umbral le costaba el envío a AMANTI (`server/utils/costoEnvio.ts:1-16`).

Cómo funciona hoy:

| Concepto | Dónde vive | Valor |
|---|---|---|
| Umbral de envío gratis | `server/utils/costoEnvio.ts:19` y `stores/cart.ts:9` | `1000` (MXN), en código |
| Cuánto se cobra de envío (servidor, **autoritativo**) | variable `NUXT_ENVIO_COSTO` (`server/utils/costoEnvio.ts:23`) | ver `07-variables-de-entorno.md` |
| Cuánto se cobra de envío (navegador, solo pinta) | variable `NUXT_PUBLIC_ENVIO_COSTO` (`nuxt.config.ts:121-125`) | ver `07-variables-de-entorno.md` |

El monto **no vive en el código a propósito**: es una decisión comercial de Raúl y Nancy, y cuando la muevan debe bastar con cambiar la variable en Vercel, sin desplegar y sin depender de un programador (`server/utils/costoEnvio.ts:9-12`). Con la variable vacía o en cero el envío sale gratis para todos, que es como estaba el sitio antes; así, encender el cobro es una decisión explícita y no un efecto secundario de desplegar.

`calcularEnvio()` (`server/utils/costoEnvio.ts:35-45`) tiene tres reglas que vale la pena entender:

- **Siempre pesos enteros.** Un cargo de "$99.60" se ve a error, obliga a explicarlo, y además MP suma centavos por su cuenta y el total del pedido dejaría de cuadrar con el de la preferencia.
- **Gratis desde el umbral inclusive** (`>=`): con subtotal exactamente de $1,000 ya es gratis.
- **Ante una entrada inválida, se cobra** (`server/utils/costoEnvio.ts:41-43`). Equivocarse hacia "gratis" cuesta dinero en cada pedido y no se nota hasta el corte del mes.

### Por qué el umbral se mide DESPUÉS del cupón

Es la decisión menos obvia de esta sección y es la que más dinero mueve. En `server/utils/orders.ts:112-117`:

```
subtotalConDescuento = subtotal − descuento
envioCosto           = calcularEnvio(subtotalConDescuento)
total                = subtotalConDescuento + envioCosto
```

El envío se suma **después** del descuento porque el umbral tiene que medirse sobre lo que el cliente **realmente paga de producto**. Si se midiera sobre el subtotal antes del cupón, alguien con un cupón grande cruzaría los $1,000 sin haber pagado esa cantidad y se llevaría el envío de regalo: una compra de $1,200 con cupón de $300 paga $900 y sí debe pagar envío.

El navegador usa **exactamente el mismo criterio** (`stores/cart.ts:56-70`: `freeShipping` compara `totalWithDiscount`, no `totalPrice`). Tiene que ser el mismo o el cliente vería un total en el carrito y pagaría otro en Mercado Pago.

Probado en `test/unit/costo-envio.test.ts:34-39` (el caso de los $900) y en `test/unit/cart.test.ts:118-139` del lado del carrito.

### El envío viaja como su propio renglón en la preferencia

En `server/api/checkout.post.ts:118-125`, la suma de los renglones que se le mandan a MP **debe dar exactamente `order.total`**, o MP cobra distinto de lo que dice el pedido guardado. Por eso el envío va como renglón propio: si se omite, se cobra de menos en cada compra bajo el umbral. Stripe hace lo mismo (`server/api/stripe-checkout.post.ts:69-79`).

Y cuando hay cupón se manda **un solo renglón** con el total ya con descuento, en vez de un renglón negativo, porque MP y Stripe rechazan importes menores o iguales a cero (`server/api/checkout.post.ts:110-117`). El desglose por producto no se pierde: vive en `order_items`, ligado por `external_reference`.

> **Advertencia.** `NUXT_ENVIO_COSTO` (servidor) y `NUXT_PUBLIC_ENVIO_COSTO` (navegador) son **dos variables distintas y deben tener el mismo valor** (`nuxt.config.ts:121-125`). Si difieren, el carrito muestra un total y la pasarela cobra otro: el cliente se entera al final y es la clase de sorpresa que genera contracargos. Cámbialas siempre juntas.

> **Trampa menor pero visible.** En `pages/carrito.vue:13` la barra de progreso de envío gratis (`freePct`) se calcula sobre `cart.totalPrice` (**antes** del cupón), mientras que el mensaje de "te faltan $X" usa el faltante después del cupón (`pages/carrito.vue:12`, `stores/cart.ts:68-70`). Con cupón aplicado la barra puede verse llena mientras el texto sigue diciendo que falta dinero. Es cosmético —el cobro es correcto—, pero confunde y conviene emparejarlo.

---

## 9. Cupones

### Cómo se validan

La lógica es pura y vive en `server/utils/coupons.ts`, sin Supabase ni auto-imports de Nuxt, justamente para poder probarla. Una fila de `public.coupons` trae `code`, `type` (`percent` o `fixed`), `value`, `min_subtotal`, `active`, `expires_at`, `max_uses` y `used_count` (`server/utils/coupons.ts:9-18`).

`validateCoupon()` (`server/utils/coupons.ts:52-83`) rechaza, en este orden: campaña activa, cupón inexistente, inactivo, expirado, agotado por `max_uses`, subtotal por debajo del mínimo, y descuento que daría cero. `computeDiscount()` acota el descuento a `[0, subtotal]` (`server/utils/coupons.ts:41-46`), así que un cupón de $1,500 sobre una compra de $1,000 descuenta $1,000, no más.

**La validación ocurre dos veces, y solo la segunda cuenta:**

1. `POST /api/coupon-validate` para pintar el carrito. No toca `used_count` (`server/api/coupon-validate.post.ts:1-4`). Existe porque el cliente **no puede leer `public.coupons` directamente** (RLS sin políticas públicas), así que el endpoint consulta con la llave de servicio.
2. Dentro de `createPendingOrder()`, contra el subtotal **real** resuelto en el servidor (`server/utils/orders.ts:96-110`). Si el código viene pero es inválido, el pedido se rechaza con 400 y el mensaje del validador.

El carrito además limpia el cupón ante **cualquier** cambio del carrito (`stores/cart.ts:88`, `:93`, `:102`), para que el `discount` guardado siempre corresponda al subtotal vigente.

Si el descuento deja el total en cero o menos, el pedido se rechaza con un mensaje explícito (`server/utils/orders.ts:118-120`).

### Por qué el servidor los rechaza hoy

Hay una campaña global encendida: 40% en todo el catálogo (`utils/campana.ts:42-47`). Mientras esté encendida:

- `CUPONES_ACEPTADOS` vale `false` (`utils/campana.ts:138`) y es el valor por omisión del cuarto parámetro de `validateCoupon` (`server/utils/coupons.ts:56`). **El servidor rechaza cualquier cupón**, aunque exista y esté vigente en Supabase, con el mensaje "Durante AMANTI sin filtros el descuento ya viene aplicado en cada precio, no se acumulan cupones" (`server/utils/coupons.ts:61-67`).
- El carrito **ni siquiera ofrece el campo** de cupón (`pages/carrito.vue:351`), y los banners de promoción están apagados vía `MOSTRAR_CUPONES` (`utils/campana.ts:131`, `pages/carrito.vue:286`).

La razón es aritmética: el catálogo ya viene rebajado 40%, y un `AMANTI15` encima dejaría la venta en 49% de descuento sin que nadie lo haya decidido.

> **Advertencia.** Esto está **acoplado**: el día que alguien ponga `CAMPANA.activa = false` (la fecha acordada es el 30 de septiembre de 2026, ver `01-panorama.md` y `02-catalogo.md`), **los cupones se vuelven a aceptar solos**, en el mismo despliegue, sin que nadie lo pida. Antes de apagar la campaña, revisa qué cupones siguen `active` en `public.coupons` y decide cuáles deben seguir vivos. *Qué filas existen hoy en esa tabla: sin verificar desde el repo.*

> **Advertencia.** `used_count` se incrementa **al crear el pedido `pending`**, no al pagarlo (`server/utils/orders.ts:157` → `incrementCouponUsage`, `server/utils/orders.ts:47-67`). Un cupón con `max_uses` se agota con checkouts que el cliente abandonó sin pagar, con los checkouts frenados por los 400 del punto 7, y con pedidos de WhatsApp que quizá nunca se cierren. El incremento usa compare-and-set con reintentos para no perder cuentas bajo carrera, y nunca lanza: el pedido ya está creado y no debe fallar por un contador.

Probado en `test/unit/coupons.test.ts` (normalización, percent/fixed, acotado, inactivo, expirado, agotado, mínimo).

---

## 10. El webhook de Mercado Pago

`server/api/mp-webhook.post.ts` es **la única autoridad sobre si un pedido está pagado**. Ni la página de retorno ni el navegador cambian estado; solo este handler y el de Stripe escriben `orders.status` (verificado: son los dos únicos `update({ status: ... })` del servidor).

### Qué NO se confía del payload

Nada. Del cuerpo de la notificación solo se toma el **id del pago**, y con ese id **se vuelve a consultar el pago real** en la API de Mercado Pago para leer su `status` y su `external_reference` (`server/api/mp-webhook.post.ts:82-97`). Aunque alguien mande una notificación falsa diciendo "aprobado", el servidor va a preguntarle a MP y MP va a decir la verdad.

Si la consulta devuelve 404, la notificación se ignora; cualquier otro error devuelve 502 para que MP reintente.

### Validación de la firma

Defensa en profundidad, además de la re-consulta (`server/api/mp-webhook.post.ts:63-80`):

- Lee el encabezado `x-signature` (formato `ts=...,v1=...`) y `x-request-id`.
- Arma el manifiesto `id:<data.id>;request-id:<id>;ts:<ts>;` con el `data.id` **del query string** (`server/api/mp-webhook.post.ts:73`). Así lo firma MP. Hay un respaldo al `data.id` del **cuerpo** si el query viniera sin él; MP siempre lo manda en el query, pero conviene saber que ese respaldo existe si alguna vez se endurece la validación.
- Calcula HMAC-SHA256 con el secreto y compara con `timingSafeEqual`, comparando primero longitudes (`server/api/mp-webhook.post.ts:75-79`). Si no cuadra: 401.

El secreto sale de la variable `NUXT_MP_WEBHOOK_SECRET` (`nuxt.config.ts:91-92`), que se copia del panel de MP al registrar el webhook.

> **Advertencia.** La validación de firma está condicionada a que **haya** secreto: `if (secret && !isTest)` (`server/api/mp-webhook.post.ts:66`). **Si la variable no está cargada, la firma no se valida y no hay ningún aviso en los logs.** La re-consulta a la API de MP sigue siendo la defensa real —no se puede falsificar un pago—, pero el endpoint queda abierto a que cualquiera lo invoque. Si está cargada hoy en producción: en `07-variables-de-entorno.md`.

Hay un **modo de prueba** que salta la firma y la re-consulta, pero solo se activa con cuatro condiciones a la vez: `NODE_ENV !== 'production'`, la variable `MP_WEBHOOK_TEST_MODE` presente, que el llamador mande ese mismo secreto compartido en `body.__test_secret`, y que mande un `body.__test_payment` (`server/api/mp-webhook.post.ts:54-61`). Es imposible de activar en un despliegue de producción. Cómo usarlo en local: punto 17.

### Idempotencia y transiciones solo hacia adelante

Mercado Pago **reintenta** las notificaciones y puede entregar la misma más de una vez, incluso en paralelo. El handler se defiende en cuatro capas:

1. **Mapeo conservador de estados** (`server/api/mp-webhook.post.ts:20-29`): `approved → paid`, `rejected`/`cancelled → cancelled`, `refunded`/`charged_back → refunded`. Cualquier otro (`pending`, `in_process`, `authorized`) **no cambia nada** (ver punto 11).
2. **Cortocircuito idempotente**: si el pedido ya está en el estado destino, devuelve `{ ok: true, idempotent: true }` sin escribir (`server/api/mp-webhook.post.ts:110`).
3. **Transiciones permitidas** (`server/api/mp-webhook.post.ts:31-40`):

   | Estado destino | Solo desde | Por qué |
   |---|---|---|
   | `paid` | `pending`, `cancelled` | Un reintento aprobado en la misma preferencia puede llegar tras un primer intento rechazado |
   | `cancelled` | `pending` | **Un `rejected` tardío nunca debe revertir un pago confirmado** |
   | `refunded` | `paid` | Solo se reembolsa lo que se cobró |

4. **UPDATE atómico**: el `update` lleva `.in('status', allowedPrev)` (`server/api/mp-webhook.post.ts:129-136`), de modo que si dos entregas concurrentes llegan al mismo tiempo, **solo una escribe**. La que pierde recibe cero filas y devuelve `idempotent`. Esto cierra el hueco entre leer el estado y escribirlo (TOCTOU); sin esa cláusula, las dos pasarían la revisión del paso 3 y las dos escribirían.

Hay además una **salvaguarda contra pedidos huérfanos**: nunca se marca `paid` un pedido sin renglones en `order_items` (`server/api/mp-webhook.post.ts:118-125`). Puede pasar si el insert de items falló y el rollback no alcanzó a borrar el pedido (`server/utils/orders.ts:147-154`).

### Lo que pasa después de marcar pagado

Todo el bloque de avisos cuelga de dos condiciones, no de una: que el UPDATE haya **ganado** la carrera, que el estado nuevo sea `paid`, **y** que haya **al menos una** de las dos URLs de GoHighLevel cargadas — `ghlConectado('compra_confirmada') || ghlConectado('pedido_para_surtir')` (`server/api/mp-webhook.post.ts:161`), que leen `NUXT_GHL_WEBHOOK_POSTCOMPRA` y `NUXT_GHL_WEBHOOK_AVISO_PEDIDO` (`server/utils/ghl.ts:57-63`).

> **Advertencia.** Sin ninguna de esas dos variables, el pedido se marca pagado y **nadie se entera**: ni quien surte, ni el workflow de postcompra. **Sin un solo error en los logs**, porque no es un error: el `if` simplemente no entra. Es exactamente la clase de falla silenciosa que `00-LEEME-PRIMERO.md` (punto 4) reporta ya ocurrida para el aviso de envío al cliente. Confírmalas en `07-variables-de-entorno.md` y en `04-automatizaciones-ghl.md`.

Cuando sí corre, dispara dos cosas distintas (`server/api/mp-webhook.post.ts:161-214`):

- **El aviso a quien surte** (`avisarPedidoParaSurtir`, `server/utils/avisoPedido.ts:77-92`): un mensaje corto con artículos y la dirección ya formateada en una sola línea para pegarla en la guía, que llega a Nancy por WhatsApp a través de un workflow de GoHighLevel.
- **El evento de marketing** `compra_confirmada` a GoHighLevel (`server/utils/ghl.ts:86-110`), que dispara el correo de postcompra, la petición de reseña del día 10 y el cross-selling del 21, y saca al cliente de la secuencia de carrito abandonado.

Tres decisiones aquí tienen historia:

- **Van después del UPDATE atómico** para que un reintento de MP no mande el correo dos veces.
- **Son dos cosas separadas, con dos variables distintas y dos destinatarios distintos.** Antes el bloque entero colgaba de que la URL de postcompra estuviera configurada, así que si esa faltaba, Nancy **no recibía su aviso** aunque su propia URL sí estuviera, y sin ruido en los logs porque no era un error: simplemente nunca se llamaba (`server/api/mp-webhook.post.ts:150-160`). Hoy cada emisor se auto-protege por su cuenta (`server/utils/ghl.ts:90-91`, `server/utils/avisoPedido.ts:78`) y el `if` de arriba solo sirve para no pagar en balde las consultas a Supabase.
- **Todo va envuelto en `try/catch` y sin esperar respuesta.** Si GoHighLevel falla, el pedido ya quedó pagado y el handler devuelve `ok` igual. Un correo que no sale se arregla; un pago que MP reintenta porque le devolvimos un 500 es mucho peor (`server/utils/ghl.ts:19-31`).

**De dónde sale el correo del comprador** (`server/api/mp-webhook.post.ts:167-182`): si el pedido trae `user_id`, del usuario de Supabase; si es de invitado, del que la persona tecleó en el carrito y que quedó guardado **dentro de `shipping_address`**. Ese respaldo es lo que faltaba: antes solo se miraba `user_id`, y como todos los pedidos eran de invitado, GoHighLevel recibía `email: null` en cada compra y el workflow de postcompra no tenía a dónde mandar el comprobante. Un cliente pagó el 29-ago-2026, no le llegó nada, y volvió a levantar el mismo pedido dos veces en los dos minutos siguientes: sin acuse, quien ya pagó cree que no pagó, y el siguiente clic es pagar otra vez.

### El GET del webhook

`server/api/mp-webhook.get.ts` existe por una razón muy concreta: al registrar la URL, el panel de MP la valida con un GET tipo IPN clásico y marca la prueba como fallida si no recibe 2xx. Por el sufijo `.post.ts`, Nitro no registra la ruta para GET, así que MP recibía 404 y no dejaba avanzar el registro.

**A propósito no procesa nada.** Un GET tiene que ser seguro e idempotente: si ahí se actualizaran pedidos, bastaría con que alguien abriera un enlace —o con que un rastreador lo siguiera— para disparar el flujo de pagos.

---

## 11. Pagos en efectivo, OXXO y el estado `pending`

El carrito anuncia OXXO y meses sin intereses entre los métodos aceptados (`pages/carrito.vue:419`), y aclara que se eligen dentro de Mercado Pago (`pages/carrito.vue:424`). Es un caso real de este negocio y conviene saber exactamente qué hace el sitio con él.

Un pago en efectivo **nace `pending`** y puede quedarse así horas o días, hasta que la persona va a la tienda. Mientras tanto:

- Mercado Pago **sí manda notificaciones** de ese pago, pero `mapStatus` devuelve `null` para `pending`, `in_process` y `authorized` (`server/api/mp-webhook.post.ts:20-29`), así que el handler responde `{ ok: true, noChange: true }` (`:102`) y **no escribe nada**.
- El pedido sigue en `pending`, o sea: **no aparece en `/pedidos`** (`server/api/pedidos.get.ts:30-33`) y **no se dispara ningún aviso**, porque todo el bloque de GHL exige `newStatus === 'paid'` (`server/api/mp-webhook.post.ts:161`).
- Al cliente lo mandan de vuelta a `/carrito?status=pending` (`server/api/checkout.post.ts:133`), donde ve el mensaje "Tu pago está pendiente de confirmación" (`pages/carrito.vue:293`).

Cuando la persona paga en la tienda, MP manda una notificación nueva con el pago ya `approved`, y ahí sí corre todo el camino normal: se marca `paid`, aparece en `/pedidos` y salen los avisos. **No hay que hacer nada a mano.**

Lo que sí hay que saber:

- Un pedido en `pending` puede ser basura (punto 7) **o** un pago en efectivo todavía vivo. Desde la base de datos no se distinguen. La forma de saberlo es buscar el pedido en el panel de Mercado Pago (punto 13).
- El tiempo entre "el cliente decidió comprar" y "Nancy se entera" puede ser de días. Si alguien pregunta por qué un pedido no aparece, esta es la primera hipótesis a descartar.

---

## 12. Reembolsos

**Los reembolsos no se originan en el sitio.** No hay pantalla, endpoint ni script que devuelva dinero: se hacen desde el panel de Mercado Pago. Lo único que hace el sitio es enterarse.

Cuando MP notifica un pago con `status` `refunded` o `charged_back`, el webhook lo mapea a `refunded` (`server/api/mp-webhook.post.ts:25-26`) y solo lo aplica si el pedido estaba en `paid` (`ALLOWED_PREV`, `:39`). A partir de ahí, tres cosas que sorprenden:

1. **Nadie se entera.** El bloque de avisos exige `newStatus === 'paid'` (`server/api/mp-webhook.post.ts:161`), así que un reembolso no dispara nada: ni aviso a quien surte, ni evento a GoHighLevel. Si el paquete ya iba en camino, hay que pararlo por fuera del sistema.
2. **No devuelve el uso del cupón ni toca inventario.** `incrementCouponUsage` solo suma (`server/utils/orders.ts:47-67`); no hay ninguna función que reste. Y no hay inventario que reponer: el "agotado" es una bandera manual en `data/products.json` (`server/utils/orderItems.ts:27-32`), no un conteo.
3. **`/pedidos` lo sigue listando.** El filtro es `.in('status', ['paid', 'refunded'])` (`server/api/pedidos.get.ts:32`), y la pantalla **nunca pinta el `status`**: verificado, `pages/pedidos.vue` solo usa `shipped_at`, `tracking` y `sinDireccion` (`pages/pedidos.vue:47`, `:124`, `:141`, `:167-172`). Tampoco `POST /api/pedido-enviado` revisa el estado antes de marcar enviado (`server/api/pedido-enviado.post.ts:22-26`).

> **Advertencia.** Un pedido reembolsado **se ve idéntico a uno pagado** en la pantalla de Nancy, y se puede marcar como enviado sin que nada proteste. Hasta que eso se arregle, todo reembolso hay que avisarlo por fuera. Está anotado como pendiente en `12-pendientes-y-riesgos.md`.

---

## 13. Cómo encontrar un pedido en Mercado Pago (y al revés)

Cuando un cliente reclama, hay que poder cruzar lo que dice Supabase con lo que dice el panel de MP. Los tres identificadores son estos:

| Columna / campo | Quién lo escribe | Para qué sirve |
|---|---|---|
| `orders.id` → `external_reference` de la preferencia | `server/api/checkout.post.ts:126` | **De MP hacia el pedido.** El webhook resuelve el pedido leyendo `payment.external_reference` (`mp-webhook.post.ts:99`) |
| `orders.mp_preference_id` | `server/api/checkout.post.ts:142` | Del pedido hacia la **preferencia** (el intento de cobro), aunque nunca se haya pagado |
| `orders.mp_payment_id` | El webhook, junto con el estado (`mp-webhook.post.ts:131`) | Del pedido hacia el **pago** concreto en MP. Solo existe si hubo notificación procesada |

Cómo se usan en la práctica:

- **"Pagué y no me llegó nada"**: busca el pedido por `id` en `orders`. Si tiene `mp_payment_id`, el webhook sí corrió y el problema está río abajo (GHL, correo). Si está `pending` y **sin** `mp_payment_id`, el webhook nunca llegó: revisa el punto 14 y el panel de MP con el `mp_preference_id`.
- **Tienes un pago en el panel de MP y no sabes de quién es**: su `external_reference` **es** el `orders.id`.
- **El equivalente de Stripe** son `stripe_session_id` (`stripe-checkout.post.ts:91`) y `stripe_payment_intent_id` (`stripe-webhook.post.ts:135`), ambos best-effort (ver punto 18).

---

## 14. La URL que se le entrega a la pasarela

`baseParaPasarela()` (`server/utils/baseUrl.ts:26-35`) decide de dónde salen `notification_url` y `back_urls`. Merece archivo y pruebas propias por lo que cuesta equivocarse.

El respaldo de `NUXT_PUBLIC_PUBLIC_BASE_URL` en `nuxt.config.ts:118` es `http://localhost:3000`, y está bien que lo sea para desarrollo. El problema es qué pasa si esa variable **falta** en producción: alguien la borra, un entorno nuevo, un despliegue de vista previa sin ella. Ese respaldo tomaría el control y el sitio le diría a Mercado Pago que mande las notificaciones de pago a `localhost`.

Lo que eso cuesta: **el cobro sí se hace, pero el webhook no llega nunca.** Los pedidos se quedan en `pending` para siempre, nadie los marca como pagados, GoHighLevel no se entera, quien surte no sabe que hay algo que enviar, y el cliente que ya pagó aterriza en una página muerta. Todo eso **sin un solo error en ningún lado**.

La regla: corriendo en Vercel (`process.env.VERCEL` existe), un `localhost` se trata como configuración rota y se usa el dominio público del sitio (`NUXT_PUBLIC_SITE_URL`). En local no cambia absolutamente nada. Si tampoco hay dominio público con qué sustituir, se deja lo que venía, porque una cadena vacía rompería la preferencia de una forma más difícil de diagnosticar.

Probado en `test/unit/base-url.test.ts`, incluyendo que un dominio que solo *contiene* la palabra (`localhost.midominio.mx`) no se confunda con local.

---

## 15. El pedido por WhatsApp

Es el camino alterno para quien no quiere pagar en línea, y sigue siendo importante en este negocio.

Cuando el cliente pica "Ordenar por WhatsApp" (`pages/carrito.vue:229-253`):

1. Se abre una ventana en blanco **dentro del gesto del clic**, para que el navegador no la bloquee.
2. Se llama a `POST /api/order-whatsapp`, que crea un pedido `pending` con `payment_method = 'whatsapp'` usando el mismo `createPendingOrder()` (`server/api/order-whatsapp.post.ts:19`). Mismos precios autoritativos, mismo cupón re-validado.
3. Se redirige esa ventana al enlace `wa.me` armado en `stores/cart.ts:129-161`.

Diferencias con el pago con tarjeta, y su porqué:

- **La dirección es opcional aquí** (`server/api/order-whatsapp.post.ts:16-18`): quien ordena por WhatsApp la da en la conversación. Pero si ya la escribió en el carrito, se guarda, para ahorrarle a Nancy tener que pedirla otra vez.
- **Degrada con gracia**: si el registro del pedido falla, se abre WhatsApp de todos modos (`pages/carrito.vue:247-250`). La venta no se pierde por un problema de base de datos.
- **El mensaje desglosa el envío con la misma variable que usa el servidor** (`stores/cart.ts:136-148`). El mensaje y el pedido guardado son la misma venta: si el mensaje dijera un total y en la pantalla de Nancy apareciera otro, alguien acaba cobrando de menos.
- Si la visita vino de un anuncio, la referencia del clic viaja dentro del texto (`stores/cart.ts:157-159`): es la única forma de que Google Ads atribuya un pedido cerrado por chat.

> **Advertencia.** Un pedido de WhatsApp **se queda en `pending` para siempre**. No hay webhook que lo mueva y no existe ninguna pantalla para marcarlo pagado a mano: los únicos dos lugares del código que escriben `orders.status` son los dos webhooks. Como `/pedidos` solo lista `paid` y `refunded` (`server/api/pedidos.get.ts:30-33`), **los pedidos de WhatsApp nunca aparecen en el panel de Nancy**. Hoy funcionan porque la conversación de WhatsApp es el registro real; si en algún momento se quiere contabilizarlos, hace falta o un cambio en ese filtro o una acción manual de "marcar pagado". Está anotado como pendiente en `12-pendientes-y-riesgos.md`.

---

## 16. Qué se necesita para que esto funcione siquiera

Antes de depurar nada, revisa que estas cuatro cosas estén puestas. Sin ellas el camino del dinero no arranca, y los síntomas no siempre apuntan a la causa. El inventario completo está en `07-variables-de-entorno.md`; aquí van solo las que bloquean este flujo.

| Variable | Sin ella | Verificado en |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | **No se crea ningún pedido.** Todo el camino escribe con `supabaseAdmin()`, que lanza un 500 explícito si falta | `server/utils/supabaseAdmin.ts:12-19` |
| `NUXT_MP_ACCESS_TOKEN` | `/api/checkout` devuelve 400 **antes de tocar la base**; y el webhook no puede re-consultar el pago (400 en `mp-webhook.post.ts:87`) | `server/api/checkout.post.ts:65-67` |
| `NUXT_PEDIDOS_PIN` | **`/pedidos` y `/api/pedido-enviado` quedan en 404**, no abiertos. Es el panel donde Nancy surte | `server/api/pedidos.get.ts:17-18`, `server/api/pedido-enviado.post.ts:11-12` |
| `NUXT_PUBLIC_PUBLIC_BASE_URL` | Ver punto 14: se cobra y el webhook nunca llega | `nuxt.config.ts:118`, `server/utils/baseUrl.ts` |

Que el 404 de `/pedidos` sea deliberado vale la pena entenderlo: esa pantalla expone nombre, teléfono y domicilio de clientes, y **un descuido de configuración no puede terminar publicando domicilios** (`server/api/pedidos.get.ts:6-12`). Por eso sin PIN el endpoint se apaga en vez de quedar abierto. El PIN no es autenticación de verdad; el día que haya más de una persona surtiendo, esto debe pasar a cuentas con rol.

---

## 17. Cómo probar el camino del pago sin cobrarle a nadie

### Las pruebas unitarias

El proyecto corre con Vitest. Las suites que cita esta sección:

```
npm run test:unit                       # todas (equivale a: vitest run)
npx vitest run test/unit/orders.test.ts test/unit/coupons.test.ts
npx vitest run test/unit/costo-envio.test.ts test/unit/envio.test.ts
npx vitest run test/unit/checkout-payer.test.ts test/unit/base-url.test.ts
```

Los scripts están en `package.json:11-13`. El paquete completo de pruebas —incluidas las de navegador, que se corren aparte— está en `09-pruebas.md`. Recuerda lo del punto 5: estas suites cubren **reglas**, no handlers; ninguna de ellas levanta el servidor ni toca Supabase.

### Ejercitar el webhook sin Mercado Pago

`mp-webhook.post.ts` trae un modo de prueba pensado exactamente para esto: permite simular una notificación de pago sin firma y sin re-consulta a MP. Necesita las cuatro condiciones de `server/api/mp-webhook.post.ts:54-61`:

1. `NODE_ENV` distinto de `production` (o sea, `npm run dev`, nunca un despliegue).
2. La variable de entorno `MP_WEBHOOK_TEST_MODE` con un valor cualquiera, que hace de secreto compartido.
3. En el cuerpo del POST, `__test_secret` con **ese mismo valor**.
4. En el cuerpo del POST, `__test_payment` con el objeto de pago simulado — mínimo `status` (el que quieras mapear) y `external_reference` (el `id` de un pedido real en tu base), más `id` para que se guarde como `mp_payment_id`.

El cuerpo también necesita `type: 'payment'` y un `data.id`, o el handler descarta la notificación antes de llegar al modo de prueba (`:49-52`).

Con eso puedes recorrer de verdad la parte cara: la idempotencia, las transiciones prohibidas, la salvaguarda del pedido sin renglones y el bloque de avisos. **Es imposible de activar en producción** por la condición 1, así que no hay riesgo de dejarlo encendido por error.

Para Stripe el equivalente es `stripe listen --forward-to localhost:3000/api/stripe-webhook` (`server/api/stripe-webhook.post.ts:14`).

### El doble clic en "Pagar"

> **Advertencia.** **`/api/checkout` no es idempotente.** Cada llamada crea un pedido nuevo e incrementa `used_count` otra vez: no hay llave de idempotencia, no se reutiliza una preferencia existente y no se busca si ya hay un `pending` equivalente. Contrasta con el cuidado que se puso en la idempotencia del webhook (punto 10), y es deliberado solo en el sentido de que nadie lo ha resuelto.
>
> Hoy lo tapa el botón, que se deshabilita mientras corre la petición (`pages/carrito.vue:427`), pero eso no cubre recargar la página, volver atrás desde Mercado Pago y reintentar, ni llamar al endpoint directo. En la práctica se ve como pedidos `pending` duplicados con el mismo carrito y segundos de diferencia; si traían cupón, gastaron dos usos. Si algún día se pone un `max_uses` apretado, esto va a doler.

---

## 18. Stripe: escrito, apagado detrás de una bandera

Existe un segundo camino de pago con tarjeta, completo y funcional en código, **apagado**.

**Cómo está apagado.** El botón "Pagar con tarjeta" solo se pinta si `NUXT_PUBLIC_STRIPE_ENABLED` tiene valor (`pages/carrito.vue:20` y `:430`, declarada en `nuxt.config.ts:119-120`). Además, los endpoints devuelven 400 si falta la llave secreta (`server/api/stripe-checkout.post.ts:17-20`) y el webhook devuelve 400 si falta el secreto de firma (`server/api/stripe-webhook.post.ts:67`). O sea: hay tres cosas que tendrían que estar puestas para que cobre.

**Qué tan terminado está.** Espeja el patrón de Mercado Pago pieza por pieza:

| Pieza | Mercado Pago | Stripe |
|---|---|---|
| Precio autoritativo del servidor | sí | sí, mismo `createPendingOrder()` |
| Rechaza pedido sin dirección | `checkout.post.ts:80` | `stripe-checkout.post.ts:32-37` |
| Envío como renglón propio | `checkout.post.ts:122` | `stripe-checkout.post.ts:73-79` |
| Un solo renglón cuando hay cupón | sí | sí (`:57-61`) |
| Verificación de firma del webhook | HMAC sobre manifiesto | HMAC sobre `<ts>.<cuerpo crudo>` (`stripe-webhook.post.ts:31-43`) |
| Anti-replay | — | sí, tolerancia de 5 minutos (`:41`) |
| Firma obligatoria | solo si hay secreto | **siempre** (`:67-68`) |
| Idempotencia + solo hacia adelante + UPDATE atómico | sí | sí (`:101-130`) |
| Salvaguarda de pedido sin renglones | sí | sí (`:113-119`) |
| Avisos a GoHighLevel y a quien surte | **sí** | **no** |

Detalles propios de Stripe: los montos van en **centavos** (`stripe-checkout.post.ts:45`), el `order_id` viaja por tres vías (`metadata`, `client_reference_id` y la metadata del PaymentIntent, `:51-54`) porque en un `charge.refunded` el objeto que llega es un cargo y hay que resolver el pedido consultando el PaymentIntent (`stripe-webhook.post.ts:80-93`). Y en `checkout.session.completed` se confirma que `payment_status` sea `paid`, no solo que la sesión se haya completado (`stripe-webhook.post.ts:96-99`).

**Sobre "probado": con precisión.** Toda la lógica **compartida** sí está cubierta por pruebas —precios (`orders.test.ts`), cupones (`coupons.test.ts`), envío (`costo-envio.test.ts`), dirección (`envio.test.ts`) y las URLs que se le entregan a la pasarela (`base-url.test.ts`)—. Pero **no existe ningún archivo de pruebas específico de `stripe-checkout.post.ts` ni de `stripe-webhook.post.ts`**: ninguna prueba ejercita la verificación de firma de Stripe, el mapeo de sus eventos ni la resolución del `order_id` en un reembolso. Verificado: el único archivo bajo `test/` que menciona Stripe es `test/unit/base-url.test.ts`.

**Qué faltaría para encenderlo** (el procedimiento paso a paso está en `SETUP.md:44`, sección "Stripe", aunque ese documento está desactualizado en otras partes):

1. Cuenta de Stripe verificada para cobrar en México.
2. Cargar `NUXT_STRIPE_SECRET_KEY` (`nuxt.config.ts:93-94`).
3. Registrar el endpoint `/api/stripe-webhook` en el panel de Stripe y suscribir los cinco eventos que el handler mapea: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded` (`server/api/stripe-webhook.post.ts:9-13`).
4. Cargar `NUXT_STRIPE_WEBHOOK_SECRET` (`nuxt.config.ts:95-96`).
5. Poner `NUXT_PUBLIC_STRIPE_ENABLED` para que aparezca el botón.
6. Confirmar que existan las columnas `stripe_session_id` y `stripe_payment_intent_id` en `public.orders`. **No hay migración en el repo que las cree**: verificado, los únicos `ALTER` sobre `orders` versionados son los de `gift` (`supabase/orders-gift.sql:10`, repetido en `supabase/all.sql:61`), `shipped_at` y `tracking` (`supabase/orders-envio.sql:10-14`). El código las escribe con *best-effort*: si no existen, solo se registra un aviso en los logs y el pedido funciona igual, porque el webhook liga por `metadata.order_id` (`stripe-checkout.post.ts:89-92`, `stripe-webhook.post.ts:132-137`). *Si existen hoy: sin verificar desde el repo.*
7. **Escribir las pruebas que faltan** y probar de punta a punta con `stripe listen --forward-to localhost:3000/api/stripe-webhook`.
8. Decidir qué hacer con los avisos: **hoy un pago por Stripe no le avisa a nadie.** Ni a Nancy que hay algo que surtir, ni a GoHighLevel para el correo de postcompra. Ese bloque solo existe en el webhook de Mercado Pago.

> **Advertencia.** Encender Stripe sin resolver el punto 8 significa cobros que nadie surte. Si se enciende, lo primero es portar el bloque de `server/api/mp-webhook.post.ts:161-214` al webhook de Stripe.

---

## 19. Resumen de trampas que pueden costar dinero

| Trampa | Consecuencia | Dónde |
|---|---|---|
| Quitar o renombrar el campo de correo del formulario de envío | Nadie puede pagar, sin mensaje de error y sin tests en rojo | `pages/carrito.vue:382`, `server/api/checkout.post.ts:94` |
| `NUXT_PUBLIC_PUBLIC_BASE_URL` ausente en producción | Se cobra y el webhook nunca llega; pedidos `pending` para siempre | `server/utils/baseUrl.ts` |
| `NUXT_ENVIO_COSTO` y `NUXT_PUBLIC_ENVIO_COSTO` con valores distintos | El carrito muestra un total y la pasarela cobra otro | `nuxt.config.ts:121-125` |
| Quitar el renglón de "Envío" de la preferencia | Se cobra de menos en cada pedido bajo el umbral | `server/api/checkout.post.ts:122-124` |
| Mover el cálculo del envío antes del descuento | Se regalan envíos a quien no alcanzó el umbral | `server/utils/orders.ts:112-117` |
| `NUXT_MP_WEBHOOK_SECRET` ausente | La firma no se valida y nada lo avisa | `server/api/mp-webhook.post.ts:66` |
| **Ninguna de `NUXT_GHL_WEBHOOK_POSTCOMPRA` / `NUXT_GHL_WEBHOOK_AVISO_PEDIDO` cargada** | **El pedido se marca pagado y nadie se entera: ni quien surte ni el cliente. Sin error en los logs** | `server/api/mp-webhook.post.ts:161`, `server/utils/ghl.ts:57-63` |
| `NUXT_PEDIDOS_PIN` ausente | `/pedidos` responde 404 y Nancy se queda sin panel | `server/api/pedidos.get.ts:17-18` |
| Quitar `.in('status', allowedPrev)` del UPDATE | Dos notificaciones concurrentes pueden duplicar correos y avisos | `server/api/mp-webhook.post.ts:133` |
| Permitir `paid → cancelled` | Un rechazo tardío borraría un pago real | `server/api/mp-webhook.post.ts:36-40` |
| Hacer que el GET del webhook procese algo | Abrir un enlace dispararía el flujo de pagos | `server/api/mp-webhook.get.ts` |
| Apagar la campaña sin revisar cupones | Los cupones se re-activan solos en el mismo despliegue | `utils/campana.ts:138` |
| Confiar en `/pedidos` para ver ventas por WhatsApp | No aparecen: se quedan en `pending` | `server/api/pedidos.get.ts:30-33` |
| Contar filas de `orders` como ventas | Los checkouts frenados y abandonados dejan `pending` con sus renglones | `server/api/checkout.post.ts:75` vs `:80-85`, `:94-99` |
| Surtir desde `/pedidos` sin revisar reembolsos | La pantalla no distingue `refunded` de `paid` | `server/api/pedidos.get.ts:32`, `pages/pedidos.vue:124` |
| Reintentar `/api/checkout` (doble clic, recarga, volver atrás) | Pedido duplicado y un uso de cupón gastado por cada intento | `server/api/checkout.post.ts:75`, `server/utils/orders.ts:157` |

**Nota de conciliación de cifras.** El `total` guardado en `orders` **incluye el envío** (`server/utils/orders.ts:117`), pero el valor que se le reporta a la analítica al volver de la pasarela es `cart.totalWithDiscount`, que **no** lo incluye (`pages/carrito.vue:79`). Si comparas ingresos de Google Ads o GA4 contra Supabase, van a diferir por el envío. Además, ese evento de compra se dispara **en el navegador al regresar a `/carrito?status=success`**: si el cliente cierra la pestaña en la pasarela, el pedido igual queda pagado por el webhook pero la analítica nunca registra la compra. El `auto_return: 'approved'` de la preferencia (`server/api/checkout.post.ts:135`) reduce el caso, no lo elimina. Y un pago en efectivo (punto 11) tampoco lo registra, porque el cliente vuelve a `status=pending`, no a `success`.

---

## 20. Sin verificar desde el repo

Estas cosas hay que confirmarlas en los paneles; no se pueden leer del código. Las variables de entorno **no** están en esta lista: el índice del paquete reporta que se verificaron en Vercel el 18 de septiembre (15 cargadas en producción; la tabla de presentes y ausentes, con qué significa cada ausencia, está en `07-variables-de-entorno.md` §0). El inventario con valores va en `07-variables-de-entorno.md`; ahí es donde se confirma si hoy se está cobrando el envío y de cuánto, y si la firma del webhook se está validando.

- Qué URL y qué eventos están registrados en el panel de Mercado Pago para este webhook.
- Qué filas existen en `public.coupons`: cuáles siguen `active`, con qué `max_uses` y qué `used_count` llevan. Importa antes de apagar la campaña (punto 9).
- Cuántos pedidos `pending` hay acumulados hoy y cuáles corresponden a pagos en efectivo todavía vivos (punto 7 y punto 11).
- El esquema completo de `public.orders`. En el repo solo hay `ALTER` aditivos (`supabase/orders-gift.sql`, `supabase/orders-envio.sql`, `supabase/all.sql:61`); la creación original de la tabla no está versionada.
- Si existen las columnas `stripe_session_id` y `stripe_payment_intent_id`.
- Si hay cuenta de Stripe creada o verificada.
- Qué workflows tiene armados César del lado de GoHighLevel para `compra_confirmada` y `pedido_para_surtir` (`04-automatizaciones-ghl.md`).
