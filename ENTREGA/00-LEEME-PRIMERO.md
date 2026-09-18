# Entrega de la tienda AMANTI

**Fecha de corte: 18 de septiembre de 2026.**
Todo lo que dice este paquete se verificó contra el código y contra los paneles ese día.

Esto es el traspaso completo de <https://amanti.mx> a quien se quede a cargo. Está escrito para
**una persona que sabe programar pero que nunca ha visto este proyecto**, y dando por hecho que
**no va a poder preguntarle nada a quien lo construyó**. Si algo aquí solo se entiende preguntando,
está mal escrito: repórtalo como defecto de esta documentación.

---

## Lo primero: cuatro cosas que no pueden esperar

Están en orden de qué te muerde primero. Las cuatro vienen explicadas a detalle más adelante; aquí
va el aviso para que no te enteres tarde.

### 1. El 30 de septiembre hay que apagar el 40% — faltan 12 días

`utils/campana.ts` tiene una campaña de **40% de descuento en todo el catálogo**, encendida con un
booleano manual. **No tiene caducidad.** El equipo acordó que terminaba el 30 de septiembre de 2026,
pero nada en el código lo hace cumplir: si nadie entra a ponerlo en `false`, la tienda sigue
regalando el 40% indefinidamente y ningún sistema avisa.

Y no se apaga solo: **la campaña y el feed de Google Shopping tienen que apagarse el mismo día.**
Si quedan desfasados, Google anuncia un precio y la tienda cobra otro, y Merchant Center suspende
los productos por discrepancia de precio.

→ Receta paso a paso en `10-operacion.md`. Contexto de por qué está hecho así en `02-catalogo.md`.

### 2. Nada de la infraestructura está a nombre del cliente

| Pieza | Dónde vive hoy |
|---|---|
| Repositorio | `github.com/memorx/amanti-store` — cuenta personal del desarrollador saliente |
| Hosting | Vercel, equipo `izalith` — empresa del desarrollador saliente |
| Base de datos | Supabase — por confirmar bajo qué organización |
| Google Analytics 4 | Bajo la cuenta personal `memo_rx` del desarrollador saliente |

Mientras eso siga así, AMANTI no puede desplegar, no puede revocar accesos y no es dueña de su
propio sitio. **Es lo primero que hay que resolver**, y hay un orden correcto para hacerlo sin
tumbar el sitio.

**GA4 es el único de estos traspasos que no tiene vuelta atrás.** Primero se nombra administrador
a una cuenta de AMANTI y después se retira la del saliente. Al revés, se pierde la propiedad y el
histórico de medición, que no se recupera.

→ Procedimiento completo en `14-traspaso-de-infraestructura.md`.

### 3. Hay que rotar todos los secretos

Es un corte limpio. Todo token, llave, contraseña y URL de webhook que haya pasado por manos del
desarrollador saliente se rota. Hay un orden para hacerlo sin dejar el sitio roto a media rotación,
y una trampa: en Vercel una variable nueva **no entra en vigor hasta que hay un despliegue nuevo**.

→ Lista y orden en `13-accesos-y-cuentas.md`.

### 4. El aviso de envío al cliente está emitiendo al vacío

Verificado el 18 de septiembre contra Vercel: producción tiene 15 variables de entorno, y entre
ellas **no está** `NUXT_GHL_WEBHOOK_PEDIDO_ENVIADO`.

Cuando Nancy marca un pedido como enviado, el sitio dispara el evento
(`server/api/pedido-enviado.post.ts:44`) y no tiene a dónde mandarlo. Importa de verdad: **la página
`/envios` le promete por escrito al cliente que le va a avisar cuando su pedido salga, y hoy no le
llega nada.**

Tampoco está `NUXT_GHL_WEBHOOK_REACTIVACION`, pero esa ausencia **no rompe nada**: el evento está
declarado en `server/utils/ghl.ts` y ningún código lo emite. La reactivación la corre César desde
GoHighLevel con su propio calendario. No la confundas con un hueco.

→ Detalle en `04-automatizaciones-ghl.md` y en `12-pendientes-y-riesgos.md`.

---

## Antes de buscarlo: la tienda no tiene panel de administración

No hay un login de administrador como el de Wix, WordPress o Shopify, y no es un olvido: el sitio
está hecho así. **La administración está repartida en varios lugares, cada uno con su acceso:**

| Lo que quieres hacer | Dónde se hace | Qué acceso necesitas |
|---|---|---|
| Ver qué pedidos surtir y marcarlos enviados | `amanti.mx/pedidos` | El PIN de la pantalla (lo tiene Nancy; vive en `NUXT_PEDIDOS_PIN`) |
| Dar de alta productos, cambiar precios, marcar agotados | Editar `data/products.json` en el repo y desplegar | GitHub con permiso de escritura |
| Publicar un artículo del blog | Editar `data/articles.json` y desplegar | GitHub |
| Encender o apagar la promoción | Editar `utils/campana.ts` y desplegar | GitHub |
| Cambiar el costo del envío | Dos variables en Vercel, y redesplegar | Vercel |
| Ver pedidos, clientes y cupones en crudo | Panel de Supabase | Supabase |
| Dominio, despliegues, variables | Panel de Vercel | Vercel |
| Cobros y reembolsos | Panel de Mercado Pago | La cuenta de Mercado Pago |
| Correos y automatizaciones | GoHighLevel | Lo opera César |

Cada receta está paso a paso en `10-operacion.md`.

**Por qué hoy parece que no hay accesos:** GitHub, Vercel y Supabase siguen en cuentas del
desarrollador saliente (punto 2 de arriba). Nadie de AMANTI puede administrar la tienda hasta que se
haga el traspaso de `14-traspaso-de-infraestructura.md`. Esa es la llave de todo lo demás.

---

## Cómo está armado el paquete

Puedes leerlo de corrido, pero no hace falta. Según lo que necesites:

**Si vas a tocar código mañana** → `01`, `07`, `08`, `09`. Con eso corres el proyecto, entiendes las
variables, sabes desplegar y sabes probar.

**Si te acaban de reportar algo roto** → `11-fallas-conocidas.md` primero. Es un catálogo de
síntoma → causa → arreglo con todo lo que ya salió mal en este proyecto. Hay buena probabilidad de
que lo tuyo ya esté ahí.

**Si te pidieron un cambio de negocio** (subir un producto, apagar una promoción, cambiar el
envío) → `10-operacion.md`. Son recetas numeradas.

**Si vas a hacer el traspaso administrativo** → `13`, `14` y `15`.

**Tu primera semana** → `15-checklist-de-paneles.md`. Es la lista de todo lo que solo se puede
confirmar entrando a un panel, agrupada por panel.

| Archivo | De qué trata |
|---|---|
| `01-panorama.md` | Qué es el sistema, stack, mapa del repo, cómo correrlo de cero |
| `02-catalogo.md` | Catálogo, precios, subcategorías, buscador y la campaña del 40% |
| `03-pagos-y-pedidos.md` | El camino del dinero: carrito → pasarela → webhook → pedido pagado |
| `04-automatizaciones-ghl.md` | Los webhooks de GoHighLevel y el contrato de datos de cada evento |
| `05-medicion-y-consentimiento.md` | GA4, Ads, Pixel, Clarity, cookies y el feed de Google |
| `06-datos-supabase.md` | Modelo de datos, llaves, respaldos, cuentas de cliente |
| `07-variables-de-entorno.md` | Cada variable: para qué es y qué se rompe si falta |
| `08-despliegue.md` | Cómo publicar, cómo revertir y las trampas del build |
| `09-pruebas.md` | Cómo correr las suites y en cuáles no se puede confiar |
| `10-operacion.md` | Recetas paso a paso del día a día |
| `11-fallas-conocidas.md` | Playbook de incidentes reales con su causa verificada |
| `12-pendientes-y-riesgos.md` | La deuda, sin maquillar, con fechas y dueños |
| `13-accesos-y-cuentas.md` | Inventario de servicios y la rotación de secretos del corte |
| `14-traspaso-de-infraestructura.md` | Mover Vercel, Supabase, el repo y el DNS sin caídas |
| `15-checklist-de-paneles.md` | Lo que el repo no puede decir: la lista por panel para confirmar |

---

## Los otros dos documentos del repo

**`BITACORA.md`** es el registro histórico del proyecto: qué se hizo, qué se decidió y **por qué**,
día por día. No es documentación de referencia —para eso está este paquete— pero cuando te topes
con una decisión que parece absurda, ahí está la razón. Vale la pena leerla en diagonal una vez.

**`SETUP.md` está desactualizado y es peligroso leerlo como verdad.** Describe el proyecto de sus
primeras semanas: habla de cupones que ya no existen, dice que no hay descuentos por producto
cuando hay una campaña global activa, y llama «stub» a la página de cuenta, que hoy es funcional.
Se conserva por historia. **Lo vigente es `01-panorama.md`.**

---

## Quién es quién

| Persona | Papel |
|---|---|
| **Raúl** | Dueño. Decisiones comerciales y de precio |
| **Nancy** | Surte los pedidos. Trabaja desde `amanti.mx/pedidos` con un PIN |
| **César** | Automatizaciones de marketing en GoHighLevel. Correos, formularios, flujos |
| **Emilio** | Google Ads y Merchant Center |

Lo importante para ti: **César y Emilio son proveedores externos con sus propios paneles.** Varias
cosas que parecen fallas del sitio se arreglan de su lado, no del tuyo, y viceversa. La frontera
exacta está en `04-automatizaciones-ghl.md` y `05-medicion-y-consentimiento.md`.

---

## Qué NO viene en este paquete

**Ningún valor de secreto.** No hay tokens, llaves, contraseñas ni URLs de webhook con su
identificador. Lo que hay son los **nombres** de las variables y dónde vive cada una. Eso es
deliberado: este paquete se puede copiar, mandar por correo y guardar en el repositorio sin exponer
nada. Los valores se entregan por un canal aparte, y de todos modos **se rotan todos** el día del
corte (`13-accesos-y-cuentas.md`).

**Nada de los paneles de terceros.** Lo que esté cargado dentro de GoHighLevel, Google Ads o
Merchant Center no se puede leer desde el repositorio. Donde hizo falta, las secciones lo marcan
como «sin verificar desde el repo» en lugar de suponerlo. Esas marcas están juntas, sin repetir y
agrupadas por panel, en `15-checklist-de-paneles.md`: trátalas como pendientes de confirmar, no
como huecos de redacción.

---

## Estado verificado el 18 de septiembre de 2026

- **Producción responde.** `/`, `/tienda`, `/carrito`, `/pedidos` y `/feeds/google.xml` → HTTP 200.
- **Pruebas unitarias: 268 en verde, 26 archivos**, corrida limpia de 30 segundos
  (`npx vitest run --pool=threads --no-file-parallelism`). Las de navegador se corren aparte y
  algunas se saltan sin credenciales; ver `09-pruebas.md`.
- **Catálogo:** 152 productos, ninguno marcado como agotado.
- **Campaña:** 40% encendida. Fecha acordada de fin, 30 de septiembre.
- **Banner de temporada:** caducó solo el 17 de septiembre, como estaba programado. Ese sí tenía
  fecha de fin en el código; la campaña no.
- **Vercel producción:** 15 variables de entorno cargadas. Falta la del aviso de envío (punto 4).
- **Árbol de trabajo:** limpio salvo dos archivos sin seguimiento
  (`AMANTI-Automatizaciones-2026-09-03.html` y `.pdf`), que son un documento impreso para el
  equipo de marketing, no código.
