# Fallas conocidas

Este documento es el registro de lo que ya se rompió en AMANTI, con la causa que de verdad se confirmó y el estado en que quedó. No es una lista de teorías: cada entrada salió de `BITACORA.md` (leída completa) y se cruzó contra el código que hay en el repo hoy, 18 de septiembre de 2026.

Está ordenado por lo que con más probabilidad te va a pasar a ti en las primeras semanas, no por gravedad histórica.

Cada entrada tiene la misma forma:

- **Síntoma:** lo que se ve desde fuera, normalmente lo que reporta alguien del equipo.
- **Causa:** la razón verificada. Cuando hubo un diagnóstico intermedio equivocado, se dice, porque el error de método se repite más que el bug.
- **Estado hoy:** arreglado, vivo o parcialmente vivo, con la línea del archivo donde se comprueba.
- **Cómo evitarlo:** la regla que queda.

Un patrón que vas a ver repetirse: **casi ninguna de estas fallas hizo ruido.** No hubo excepciones, ni 500, ni consola roja. El sitio se veía perfecto y no pasaba nada. Ese es el modo de falla característico de este proyecto, y es la razón por la que el documento existe.

---

## Quién es quién

Varias de las reglas de abajo terminan en «pídele X a alguien». Este es ese alguien. Los nombres están tomados de `BITACORA.md:7-8` y de las entradas donde cada uno aparece pidiendo o resolviendo algo.

| Persona | Qué opera | Cuándo le escribes |
|---|---|---|
| **Raúl** | Dueño. Decisiones comerciales. | Monto del envío, fecha de fin de la campaña del 40%, si se aceptan cupones, precios. Nada de eso se decide en código. |
| **Nancy** | Operación: surte los pedidos. | Cuando hay que prender la bandera `agotado` de un producto, o cuando deja de llegarle el aviso de pedido nuevo. Ella es quien primero se entera de que algo no llegó. |
| **César** | GoHighLevel: los workflows, las plantillas de correo y WhatsApp, los Inbound Webhooks. | Cuando un evento de GHL no ejecuta, cuando necesitas la URL nueva de un trigger, o cuando hay que revisar el historial de ejecuciones de un workflow —panel al que el sitio no tiene acceso. |
| **Emilio** | Google: Ads, GA4, Merchant Center, y los accesos a esas cuentas. | Cuando la medición no cuadra, cuando Merchant Center rechaza productos, o cuando falta un acceso. |
| **Memo** | Todo lo técnico hasta la fecha de esta entrega. | Ya no está. Por eso existe este documento. |

**Josué** aparece una sola vez y no es del equipo: es el cliente que pagó tres veces el 29 de agosto (incidente 5).

---

## Cómo correr esto

Ninguna de las reglas de abajo sirve si no puedes ejecutar la suite. Los comandos salen de `package.json:5-14`.

| Qué quieres | Comando | Notas |
|---|---|---|
| Desarrollo | `npm run dev` | `nuxt dev`. |
| Pruebas unitarias | `npm run test:unit` | `vitest run`. Cubre `test/unit/**` y `test/smoke/**` (`vitest.config.ts:12`). |
| Pruebas e2e | `npm run test:e2e` | `playwright test`. **Requiere un `.output` ya compilado**, ver abajo. |
| Todo | `npm test` | Corre `vitest run && playwright test` en ese orden (`package.json:11`). |
| Compilar | `npm run build` | `nuxt build`. |

**Los e2e no compilan nada.** El `webServer` de Playwright arranca `node .output/server/index.mjs` (`playwright.config.ts:31`), o sea el build de producción que ya exista en disco. El orden correcto es:

```
npm run build        # deja el .output
npm run test:e2e
```

**Advertencia doble sobre ese paso**, y las dos ya mordieron:

1. `reuseExistingServer: true` (`playwright.config.ts:48`). Si dejaste corriendo un `.output` viejo en el puerto, Playwright lo reutiliza y **los e2e prueban el build viejo**, no el que acabas de compilar.
2. El build revienta si ese server sigue levantado: `EPERM ... unlink libvips-42.dll`, porque el proceso `node .output/server/index.mjs` tiene cargada la DLL de sharp (`BITACORA.md:221-223`). Baja el server **antes** de `npm run build` o el `.output` queda a medias.

**El puerto es 3457, no 3010**, y no es capricho: en la máquina donde se desarrolló, el 3010 cae dentro del rango que Windows reserva para Hyper-V/WSL, node truena con `EACCES` antes de escuchar, Playwright no puede levantar su servidor y **ningún** e2e corre (`playwright.config.ts:3-6`). Se pisa con la variable `E2E_PORT`.

**De dónde salen `SB_URL`, `SB_ANON` y `SB_SVC`.** Son variables del **shell**, no del `.env`, y sin ellas tres specs se saltan solos (`test/e2e/orders.spec.ts:14`, `test/e2e/coupons.spec.ts:17`, `test/e2e/account-auth.spec.ts:14`). Corresponden a las tres credenciales de Supabase que nombra `.env.example:34-41`: la URL del proyecto, la llave anon/public y la service_role. **Los valores viven en el panel de Supabase (Project Settings → API) y no se pueden sacar del repo** — sin verificar desde el repo. `SB_SVC` se le pasa al servidor de pruebas como `SUPABASE_SERVICE_ROLE_KEY` (`playwright.config.ts:37`); nunca va escrita en el repo, y así tiene que quedarse.

**Si la suite unitaria se comporta rarísimo** (timeouts de worker sin un solo test roto), existe el rodeo documentado: `npx vitest run --pool=threads --no-file-parallelism` (`BITACORA.md:730-731`). `vitest.config.ts:10-14` no fija ningún pool, así que esas banderas van a mano cuando haga falta. Ver el incidente 1 antes de usarlas.

**Cómo se dispara un despliegue: sin verificar desde el repo.** El proyecto vive en Vercel (`BITACORA.md:4`), pero en el repo no hay configuración de build ni de CI — `vercel.json` solo tiene redirects 301 del sitio viejo. El mecanismo real (rama conectada, `vercel --prod`, o lo que sea) hay que confirmarlo entrando al panel. Lo que sí está registrado es que una variable nueva **no entra sin un despliegue nuevo**, y que una vez hubo que forzarlo con un commit vacío (`BITACORA.md:867-868`); ver incidente 16.

---

## El mapa de pruebas: qué red de seguridad tienes antes de tocar cada cosa

Hay **24 archivos en `test/unit/`** más 2 en `test/smoke/` —los 26 archivos que el 18/09/2026 dieron 268 pruebas en verde— y **23 specs en `test/e2e/`**. Varios caen justo encima de los incidentes de este documento. Antes de tocar algo, corre el suyo:

| Si vas a tocar… | Corre primero | Cubre el incidente |
|---|---|---|
| El puente a GoHighLevel (`server/utils/ghl.ts`) | `test/unit/ghl.test.ts` | 2, 10, 15 |
| El aviso a quien surte | `test/unit/aviso-pedido.test.ts` | 10 |
| El feed de Google / precios de campaña | `test/unit/feed-precio.test.ts` | 12 |
| El cobro del envío | `test/unit/costo-envio.test.ts`, `test/unit/envio.test.ts` | 13 |
| La creación de pedidos y el rechazo de agotados | `test/unit/orders.test.ts` | 9 |
| El `payer` del checkout de Mercado Pago | `test/unit/checkout-payer.test.ts` | 4 |
| El empujador del dataLayer | `test/unit/gtag.test.ts` | 3 |
| El buscador | `test/unit/buscar.test.ts` | 8 |
| Fechas de campaña y banner | `test/unit/campana.test.ts` | 12 |
| Las URLs que se le dan a la pasarela | `test/unit/base-url.test.ts` | 17 |

El resto del directorio (`cart`, `coupons`, `products`, `phone`, `wishlist`, `swipe`, `ui-state`, `gclid`, `personalizacion`, `resena-token`, `nombre-resena`, `subcategories`, `analytics`) cubre el sitio en general.

---

## Dos cosas con fecha que te muerden antes que cualquier otra

**1. La campaña del 40% no se apaga sola, y la fecha acordada es el 30 de septiembre de 2026.** Está detallado en el incidente 12. Si nadie la apaga, la tienda sigue regalando el 40% indefinidamente y nada avisa. Faltan menos de dos semanas desde la fecha de este documento.

**2. El aviso de envío al cliente está prometido por escrito en el sitio y puede no tener a dónde mandarse.** Incidente 11.

---

## 1. Las pruebas salen en rojo y no hay ningún bug

**Síntoma.** Corres la suite y salen rojos. Las tres formas que ya se vieron: `Test timed out in 5000ms` en `ui-state.test.ts`; `Timeout waiting for worker to respond` de vitest sin que se llegue a ejecutar un solo test; y e2e que fallan con `wmodal-wrap subtree intercepts pointer events` o que se quedan esperando para siempre.

**Causa.** Cuatro causas distintas, todas del entorno, ninguna del código:

- **Contención de CPU.** El 14 de septiembre la suite unitaria dio 4 rojos y luego 2, todos por timeout, mientras corría un build en paralelo. El caso de control —ese archivo solo, sin el build compitiendo— pasó los 4 en 5 segundos, y la corrida limpia terminó 261/261. No había regresión (`BITACORA.md:217-220`).
- **La máquina de trabajo.** El 28 de agosto el arranque de procesos tardaba minutos: `ls -la` y `echo ok` se iban a segundo plano por timeout, y `npx vitest run` falló 19 veces con «Timeout waiting for worker to respond» sin un solo test roto (`BITACORA.md:727-733`). El rodeo que funcionó fue `--pool=threads --no-file-parallelism`.
- **El modal de bienvenida.** `WelcomeModal.vue` abre a los 6 segundos de montar y su overlay se come el clic que caiga después. Los specs ponían la cookie de edad pero no la marca del modal.
- **`networkidle` depende de terceros.** Una corrida dejó peticiones a `challenges.cloudflare.com` abiertas más de 45 segundos en `/carrito`; son el captcha Turnstile del formulario de GoHighLevel embebido. Minutos después la misma página llegaba a idle en 1 segundo.

**Estado hoy: arreglado en la suite.** **Todos los specs que hacen clic suprimen el modal en su `beforeEach`** — 22 de los 23 archivos de `test/e2e/` ponen `amanti_welcome_seen` con un `addInitScript` (`test/e2e/chat.spec.ts:10` y los demás). **`test/e2e/subcategoria.spec.ts` es la excepción deliberada**: su `beforeEach` (`:5-10`) solo pone las cookies de edad y consentimiento, porque ese spec «solo navega y cuenta (sin clicks → no depende de overlays)», según su propio comentario (`:12-13`). No le estorba el overlay, así que no lo suprime. Si ves ese archivo distinto a los otros, es por eso y no por un olvido.

La espera de hidratación tampoco usa ya `networkidle`, sino el launcher de EROS, que vive dentro de `<ClientOnly>` y por lo tanto solo existe cuando la app ya montó (`test/e2e/hidratacion.ts:12-13`). El 10 de septiembre la suite cerró en 62 verdes, 0 rojos.

**Dos deudas de prueba siguen vivas, y las vas a heredar:**

- `test/e2e/busqueda-analytics.spec.ts:91` navega con `window.history.pushState`, que no pasa por el router de Nuxt. Ese test pasa sin ejercitar el caso que dice probar. Está anotado como falla conocida en `BITACORA.md:78-80`.
- `test/e2e/chat.spec.ts:14-22` le pega a `/api/chat`, que es un proxy del webhook del agente EROS en n8n (`nuxt.config.ts:97-99`), y espera hasta 35 segundos una segunda respuesta del bot (`chat.spec.ts:70`). Ese spec depende de que un servicio de un tercero conteste.

**Cómo evitarlo.** Antes de creerle a un rojo, corre el archivo solo con la máquina en reposo. Es el caso de control y cuesta un minuto. No corras build y tests a la vez. Y ojo: varios specs siguen registrando sus cookies contra `http://localhost:3010` (por ejemplo `subcategoria.spec.ts:7-8`); funciona porque las cookies no se separan por puerto, pero es un resto de la migración de puerto y no una dirección real.

---

## 2. GoHighLevel: la URL del webhook se regenera al guardar, y el endpoint contesta 200 a todo

Este es el incidente más caro en tiempo de todo el proyecto y el que más probabilidad tiene de volver, porque depende de que alguien externo vuelva a guardar un workflow.

**Síntoma.** Nancy deja de recibir el WhatsApp de «entró un pedido». El sitio no reporta nada: HTTP 200 en medio segundo, cero warnings en los logs, el pedido se registra bien en la base. Del lado de GHL, el historial de ejecuciones del workflow está vacío.

**Causa, confirmada por César el 28 de agosto.** GHL **puede regenerar la URL del Inbound Webhook al volver a guardar el trigger**, y no avisa. Es «puede», no «siempre»: ese mismo día, en un guardado posterior, la URL no cambió (`BITACORA.md:664-665`). Sus palabras: «el sistema solo te da la URL y ya». La URL vieja queda muerta pero **sigue contestando HTTP 200** (`BITACORA.md:627-643`).

Y es peor de lo que parece. El 31 de agosto se probó el control obvio: se le pegó a un endpoint de GHL con una cuenta inexistente y un id de puros ceros. Respuesta: HTTP 200, cuerpo idéntico, 43 bytes, mismas cabeceras (`BITACORA.md:496-499`). **Desde fuera de GHL no hay forma de distinguir un webhook vivo de uno muerto de uno que nunca existió** — ni por código, ni por cuerpo, ni por tamaño, ni por cabeceras, ni por tiempo de respuesta (`BITACORA.md:501-503`).

De ahí sale la única señal que sirve, y es asimétrica:

| Respuesta | Qué significa |
|---|---|
| `{"status":"Success: test request received"}` | **No dice nada.** Ese cuerpo exacto lo devuelve igual un trigger capturando muestra, una URL muerta y una cuenta que nunca existió. Comprobado con una URL falsa: `BITACORA.md:496-499`. **No lo uses como diagnóstico.** |
| `{"status":"Success: request sent to trigger execution server","id":"…"}` | Algo **sí** se ejecutó, y ese `id` se puede buscar en el historial de ejecuciones de GHL. |

**Lo único que sí es señal es el cuerpo con `request sent to trigger execution server` y su `id`**, y solo por presencia: cuando aparece, informa; cuando no aparece, no prueba nada (`BITACORA.md:510-513`).

**Advertencia sobre la bitácora misma.** `BITACORA.md:647-650` trae una tabla del 28 de agosto que sí presenta el primer cuerpo como señal («el trigger NO está vivo: sigue capturando muestra»). **Esa tabla quedó desmentida tres días después** por la prueba de la URL falsa, y el desmentido está escrito en el mismo archivo (`BITACORA.md:493-513`). Si abres la bitácora y encuentras la tabla vieja antes que la corrección, manda la corrección.

**Por qué importa tanto no equivocarse aquí.** Actuar sobre esa fila es exactamente el error que ya se cometió: con ese razonamiento se le dijo a César que su trigger estaba atorado capturando muestra y que lo liberara y volviera a guardar. Su trigger nunca estuvo mal; el problema era otro, y esa tarde costó tres horas de trabajo de otra persona (`BITACORA.md:515-525`).

**Estado hoy: el código sigue sin poder detectarlo, y es a propósito.** `emitirEventoGhl` solo mira `res.ok` (`server/utils/ghl.ts:100-104`). Como GHL contesta 200 siempre, esa función devuelve `true` siempre. **La ausencia de un warning `[ghl]` en los logs no prueba absolutamente nada sobre si el evento llegó a ejecutarse.** No se metió lógica que lea el cuerpo porque el emisor está diseñado para no lanzar nunca y no bloquear el camino del pago (reglas escritas en `server/utils/ghl.ts:19-32`).

**Cómo evitarlo.**

1. Cada vez que César toque un workflow, **pide la URL que muestra hoy el trigger y compárala contra la de Vercel.** Puede haber cambiado o no; no hay aviso automático en ningún caso.
2. **Pide la URL como texto, nunca leída de una captura de pantalla.** Ver la lección transversal al final: esto ya costó tres horas de otra persona.
3. Para verificar, **mira el cuerpo de la respuesta, no el status**, y pide a César la corrida en el historial de ejecuciones de GHL. Ese panel es lo único que resuelve la duda en una mirada.
4. **Advertencia de costo:** cada disparo se cobra. Los triggers de GHL son premium y se pagan por uso (`server/utils/ghl.ts:12-17`, `.env.example:47-49`). No pruebes en bucle. Para probar el payload sin gastar, levanta un receptor propio, que es como se verificó el aviso de envío el 31 de agosto.

---

## 3. La medición llevaba desde el día uno en cero, y no era el Consent Mode

**Síntoma.** GA4 decía «Todavía no se han recibido datos de tu sitio web»: usuarios, eventos y eventos clave en 0, incluido un fin de semana con ventas reales. La conversión de compra de Google Ads, también en 0. Emilio lo reportó el 31 de agosto y sospechaba del Consent Mode.

**Causa.** No era el consentimiento. El empujador del dataLayer hacía `w.dataLayer.push(args)`, donde `args` son rest params — o sea, un Array normal. **gtag.js solo interpreta una entrada del dataLayer como comando cuando esa entrada es un objeto `arguments`.** Un Array lo ignora en silencio: el script de Google cargaba, el dataLayer se veía lleno con sus siete comandos, la consola limpia, y no salía un solo hit.

Una sola causa explicaba todos los síntomas, porque `useAnalytics` manda **todo** por `window.gtag`: `view_item`, `add_to_cart`, `begin_checkout`, `purchase` y la conversión de Ads iban al mismo agujero.

**Estado hoy: arreglado.** El empujador vive aislado en `utils/gtag.ts:18-23`, empuja `arguments`, y tiene prueba propia (`test/unit/gtag.test.ts`) que falla si alguien vuelve a empujar un Array.

**Cómo evitarlo.**

- **No conviertas `gtagPush` en arrow function.** Las arrow no tienen `arguments` y el error vuelve exactamente igual de mudo. Está escrito en el propio archivo (`utils/gtag.ts:15-17`).
- **Una prueba que mockea `window.gtag` no sirve para esto.** `test/unit/analytics.test.ts` verificaba el *payload* y nunca el *vehículo*. La prueba buena lee el dataLayer, como hace `test/e2e/busqueda-analytics.spec.ts:25-31`.
- **Lo perdido no se recupera:** GA4 no rellena hacia atrás.
- Y el error de método de ese día, que vale más que el bug: se presentó como prueba definitiva que no existía la cookie `_ga` ni con el consentimiento aceptado. Esa prueba no servía — ese Chrome tiene un bloqueador que impide descargar `googletagmanager.com` (`transferSize: 0` en 3 ms). El bug era real de todos modos; la evidencia no lo era (`BITACORA.md:407-411`).

---

## 4. El checkout pintaba todo y nunca habilitaba el botón de pagar

**Síntoma.** El cliente llega a Mercado Pago, ve el checkout completo —tarjeta, mensualidades, todo— y **el botón de pagar nunca se habilita**. Sin mensaje de error, sin nada que reportar. Raúl lo levantó dos veces, el 26 y el 27 de agosto, con dos tarjetas distintas: «Solo ingreso el tipo de pago pero no me deja pagar». Las dos veces se asumió que el problema estaba de su lado.

**Causa.** La preferencia de Mercado Pago se creaba **sin el campo `payer`**. Sin `payer.email`, MP se comporta exactamente así. Está documentado en el propio código (`server/api/checkout.post.ts:15-32`).

Es también la explicación de por qué la conversión de compra de Google Ads llevaba en 0: no es que no disparara, es que **nunca hubo una compra que la disparara**.

**Y el primer arreglo estaba a medias, que fue lo más importante del día.** Se agregó el `payer` leyendo el correo de `localStorage('amanti_email')`. Pero esa llave la escribía el modal de bienvenida, y ese modal **se había sustituido por el formulario de GoHighLevel** días antes. La llave quedó huérfana: nada la escribía, y para un invitado el correo era siempre `null`. O sea que el arreglo servía solo para quien iniciaba sesión, que es la minoría. Lo detectó Raúl a las 4:21 p.m.: «Me comentan que no pidio correo electronico solo la direccion».

**Estado hoy: arreglado.** El correo se pide en el carrito junto con la dirección, se valida en navegador y servidor, y el checkout **frena con 400 antes de mandar al cliente a MP** si falta el correo (`server/api/checkout.post.ts:94-99`) o si falta la dirección (`:80-85`). Es mejor detenerlo donde puede corregir que después de cobrarle. Hay prueba unitaria: `test/unit/checkout-payer.test.ts`.

**Cómo evitarlo.** No toques `datosDelComprador` sin correr esa prueba. Y entiende la regla de fondo: **la mayoría de las compras de AMANTI son de invitado**, así que cualquier cosa que dependa de una sesión de Supabase para funcionar, en la práctica no funciona. Cuando arregles algo, pregúntate cuál de los dos caminos arreglaste.

---

## 5. El acuse de compra nunca llegaba, y un cliente pagó tres veces

**Síntoma.** Nancy reportó el 31 de agosto que a un cliente no le llegó correo al pagar. Al revisar, ninguno de los 8 pedidos que había tenido la tienda había generado acuse.

**Causa.** El carrito sí pide el correo y `normalizarEnvio` sí lo guarda en `shipping_address.email`. Pero al confirmarse el pago, el webhook lo buscaba **solo** en el usuario de Supabase. Los pedidos de invitado no tienen `user_id`, así que GHL recibía `email: null`. Y los 8 pedidos eran de invitado.

**Lo que costó, que es la parte que importa.** Josué pagó el 29 de agosto a las 4:58 p.m. y, al no recibir nada, levantó el mismo pedido de $309 **dos veces más**, a las 4:59 y a las 5:00. Sin acuse, quien ya pagó cree que no pagó, y el siguiente clic es pagar otra vez. Estuvo a un clic del cobro doble. El razonamiento está escrito en `server/api/mp-webhook.post.ts:167-176`.

Al revisar salió un segundo hueco: el evento tampoco mandaba **nombre ni teléfono**, así que en GHL el comprador aparecía como un ID sin persona y una plantilla que saluda no tenía con qué.

**Estado hoy: arreglado.** El webhook baja por la escalera `user_id` → `shipping_address.email` (`server/api/mp-webhook.post.ts:177-182`), y el payload lleva nombre y teléfono tomados de la dirección de envío (`:197-202`, armado en `server/utils/ghl.ts:176-184`).

**Cómo evitarlo.** **El correo del comprador no vive en una columna de `orders`.** Cualquier código nuevo que lo necesite tiene que repetir esa escalera completa, no quedarse en el usuario de Supabase.

---

## 6. El teléfono de respaldo de WhatsApp llevaba meses equivocado

**Síntoma.** Ninguno. Esto es lo que lo hace peligroso.

**Causa.** `nuxt.config.ts` tenía `5214437270349` como valor de respaldo de `whatsappPhone`. Cuando cambió el número de AMANTI, solo se actualizó la variable en Vercel y esa línea se quedó atrás. En producción la variable siempre gana, así que nunca se vio nada.

Era una trampa con detonador: el día que esa variable faltara —alguien la borra, un entorno nuevo, un deploy de preview sin ella— **todos los lugares que arman enlaces de WhatsApp caerían al respaldo**, incluido `stores/cart.ts`, que es por donde se piden pedidos. Serían pedidos yéndose al número de un desconocido sin un solo error en ningún lado.

**Estado hoy: corregido**, con el porqué escrito en el archivo (`nuxt.config.ts:102-114`). `whatsappPhone` se referencia hoy en **ocho** archivos del sitio: `components/BottomNav.vue`, `components/ChatWidget.vue`, `components/WhatsAppButton.vue`, `stores/cart.ts`, `pages/contacto.vue`, `pages/garantias.vue`, `pages/terminos.vue` y `pages/tienda/[slug].vue` (más `nuxt.config.ts`, que lo define, y `test/unit/cart.test.ts`).

**Ojo con el comentario de ese archivo:** `nuxt.config.ts:110-111` dice «los NUEVE lugares que arman enlaces de WhatsApp». Hoy son **ocho**; el noveno no existe y vas a perder tiempo buscándolo. Lo más limpio es corregir esa línea a «los OCHO lugares» la próxima vez que toques el archivo.

**Cómo evitarlo.** **Todo valor de respaldo en código tiene que ser el valor bueno**, no un placeholder ni uno viejo. Si un respaldo no puede ser correcto, que sea obvio que es falso y esté marcado como tal — es lo que hace `.env.example:4-7`, que dice con todas sus letras que ese número es un placeholder ficticio.

---

## 7. El rail de Novedades enseñaba el catálogo de junio

**Síntoma.** César reportó el 14 de septiembre que en «Novedades» del home no aparecían los productos recientes. Era cierto desde siempre.

**Causa.** El rail era `featured().slice(0, 8)`: los primeros ocho productos con la bandera `featured`, **en orden de archivo**. Como el catálogo original de junio ocupa las primeras posiciones de `data/products.json` y ya trae de sobra productos marcados, ninguna alta posterior alcanzaba a entrar nunca. «Novedades» enseñaba lo más viejo de la tienda.

**Estado hoy: arreglado.** Son las últimas ocho altas, la más reciente primero: `[...products].slice(-8).reverse()` (`pages/index.vue:13`).

**Advertencia.** Ese arreglo se apoya en una convención que nada obliga: **el orden de `data/products.json` es el orden de alta.** Se comprobó contra el historial de commits. Si algún día alguien reordena o alfabetiza ese JSON, el rail deja de decir la verdad y **no truena nada**. Queda anotado en el propio archivo (`pages/index.vue:7-12`).

**Cómo evitarlo.** Las altas de producto se agregan **al final** del arreglo, siempre.

---

## 8. El buscador daba cero resultados al buscar por frase

**Síntoma.** Nancy buscó «Lubricante coco» en el sitio y salió vacío, aunque sí hay. Peor: un cliente le había preguntado eso mismo por WhatsApp, ella buscó, no encontró nada y 45 minutos después mandó nota de voz al grupo diciendo que no estaban. Sí estaban.

**Causa.** Dos fallas encimadas:

1. Un solo `includes()` de la **frase completa**. «coco» encontraba los Lubricantes Sunny, pero «Lubricante coco» devolvía cero, porque esa frase exacta no aparece en ninguna ficha aunque las dos palabras sí estén.
2. **Había dos buscadores con campos distintos.** El de la tienda miraba la descripción pero no la categoría; el del encabezado —el desplegable que sale al teclear, el que más se usa desde el celular— miraba la categoría pero **no** la descripción. Como los sabores viven en la descripción, ahí «coco» no encontraba nada ni escribiéndolo solo.

Al grupo se le había dicho antes que el buscador sí encontraba: con una palabra sí, con la búsqueda real no.

**Estado hoy: arreglado.** Un solo comparador en `utils/buscar.ts`, usado por los dos buscadores. Parte la consulta en palabras y las pide **todas** (Y lógica, no O: quien escribe más palabras está afinando, no ampliando) e ignora acentos de los dos lados, porque es una tienda mexicana y medio catálogo lleva ñ o tilde (`utils/buscar.ts:28-70`). Tiene prueba propia: `test/unit/buscar.test.ts`.

**Cómo evitarlo.** Cualquier buscador nuevo usa `coincideBusqueda`, no su propio `includes`. Y hoy lo que la gente busca se manda a GA4 con el número de resultados, precisamente porque **el caso que importa es el cero**: es la única forma de enterarse de esto sin que alguien lo reporte.

---

## 9. La cuarta superficie del catálogo: el chat recomendaba lo agotado

**Síntoma.** Potencial: la tienda rechaza la compra de un producto agotado, pero el agente de chat EROS lo sigue recomendando en una conversación uno a uno.

**Causa.** Al agregar la bandera `agotado` el 31 de agosto se cablearon **tres** superficies. Son cuatro. `/api/catalog` —el endpoint que consume EROS vía n8n— tenía `inStock: true` a fuerza para todos.

Y era la peor de las cuatro para equivocarse: las otras tres solo *muestran* algo que ya no hay; esta le dice al agente que lo **recomiende**.

**Estado hoy: arreglado**, con el porqué en el archivo (`server/api/catalog.get.ts:24-31`). Las cuatro superficies son:

| Superficie | Dónde vive | Qué hace |
|---|---|---|
| `resolveItems` | `server/utils/orderItems.ts:67-72` | Rechaza la compra con 409 y nombra cuál quitar |
| Ficha de producto | `pages/tienda/[slug].vue` | Botón apagado, marca `OutOfStock` |
| Feed de Google | `server/routes/feeds/google.xml.get.ts:132` | `out_of_stock` en lugar de `in_stock` |
| `/api/catalog` | `server/api/catalog.get.ts:31` | `inStock` para el agente EROS |

**Decisión de diseño que conviene entender:** el rechazo vive en el servidor, no en la vista. `resolveItems` está dentro de `createPendingOrder`, que es la puerta única de los tres caminos de pago (Mercado Pago, WhatsApp y Stripe), así que no se puede comprar con la página abierta desde antes, con el carrito guardado, ni entrando por el enlace directo del anuncio. Esconder el botón no bastaba, y devolver un cobro cuesta más que perder la venta (`server/utils/orderItems.ts:62-66`).

**Dato de hoy:** ningún producto trae la bandera. `data/products.json` no tiene ni una ocurrencia de `"agotado"`, o sea que ese camino no está ejercitado en producción ahora mismo. No hay conteo de inventario: es una bandera manual que se prende cuando Nancy avisa (`server/utils/orderItems.ts:27-32`).

**Cómo evitarlo.** Cada vez que agregues un campo al catálogo, **recorre las cuatro superficies una por una**. Este hueco no lo encontró quien escribió el código, lo encontró una revisión que fue a leerlas de forma explícita.

---

## 10. El aviso a quien surte colgaba de la configuración de otra automatización

**Síntoma.** Potencial: Nancy deja de recibir avisos de pedido nuevo y **no hay un solo error en los logs**, porque no es un fallo — la función simplemente no se llama.

**Causa.** El bloque del webhook de Mercado Pago estaba condicionado a `ghlConectado('compra_confirmada')`, y dentro de ese `if` vivía **también** la llamada a `avisarPedidoParaSurtir()`. O sea que el aviso a quien surte dependía de que estuviera configurada la URL de **postcompra**, que es otra automatización, con otro destinatario y otro propósito. El razonamiento completo quedó escrito en `server/api/mp-webhook.post.ts:150-160`.

**Estado hoy: arreglado para el camino de Mercado Pago.** La condición es `(ghlConectado('compra_confirmada') || ghlConectado('pedido_para_surtir'))` (`server/api/mp-webhook.post.ts:161`) y cada emisor se auto-protege por su cuenta; el `if` de afuera queda solo para no pagar consultas a Supabase en balde.

**Acotación que no puedes saltarte: los pedidos por WhatsApp no disparan nada.** `server/api/order-whatsapp.post.ts:19-20` llama a `createPendingOrder` y devuelve. No emite `pedido_para_surtir`, ni `compra_confirmada`, ni la conversión de Ads. **Un pedido por WhatsApp —que en esta tienda es un canal principal— no le manda a Nancy ningún aviso automático ni le entra a ningún workflow de GHL.** Ella los ve en `/pedidos` (la pantalla protegida con `NUXT_PEDIDOS_PIN`, `server/api/pedidos.get.ts:7,17`) o en la propia conversación de WhatsApp. Si alguien te dice «no me llegó el aviso», lo primero que hay que preguntar es por cuál de los tres caminos entró ese pedido.

**Los cinco eventos de GHL que existen, y quién dispara cada uno.** El catálogo completo está en `server/utils/ghl.ts:36-48` y el mapa a variables en `:57-63`:

| Evento | Variable | Quién lo dispara |
|---|---|---|
| `compra_confirmada` | `NUXT_GHL_WEBHOOK_POSTCOMPRA` | `server/api/mp-webhook.post.ts:198` |
| `carrito_abandonado` | `NUXT_GHL_WEBHOOK_CARRITO_ABANDONADO` | `server/api/cart-save.post.ts` (con candado, ver incidente 15) |
| `pedido_para_surtir` | `NUXT_GHL_WEBHOOK_AVISO_PEDIDO` | `server/api/mp-webhook.post.ts:186` |
| `pedido_enviado` | `NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` | `server/api/pedido-enviado.post.ts:44` |
| **`reactivacion`** | `NUXT_GHL_WEBHOOK_REACTIVACION` (`.env.example:52`) | **Nadie.** No hay un solo llamador en `server/`. |

**`reactivacion` está declarado y nunca se emite** (`server/utils/ghl.ts:39` y `:60`). Existe el tipo, existe la variable y existe su prueba en `test/unit/ghl.test.ts`, pero el sitio no lo dispara desde ningún endpoint. No es un bug pendiente que tengas que cerrar: es una ranura reservada. Si algún día alguien pone esa variable en Vercel esperando que el sitio mande algo, no va a pasar nada y no va a haber ningún error. Antes de cablearlo, habla con César y con Raúl sobre si la reactivación debe salir del sitio o de un workflow con calendario propio dentro de GHL.

**Cómo evitarlo.** No agrupes dos integraciones distintas bajo una misma condición de «¿está configurado?». Un aviso de marketing que no sale se arregla luego; un pedido que nadie sabe que hay que surtir se queda sin enviar.

---

## 11. El aviso de envío al cliente: el sitio lo promete y puede no tener a dónde mandarlo

**Síntoma.** El cliente paga, Nancy marca el pedido como enviado, y al cliente no le llega nada. Mientras tanto `pages/envios.vue:29` le promete por escrito: «Recibirás un número de rastreo por email una vez que tu pedido sea enviado».

**Causa.** El código sí emite el evento. `POST /api/pedido-enviado` dispara `pedido_enviado` al marcar (`server/api/pedido-enviado.post.ts:44`). Pero ese evento sale por la variable `NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` (`server/utils/ghl.ts:62`), y **sin URL configurada `emitirEventoGhl` devuelve `false` en silencio** (`server/utils/ghl.ts:91`). Es la regla 1 del módulo y es deliberada, pero significa que un evento sin variable no se distingue de un evento entregado.

**Estado hoy: probablemente vivo, y no se puede confirmar desde el repo.** `BITACORA.md:40-45` registra que al 15 de septiembre, en Vercel producción, existían `NUXT_GHL_WEBHOOK_AVISO_PEDIDO`, `_CARRITO_ABANDONADO` y `_POSTCOMPRA`, pero **`NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` no existía**. Qué hay hoy en el panel de Vercel es algo que no se puede verificar desde el repo: compruébalo con `vercel env ls production` antes de hacer nada.

**Decisiones del endpoint que no son de estilo** y conviene respetar (`server/api/pedido-enviado.post.ts:30-36`): se avisa solo al marcar y **nunca al deshacer**, porque un «ya va en camino» seguido de nada es peor que no avisar; va sin esperar respuesta, porque un aviso que no sale se reenvía pero un pedido que no se puede marcar detiene a Nancy; y `guia` puede ser `null` con un `tiene_guia` aparte, porque a veces se marca el envío antes de tener el número y la plantilla necesita distinguirlo en vez de pintar un hueco (`server/utils/ghl.ts:216-232`).

**Cómo evitarlo.** De aquí salió la práctica del **inventario de promesas**: revisar que cada cosa que el sitio promete por escrito tenga a alguien ejecutándola. `/envios`, `/garantias`, `/pagos` y `/faq` son texto que alguien tiene que cumplir. Cuando cambies una de esas páginas, busca quién ejecuta lo que dice. **Ese inventario tiene hoy un renglón abierto en la misma página `/envios`** — ver incidente 13.

---

## 12. La campaña del 40% no caduca sola (riesgo con fecha)

**Advertencia: esto cobra de menos en cada venta si nadie lo apaga, y puede suspender la cuenta de Merchant Center si se apaga mal.**

**Síntoma futuro.** El 1 de octubre de 2026 la tienda sigue vendiendo con 40% de descuento sobre todo el catálogo, y nadie se entera.

**Causa.** `CAMPANA.activa` es un booleano manual sin fecha de caducidad (`utils/campana.ts:42-47`). Al 18 de septiembre de 2026 sigue en `true`. La fecha acordada —30 de septiembre, decidida por el equipo el 31 de agosto— existe **solo como comentario** pegado al interruptor (`utils/campana.ts:28-41`), que es donde va a mirar quien tenga que apagarlo, pero no hace nada por sí sola.

**Para apagarla:** `activa: false` y desplegar. Se aplica sola a la tienda, la ficha, el buscador, el carrito, el cobro de Mercado Pago, los pedidos guardados y el feed de Google, porque el flag viaja en el mismo bundle para servidor y navegador. Vive en código y no en una variable de entorno precisamente por eso: si viviera en el entorno, durante un despliegue el navegador y el servidor podrían leer valores distintos y acabaríamos **enseñando 40% y cobrando el precio completo** (`utils/campana.ts:1-15`).

**Trampa al apagarla, que no es obvia:** `CUPONES_ACEPTADOS = !CAMPANA.activa` (`utils/campana.ts:138`). En el momento en que apagues la campaña, **el servidor vuelve a aceptar cupones al cobrar** y el sitio vuelve a anunciarlos si `ANUNCIAR_CUPONES` estuviera encendido (`:124-131`). Hoy están apagados justamente porque dos descuentos encimados dejarían la venta en 49% sin que nadie lo haya decidido. Decide eso a propósito, no por efecto secundario.

**Advertencia sobre el feed de Google, y sobre un comentario que se contradice a sí mismo.** El feed manda `sale_price_effective_date` solo si la variable `NUXT_PROMO_VIGENCIA` está puesta (`server/routes/feeds/google.xml.get.ts:45-55` y `:150-152`). **Hoy no se le pone, y eso es deliberado.** El razonamiento vive en `utils/campana.ts:37-41`: si el feed caducara el 30 de septiembre y el interruptor siguiera encendido, el 1 de octubre Google anunciaría el precio de lista mientras el sitio cobra el rebajado — eso es discrepancia de precio y Merchant Center suspende por eso. Como sin la fecha el descuento se ve igual en Shopping, ponerla no ganaba nada y programaba una bomba. **Los dos interruptores se apagan el mismo día o ninguno.**

**Ojo con dónde vas a buscar esa razón.** El archivo que abrirás cuando busques la etiqueta —`server/routes/feeds/google.xml.get.ts:144-146`— **dice lo contrario**: recomienda ponerla («con ella Google sabe cuándo termina y no hay que acordarse de volver a tocar el feed»). Ese comentario quedó atrás y conviene corregirlo. La decisión que manda es la de `utils/campana.ts:37-41`. El origen, además, no fue una decisión de arranque sino un pendiente con Emilio que después se decidió no cerrar: `BITACORA.md:851-852` lo registra todavía como «Sigue pendiente el rango de fechas de la promo para `NUXT_PROMO_VIGENCIA`».

**El molde para arreglarlo ya está escrito.** `BANNER_TEMPORADA` sí se apaga solo: compara días de calendario en hora de México con `Intl` y `America/Mexico_City`, porque el servidor de Vercel corre en UTC y un banner atado a la hora del servidor se apagaría seis horas antes (`utils/campana.ts:97-115`). Está probado en `test/unit/campana.test.ts`.

**Estado real de ese banner hoy, para que no te confunda:** está **vencido pero encendido**. `BANNER_TEMPORADA` tiene `activo: true` y `hasta: '2026-09-16'` (`utils/campana.ts:77-85`), o sea que su ventana cerró el 16 de septiembre. No hace daño y no hay nada que arreglar: `bannerVigente` compara la fecha y devuelve `false`, así que el banner de fiestas patrias **ya no se ve en el home** (`utils/campana.ts:107-115`). Pero si abres el archivo y ves `activo: true`, vas a creer que sigue arriba. No lo apagues «por limpieza» sin entender que el que manda es el rango de fechas.

Acoplar la fecha de fin de `CAMPANA` a ese mismo mecanismo —y que el feed la derive de ahí, para que los dos no puedan discrepar— es el arreglo de fondo. No se hizo porque **cambia el comportamiento del precio que se cobra**, y esa es una decisión de Raúl, no técnica.

---

## 13. El envío gratis se medía antes del cupón

**Síntoma.** Una compra de $1,200 con un cupón de $300 decía «Envío GRATIS» en pantalla y Mercado Pago cobraba los $70 igual.

**Causa.** El carrito medía el umbral sobre el subtotal **antes** del cupón y el servidor **después**.

**Estado hoy: arreglado del lado autoritativo.** El servidor calcula sobre el subtotal ya con descuento, porque hacerlo antes regalaría envíos a quien cruce el umbral con un cupón grande sin haber pagado esa cantidad (`server/utils/costoEnvio.ts:27-45`). Detalle deliberado: ante una entrada inválida **se cobra**, porque equivocarse hacia «gratis» cuesta dinero en cada pedido y no se nota hasta el corte del mes (`:41-43`).

**Cómo evitarlo. Son dos cosas, no una.**

**Primera: las dos variables.** `NUXT_ENVIO_COSTO` es la que **cobra** (servidor, `server/utils/costoEnvio.ts:22-25`) y `NUXT_PUBLIC_ENVIO_COSTO` solo **pinta** (navegador). Tienen que tener el mismo valor o la pantalla miente (`nuxt.config.ts:121-125`). El monto vive en variable y no en código a propósito: es una decisión comercial de Raúl y Nancy y debe bastar con cambiarla en Vercel, sin desplegar (`server/utils/costoEnvio.ts:9-11`).

**Segunda, y esta está abierta hoy: la página `/envios` tiene los montos quemados y no cuadran.** `pages/envios.vue:20-22` anuncia por escrito «Envío gratis en compras desde $1,000 MXN», «Envío estándar: $99 MXN» y «Envío express (disponible): $199 MXN». Ese $99 **no sale de ninguna variable**: está escrito en el template. Y lo que de verdad se cobra son $70 — `BITACORA.md:865-866` registra que el 27 de agosto se pusieron en Vercel `NUXT_ENVIO_COSTO=70` y `NUXT_PUBLIC_ENVIO_COSTO=70`. **O sea que la pantalla ya miente hoy aunque las dos variables coincidan perfectamente.** El «envío express» directamente no existe en el código: `calcularEnvio` (`server/utils/costoEnvio.ts:35-45`) solo conoce un costo y un umbral, y el umbral de $1,000 está en `UMBRAL_ENVIO_GRATIS` (`:19`), también quemado.

Este es un renglón del **inventario de promesas** del incidente 11 —donde `/envios` ya aparece listado— que quedó sin cerrar. Hay que decidirlo: o el texto se deriva de la variable, o alguien lo corrige a mano cada vez que Raúl mueva el monto. Mientras no se decida, **cada cambio de `NUXT_ENVIO_COSTO` tiene que ir acompañado de una edición de `pages/envios.vue:18-23`**, y la mención del express hay que quitarla o construirla.

Contexto para que no lo «corrijas» hacia el otro lado: los $70 parejos son decisión comercial, no recuperación de costo. Nancy avisó que el costo real en Morelia llega a $140 según la distancia, y Raúl decidió dejarlo así: «El chiste es mover inventario y calar todo lo de la pagina».

---

## 14. Google Ads siempre va a reportar menos compras de las que hay

**Síntoma.** Ads reporta menos conversiones que ventas reales, y parece que la conversión está rota.

**Causa.** La conversión de compra se dispara **en el navegador**, en `/carrito?status=success` (`pages/carrito.vue:73-81`, que llama a `analytics.purchase` en `composables/useAnalytics.ts:55-77`). Con tarjeta el cliente regresa solo porque `auto_return: 'approved'` está puesto (`server/api/checkout.post.ts:135`). Pero **quien paga en OXXO o por transferencia confirma horas después y ya no vuelve a la página**, y lo mismo quien cierra la pestaña: esa venta entra al negocio y no se registra en Ads (`BITACORA.md:854-862`).

A eso súmale lo del incidente 10: **los pedidos por WhatsApp tampoco disparan la conversión**, porque `order-whatsapp.post.ts` no emite nada.

**Estado hoy: vivo y conocido.** El arreglo real es mandar las conversiones desde el servidor, donde el webhook de Mercado Pago sí sabe de todos los pagos, pero es un proyecto aparte que no vale la pena hasta que haya volumen.

**Cómo evitarlo.** No concluyas «la conversión está rota» desde el número de Ads. Dos cosas más que ya confundieron al equipo: Ads tarda horas en mostrar compras, y las compras de prueba que hizo Raúl **no llegaron por un anuncio**, así que no pueden atribuirse nunca (`BITACORA.md:847-851`). La prueba válida es que alguien dé clic a un anuncio y compre.

Detalle del código que evita el doble conteo: `purchase` solo se llama `if (cart.items.length)` y justo después se vacía el carrito, así que recargar la página de confirmación no vuelve a contar. Además la conversión lleva `transaction_id` por la misma razón.

---

## 15. Cada disparo a GoHighLevel cuesta dinero

**Advertencia: esto sube la factura sin que nada falle.**

**Causa.** Los triggers de GHL son premium y se cobran por uso. `/api/cart-save` se llama 8 a 10 veces por comprador, así que seguir cada guardado significaría 8 a 10 cobros por carrito (`server/utils/ghl.ts:12-17`).

**Estado hoy: acotado por un candado explícito.** `debeAvisarCarrito` limita el aviso a **una vez por episodio de carrito**, no una por guardado: solo se dispara en la transición de «sin carrito abandonado» a «con carrito abandonado» (`server/utils/ghl.ts:126-146`, usado en `server/api/cart-save.post.ts:77`). El candado es **pesimista a propósito**: si no se puede leer la tabla `abandoned_carts`, asume que ya avisó y se calla (`server/api/cart-save.post.ts:44` y `server/utils/ghl.ts:144`). Prefiere no avisar a cobrar de más.

**Cómo evitarlo.** No pruebes disparando webhooks reales en bucle; usa un receptor propio. Y si algún día se toca la tabla `abandoned_carts`, entiende que el candado dejará de avisar en lugar de avisar de más — ese es el comportamiento buscado, no un bug.

---

## 16. Vercel: una variable nueva solo entra con un despliegue nuevo

**Síntoma.** Pones una variable en el panel de Vercel, la integración sigue apagada, y no hay nada en los logs.

**Estado.** Esto está registrado como comportamiento observado el 27 de agosto (`BITACORA.md:867-868`): hubo que hacer un commit vacío para que entrara. **No es verificable desde el código del repo**, es comportamiento de la plataforma.

**Cómo evitarlo.** Después de agregar o cambiar una variable en Vercel, dispara un despliegue y espera a que quede en Ready antes de concluir que algo no funciona. Y antes de mandar a alguien externo a buscar un problema de su lado, corre `vercel env ls production` y comprueba que la variable que crees que está, está. Esa comprobación es la que cerró el diagnóstico del 28 de agosto.

---

## 17. La defensa que impide que Mercado Pago notifique a localhost (no la borres)

Este no es un incidente que haya pasado: es una falla silenciosa **muy cara** que está tapada por un archivo que parece innecesario. Lo pongo aquí porque el riesgo real es que alguien lo borre «para simplificar».

**Qué pasaría sin esa defensa.** El respaldo de `NUXT_PUBLIC_PUBLIC_BASE_URL` en `nuxt.config.ts:118` es `http://localhost:3000`, y está bien que lo sea: es el valor de desarrollo. Pero si esa variable llegara a faltar en producción —alguien la borra, un entorno nuevo, un deploy de preview sin ella— el respaldo tomaría el control y el sitio le diría a Mercado Pago que mande las notificaciones de pago **a localhost**.

Lo que cuesta, y por eso vale un archivo propio (el razonamiento está escrito en `server/utils/baseUrl.ts:1-21`): **el cobro sí se hace, pero el webhook no llega nunca.** Los pedidos se quedan en `pending` para siempre, nadie los marca como pagados, GHL no se entera, quien surte no sabe que hay algo que enviar, y el cliente que ya pagó aterriza en una página muerta. Todo eso sin un solo error en ningún lado. Es el modo de falla característico de este proyecto, en su versión más cara.

**Estado hoy: tapado.** `baseParaPasarela` (`server/utils/baseUrl.ts:26-35`) aplica la regla: **corriendo en Vercel, un localhost se trata como configuración rota** y se usa el dominio público del sitio, que sí está bien configurado (`:33`). En local `process.env.VERCEL` no existe y esto no cambia absolutamente nada. Lo usan tanto `/api/checkout` como `/api/stripe-checkout` (`server/api/stripe-checkout.post.ts:13`), y tiene prueba propia: `test/unit/base-url.test.ts`.

**Cómo evitarlo.** No sustituyas `baseParaPasarela(...)` por una lectura directa de `publicBaseUrl`. Se ve redundante y no lo es. El `sitio &&` de la línea 30-32 también es a propósito: si tampoco hay dominio público con qué sustituir, es mejor seguir con lo que hay que devolver una cadena vacía, que rompería la preferencia de pago de una forma más difícil de leer.

---

## 18. Stripe está construido, probado en código y apagado — nunca ha corrido en producción

**Por qué te lo digo.** En varias partes de este documento vas a leer «los tres caminos de pago (Mercado Pago, WhatsApp y Stripe)». Es cierto a nivel de código, y puede hacerte creer que Stripe es un camino ejercitado. **No lo es.**

**Qué existe.** `server/api/stripe-checkout.post.ts` crea el pedido `pending` en Supabase y una Checkout Session de Stripe con `metadata.order_id`, espejando el patrón de `/api/checkout` de Mercado Pago: precios autoritativos del servidor, cupón revalidado, y el webhook como autoridad sobre el estado final (`:1-7`). Y existe `server/api/stripe-webhook.post.ts`. Pasa por la misma puerta `createPendingOrder`, así que hereda el rechazo de agotados del incidente 9 y el freno por dirección incompleta.

**Cómo se enciende.** Con `NUXT_PUBLIC_STRIPE_ENABLED` en `"1"` (`nuxt.config.ts:119-120`, `.env.example:26-27`). Eso es lo único que decide si el botón «Pagar con tarjeta» aparece en el carrito: `pages/carrito.vue:19-20` lo lee y `:430` pinta el botón con un `v-if`. Hoy está vacío, así que el botón no existe para nadie. El propio código lo dice: «Este camino esta apagado hoy (NUXT_PUBLIC_STRIPE_ENABLED), pero el dia que lo enciendan tiene que pedir lo mismo que el otro» (`pages/carrito.vue:198-201`).

**Advertencia.** Encenderlo es meter un tercer camino de cobro que **nunca ha procesado un pago real**. Necesita además `NUXT_STRIPE_SECRET_KEY` y `NUXT_STRIPE_WEBHOOK_SECRET` puestas (`.env.example:17-24`); sin la primera el endpoint devuelve 400 (`server/api/stripe-checkout.post.ts:18-20`). Si lo prendes, prueba primero el ciclo completo —pago, webhook, pedido en `paid`, eventos de GHL— en un entorno que no sea producción. Y ojo con la asimetría del incidente 10: habría que verificar que el webhook de Stripe emita los mismos eventos que el de Mercado Pago, cosa que este documento no afirma.

---

## 19. Trampas chicas que ya mordieron una vez

- **Una subcategoría transversal nunca se enlaza con `?cat=`.** La categoría «Oral» vive en dos categorías a la vez (`lubricantes` y `parejas`). Si el enlace lleva `?cat=`, la tienda filtra primero por categoría y desaparece la mitad de los productos. El menú ya lo contempla: si `sub.category` es un arreglo, el enlace va solo con `?sub=` (`components/SiteHeader.vue:138-141`, con la lógica en `composables/useProducts.ts:63-73`).
- **El bloque de medios de pago vive en dos anchos muy distintos.** `.pay-icons` lo comparten la ficha (ancha) y la columna del carrito (angosta). Un separador que se veía perfecto en la ficha dejaba un punto suelto al inicio del segundo renglón en el carrito. **Verifica siempre en el carrito, no en la ficha.** De paso: esos «botones» de Visa, MC y demás siempre fueron texto; lo que hacía que la gente les picara era la caja (fondo, borde, radio y padding), no el color.
- **Las tarjetas de prueba de Mercado Pago no sirven aquí.** Solo funcionan con credenciales de prueba, y AMANTI corre con credenciales de producción, así que MP las lee como tarjetas reales y las rechaza. Se le pasaron a Raúl y perdió tiempo con ellas.
- **El modo test del webhook de MP existe, y su candado no se toca.** Está condicionado a `NODE_ENV !== 'production'` más un secreto compartido más un pago sintético (`server/api/mp-webhook.post.ts:54-61`). Es imposible de activar en un deploy de producción, y así tiene que quedarse. Los e2e lo usan pasando `NODE_ENV: 'test'` y `MP_WEBHOOK_TEST_MODE: '1'` en el webServer de Playwright (`playwright.config.ts:41-45`).
- **No escribas archivos del repo con un script que abra en modo `'w'`.** Un script así truncó `pages/tienda/[slug].vue` a 0 bytes al fallar después de abrir. Se recuperó de git. Desde entonces la práctica es escribir a un temporal y mover.

---

## La lección transversal: antes de culpar al servicio del otro, comprueba que tu propia herramienta esté sana

Esta aparece **dos veces** en la bitácora, con dos días de diferencia y dos herramientas distintas. Es la que hay que llevarse de todo el documento.

**La primera vez, el 27 de agosto.** Se le dijo a César que la URL de su workflow «se quedaba colgada» y que algo dentro de GoHighLevel se atoraba. Era falso. Lo que se colgaba era la terminal de la máquina de trabajo: `curl`, `cat` y `git status` también se atoraban. Verificado por otra vía, el webhook respondía en 0.54 segundos. Casi se manda a otra persona a perseguir un fantasma dentro de su sistema (`BITACORA.md:841-846`).

**La segunda vez, el 31 de agosto, y esta sí costó.** Se leyó el tramo de cuenta de GHL **de una captura de pantalla** y se comió un carácter: el id real lleva un cuatro, una O mayúscula y un uno, y se transcribió con un cero. Los cuatro primeros disparos, de las 16:55 a las 17:09, se fueron a una cuenta que no existe — y como ese endpoint contesta HTTP 200 a cualquier cosa, todo parecía sano. Por eso César no veía nada. Con la URL pegada **como texto**, el disparo llegó a la primera. Su trigger nunca estuvo mal. Fueron tres horas de trabajo de otra persona (`BITACORA.md:527-544`).

Hay una tercera variante del mismo error en el incidente de GA4: se presentó como prueba que no existía la cookie `_ga`, cuando lo que pasaba era que el navegador de esa máquina tiene un bloqueador que impide bajar el script de Google.

**Las reglas que salen de aquí:**

1. **Una URL, una llave o un id no se transcriben de una captura de pantalla.** Se piden como texto. `0`/`O`, `1`/`l`/`I` y `rn`/`m` son indistinguibles en una imagen, y el error resultante se ve exactamente como un problema del otro lado.
2. **Cuando algo no llega y el endpoint contesta 200 a todo, lo primero que hay que dudar es de la propia URL**, no del sistema ajeno.
3. **Antes de decirle a alguien que su sistema falla, comprueba la tuya:** que la terminal responde, que el navegador no está bloqueando, que la CPU no está saturada, que la variable de entorno está puesta. Verificar de tu lado cuesta minutos; mandar a otro a buscar cuesta horas suyas y credibilidad tuya.
4. **Y una pista sin confirmar no se presenta como descartada** — ni como confirmada. El 28 de agosto se dijo que la palabra «test» en la respuesta de GHL no probaba nada; el 31 por la tarde se dijo lo contrario y se mandó a César a mover su trigger para nada; el 31 por la noche, la prueba de la URL falsa cerró el asunto: **no probaba nada** (`BITACORA.md:493-525`). Tres vueltas para llegar al control obvio. Si una hipótesis se puede matar con un experimento de un minuto, hazlo antes de escribirle a nadie.

---

## Nota de higiene sobre credenciales

Esta sección es la más urgente del documento en una transferencia. Son dos cosas, y las dos piden acción, no discreción.

### 1. La contraseña que quedó escrita en el grupo de WhatsApp

`BITACORA.md:63-65` registra que el **31 de agosto la contraseña de `amanti.socialmedia@gmail.com` quedó escrita en el grupo de WhatsApp**. Esa cuenta es la que tiene **Google Ads, Tag Manager y Merchant Center**. Ese mismo día se pidió que se cambiara, y **no hay constancia de que se haya hecho**.

Trátalo como comprometido mientras nadie demuestre lo contrario:

- **Cámbiala**, y confirma por escrito que se cambió.
- Prende verificación en dos pasos en esa cuenta si no la tiene.
- Revisa las sesiones activas y los accesos delegados: `BITACORA.md:54-62` documenta que Emilio dio accesos a Ads y Merchant Center el 31 de agosto, que **Tag Manager sigue sin dueño conocido** («google tag manager no tengo yo, me confundí con otra cuenta») y que la invitación a GoHighLevel se reenvió el 8 de septiembre. Quién tiene acceso hoy a cada panel **no se puede verificar desde el repo**; hay que entrar y listarlo.

Quien reciba el repo y el historial del grupo recibe también esa contraseña. Cambiarla es el primer paso de la entrega, no el último.

### 2. Los ids de un Inbound Webhook vivo estuvieron en texto plano dentro del repo

Hasta el 18/09, `BITACORA.md` traía el identificador de la cuenta de GHL (línea 477) y el del trigger de aviso de pedido rotulado «(viva)» (línea 586). Juntos arman la URL completa. Son llaves: quien las tenga puede disparar el workflow y generar cobro, que es exactamente lo que advierten `server/utils/ghl.ts:50-56` y `.env.example:47-49`.

**«No lo copies a otros documentos» no protegía de esto, y hay que ser claro en por qué.** `.vercelignore:6` excluye `BITACORA.md` del **despliegue**, no de git: `.gitignore` no la menciona en ninguna parte, así que **el archivo viaja con el repo**.

**Estado a la entrega:** el 18/09 los dos ids se sustituyeron en la versión vigente de la bitácora. **Eso no basta, porque siguen en el historial de git.** La instrucción correcta es **rotación, no discreción**: que César cree una URL nueva para el trigger de aviso de pedido —pedida **como texto**— y comparada contra la vieja para confirmar que cambió, porque volver a guardar no siempre la cambia (incidente 2). Después actualiza `NUXT_GHL_WEBHOOK_AVISO_PEDIDO` en Vercel y dispara un despliegue (incidente 16). El procedimiento completo está en `13-accesos-y-cuentas.md`, grupo C.

### 3. Lo que sí está bien y hay que mantener así

`.env` está fuera de git y `.env.example` sí se versiona (`.gitignore:5-7`), con nombres de variables y cero valores. Mantén esa separación: **en este repo no se escribe el valor de un secreto en ningún archivo**, ni siquiera en un comentario, ni siquiera «temporalmente».

---

## Lo que no se puede verificar desde el repo

Todo lo de abajo es **sin verificar desde el repo**. Son cosas que viven en paneles de terceros y hay que comprobarlas entrando:

- **Si la contraseña de `amanti.socialmedia@gmail.com` ya se cambió** después de la fuga del 31 de agosto, y quién tiene acceso hoy a Google Ads, Tag Manager, Merchant Center y GoHighLevel. Es lo primero de la lista.
- Qué variables de entorno están cargadas hoy en Vercel producción, y en particular si `NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO` ya existe (incidente 11) y si `NUXT_ENVIO_COSTO` y `NUXT_PUBLIC_ENVIO_COSTO` coinciden entre sí **y con lo que dice `/envios`** (incidente 13).
- Si `NUXT_PROMO_VIGENCIA` está puesta. Si lo está y la campaña sigue encendida después de esa fecha, hay riesgo de suspensión en Merchant Center (incidente 12).
- Si las URLs de Inbound Webhook que hoy tiene Vercel siguen vivas del lado de GoHighLevel. Desde fuera es indistinguible; solo lo dice el historial de ejecuciones del workflow.
- El estado de los workflows de GHL —postcompra, carrito abandonado, aviso a quien surte, aviso de envío— y si sus plantillas ya tienen cuadrados los campos dinámicos. **Y si existe o no un workflow de reactivación**: el sitio tiene la ranura `reactivacion` declarada y nunca la dispara (incidente 10), así que lo que haya de reactivación vive enteramente del lado de César.
- Si GA4, Google Ads y Merchant Center están recibiendo datos hoy, y si la conversión de compra se llegó a verificar con una venta real atribuible a un anuncio.
- El estado del módulo de Pixel de Meta dentro del formulario embebido de GoHighLevel (hallazgo del 10 de septiembre: el iframe descarga `fbevents.js` aunque la persona rechace cookies, y según el HTML del propio formulario no tiene Pixel asignado).
- El contenido real de la base de Supabase: pedidos, `abandoned_carts`, migraciones aplicadas. Y los valores de `SB_URL`/`SB_ANON`/`SB_SVC`, que salen del panel de Supabase y sin los cuales tres specs e2e se saltan solos.
- Cómo se dispara un despliegue (rama conectada, CLI, o lo que sea): en el repo no hay configuración de build ni de CI, `vercel.json` solo trae redirects. Y que Vercel solo aplique una variable nueva con un despliegue nuevo (incidente 16) viene de lo observado y registrado en `BITACORA.md`, no del código.
- Si las credenciales de Stripe (`NUXT_STRIPE_SECRET_KEY`, `NUXT_STRIPE_WEBHOOK_SECRET`) existen en algún entorno. El camino está apagado y nunca ha corrido en producción (incidente 18).
