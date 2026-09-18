# Base de datos y cuentas

Toda la parte con estado de la tienda —cuentas de cliente, pedidos, direcciones, reseñas, favoritos y carritos abandonados— vive en un proyecto de **Supabase** (Postgres + Auth). El sitio habla con él por dos caminos distintos y con dos llaves distintas, y entender esa separación es lo primero que hay que tener claro antes de tocar nada.

El módulo que conecta Nuxt con Supabase es `@nuxtjs/supabase`, declarado en `nuxt.config.ts:6` y como dependencia en `package.json:16`.

---

## 1. Antes que nada: cómo entrar al proyecto de Supabase

Casi todo lo que esta sección te pide hacer —sacar el DDL de las cinco tablas que faltan, revisar las políticas de RLS, confirmar si Google OAuth está encendido, revisar las *Redirect URLs*, montar respaldos— se hace **desde el dashboard de Supabase**, no desde el repo. Sin acceso a ese dashboard no puedes empezar.

Lo que sí se puede afirmar leyendo el repo:

- El proyecto se identifica por `SUPABASE_URL`, con la forma `https://<ref>.supabase.co` (`SETUP.md:36`, `.env.example:35`). El `<ref>` es el identificador del proyecto y **sale del valor de esa variable**, que vive en Vercel. No está escrito en ningún archivo del repo.
- El paquete de entrega reconoce que la titularidad de la infraestructura está sin cerrar: `ENTREGA/00-LEEME-PRIMERO.md` (punto 2) lista la base de datos como «Supabase — por confirmar bajo qué organización», y remite el procedimiento a `14-traspaso-de-infraestructura.md`. El inventario de accesos y la rotación de secretos están en `13-accesos-y-cuentas.md`.

**Sin verificar desde el repo:** bajo qué organización de Supabase vive el proyecto, cuál es su *project ref*, qué plan tiene contratado, y quién tiene el rol de Owner para poder invitarte. Eso se resuelve con `13-accesos-y-cuentas.md` y `14-traspaso-de-infraestructura.md`, no aquí.

Hasta que tengas al menos rol de **Developer** en esa organización, trata la sección 2 como lectura, no como tarea.

---

## 2. Advertencia que va antes que todo lo demás

**El repo no contiene el esquema completo de la base.** De las **nueve** tablas que el código usa, solo **cuatro** se crean desde un archivo del repo: `leads`, `wishlist_items`, `reviews` y `abandoned_carts`. Las otras cinco —`orders`, `order_items`, `addresses`, `profiles` y `coupons`— se usan a diario desde el código pero **no hay una sola línea de `create table` que las cree**. La búsqueda de `create table` en todo el repo pega exactamente siete veces, todas sobre esas mismas cuatro tablas: `supabase/all.sql:9,22,39,64`, `supabase/reviews.sql:9`, `supabase/wishlist.sql:9` y `supabase/abandoned-carts.sql:12`.

Eso significa tres cosas duras:

1. **La base de producción no se puede reconstruir desde este repo.** Si el proyecto de Supabase se pierde, el esquema de pedidos, direcciones, perfiles y cupones no está escrito en ningún lado que se pueda leer aquí.
2. **Las políticas de seguridad a nivel de fila (RLS) de esas cinco tablas tampoco están en el repo**, y el código del panel de cuenta depende de que existan. Ver la sección 9.
3. **Tampoco está el trigger que crea la fila de `profiles`** al darse de alta un usuario. En la sección 4 te dejo el DDL mínimo para reponerlo, porque es lo único que destraba una trampa muy fea de la sección 8.

La primera tarea de quien reciba esto debería ser sacar el DDL real desde Supabase y meterlo al repo. La sección 11 explica cómo.

Tampoco hay migraciones versionadas: existe `supabase/.temp/cli-latest` (dice `v2.116.0`, o sea que el CLI de Supabase se usó alguna vez), pero **no hay `supabase/config.toml` ni carpeta `migrations/`** — la carpeta `supabase/` tiene ocho `.sql` y nada más. Los `.sql` se corren **a mano** en Supabase → SQL Editor, tal como lo dicen los encabezados de los **cinco archivos originales** (`all.sql:2-3`, `reviews.sql:3`, `wishlist.sql:3`, `abandoned-carts.sql:3`, `orders-gift.sql:3`); los tres incrementales —`orders-envio.sql`, `addresses-colonia.sql` y `resenas-invitado.sql`— no dicen en ningún lado dónde correrse, pero se corren igual. La bitácora confirma esa práctica: `BITACORA.md:870` anota qué SQL se corrió ese día.

---

## 3. El modelo de datos, tabla por tabla

### Tablas que sí se crean desde el repo

| Tabla | Archivo que la crea | Qué guarda |
|---|---|---|
| `leads` | `supabase/all.sql:9-19` | Correos capturados por el modal de bienvenida. **Ya no se escribe desde el sitio**: `components/WelcomeModal.vue:4-7` explica que la captura se movió a GoHighLevel el 12-ago. Queda como histórico. |
| `wishlist_items` | `supabase/wishlist.sql:9-15` y `supabase/all.sql:22-28` | Favoritos sincronizados a la cuenta. `user_id` + `slug`, con `unique (user_id, slug)`. |
| `reviews` | `supabase/reviews.sql:9-18` y `supabase/all.sql:39-48` | Reseñas de producto. Modificada después por `supabase/resenas-invitado.sql`. |
| `abandoned_carts` | `supabase/abandoned-carts.sql:12-21` y `supabase/all.sql:64-73` | Snapshot del carrito de quien no terminó de comprar. |

**`reviews` en detalle.** Nace con `user_id not null` y `unique (user_id, product_slug)` (`supabase/reviews.sql:11,17`). El 27-ago-2026, `supabase/resenas-invitado.sql` la cambió:

- `user_id` deja de ser obligatorio (`resenas-invitado.sql:16`), porque una reseña de invitado no tiene usuario.
- Se agrega `order_id uuid references public.orders(id) on delete set null` (`resenas-invitado.sql:19-20`), para saber de qué compra salió.
- Se crea un índice único **parcial** `reviews_order_slug_uidx on (order_id, product_slug) where order_id is not null` (`resenas-invitado.sql:28-30`).

El porqué del índice parcial está escrito en el propio archivo (`resenas-invitado.sql:22-27`) y vale la pena repetirlo: en Postgres **los NULL no chocan entre sí**, así que el índice viejo `(user_id, product_slug)` deja de servir de candado en cuanto `user_id` puede ser nulo — un invitado podría mandar cuantas reseñas quisiera. El índice parcial cubre justo las filas de invitado.

**`abandoned_carts` en detalle.** Tiene `unique (email)` (`abandoned-carts.sql:20`, y `all.sql:72`), o sea **un solo carrito vivo por correo**. Columnas: `user_id` (nullable, `on delete set null`), `email`, `items jsonb`, `total numeric`, `recovered boolean`, `updated_at`. Esa fila no es solo un registro: es el **candado antirrepetición** de los avisos a GoHighLevel. Ver la advertencia de dinero en la sección 14.

### Tablas que el código usa pero el repo NO crea

Estas columnas están reconstruidas leyendo el código que las escribe y las lee. Son fiables en el sentido de que el código fallaría si no existieran, pero **no son el DDL real** (tipos exactos, defaults, constraints e índices no se pueden ver desde aquí).

**`orders`** — la tabla central del negocio.

| Columna | De dónde se sabe |
|---|---|
| `id` (uuid) | `server/utils/orders.ts:140-141` |
| `user_id` (nullable) | `server/utils/orders.ts:131`; `test/e2e/orders.spec.ts:11,21` incluye una sonda que inserta un pedido **sin** `user_id` para averiguar si los pedidos de invitado están habilitados |
| `status` | se inserta como `'pending'` (`orders.ts:132`); los webhooks lo mueven a `'paid'`, `'cancelled'` o `'refunded'` (mapeo en `mp-webhook.post.ts:20-28` y `stripe-webhook.post.ts:44-55`; transiciones permitidas en `mp-webhook.post.ts:36-40` y `stripe-webhook.post.ts:23-27`). **Los cuatro valores son `pending` · `paid` · `cancelled` · `refunded`**, y las transiciones son solo hacia adelante |
| `total`, `currency` | `orders.ts:133-134` (`currency` siempre `'MXN'`) |
| `payment_method` | `orders.ts:135` — `'mercadopago' \| 'whatsapp' \| 'stripe'` |
| `shipping_address` (jsonb) | `orders.ts:136`; se lee como objeto con `line1`, `colonia`, `line2`, `city`, `state`, `postal_code`, `recipient`, `phone`, `email` (`pages/pedidos.vue:52-58`, `server/api/pedido-enviado.post.ts:39`) |
| `coupon_code`, `discount_amount` | `orders.ts:137-138` |
| `created_at` | `server/api/pedidos.get.ts:31,33` |
| `mp_payment_id` | `server/api/mp-webhook.post.ts:106,131` |
| `gift` (jsonb) | la agrega `supabase/orders-gift.sql:10` |
| `shipped_at`, `tracking` | las agrega `supabase/orders-envio.sql:10-14` |
| `stripe_session_id`, `stripe_payment_intent_id` | opcionales, *best-effort*: `server/api/stripe-checkout.post.ts:91`, `server/api/stripe-webhook.post.ts:135`, documentadas como opcionales en `SETUP.md:60` |

> **Ojo al reconstruir el DDL de `orders`.** Si le escribes un `CHECK` a `status` con tres valores, los dos webhooks empiezan a fallar **en silencio** ante cualquier pago rechazado, cancelado o expirado: `mapStatus` de MercadoPago manda `'rejected'` y `'cancelled'` a `'cancelled'` (`mp-webhook.post.ts:23-24`) y Stripe hace lo mismo con `async_payment_failed` y `expired` (`stripe-webhook.post.ts:51-52`). Además `'cancelled'` es un **estado previo válido** para llegar a `'paid'` (`ALLOWED_PREV`, `mp-webhook.post.ts:37`, `stripe-webhook.post.ts:24`), porque un reintento aprobado en la misma preferencia llega después de un primer intento rechazado. Son cuatro valores, no tres.

**`order_items`** — el snapshot de lo que se compró, con el precio del momento. Las columnas salen completas de `server/utils/orderItems.ts:94-104`: `order_id`, `product_slug`, `product_name`, `image_url`, `unit_price`, `quantity`, `line_total`. Además tiene `id`, porque `server/api/stripe-webhook.post.ts:114` cuenta con `select('id', { count: 'exact', head: true })`.

Es un snapshot **a propósito**: `server/utils/orderItems.ts:2-3` explica que el precio autoritativo sale del catálogo del servidor (`data/products.json`) y nunca del cliente, y el nombre se congela en la fila para que cambiar el catálogo después no reescriba pedidos viejos.

**`addresses`** — `user_id`, `label`, `recipient`, `phone`, `line1`, `colonia`, `line2`, `city`, `state`, `postal_code`, `country`, `is_default`, `id`, `created_at` (`components/account/AccountAddresses.vue:73-86` para la escritura; `:37` ordena por `created_at`, así que esa columna existe).

La columna `colonia` la agrega `supabase/addresses-colonia.sql:19-20`, y el archivo trae el porqué (`addresses-colonia.sql:3-8`): antes la colonia se escribía dentro de `line2` junto con el interior y las referencias, y en México la colonia es parte de la dirección postal —la paquetería la usa para rutear—, no una referencia. Las direcciones anteriores a ago-2026 siguen con la colonia dentro de `line2` y nadie las migró (`addresses-colonia.sql:15-17`).

**`profiles`** — `id` (= el id del usuario de `auth.users`), `email`, `full_name`, `phone`, `updated_at` (`components/account/AccountProfile.vue:22-26,46-53`).

**`coupons`** — `code`, `type`, `value`, `min_subtotal`, `active`, `expires_at`, `max_uses`, `used_count`. La forma de la fila está declarada como interfaz en `server/utils/coupons.ts:9-18`, y la consulta que la lee es `server/utils/orders.ts:99-101`.

### Cupones: cómo están operando hoy

Tres cosas que hay que saber antes de tocar esa tabla:

1. **Hoy el servidor NO acepta ningún cupón.** `validateCoupon` corta en la primera línea si `CUPONES_ACEPTADOS` es falso (`server/utils/coupons.ts:61-67`), y `CUPONES_ACEPTADOS = !CAMPANA.activa` (`utils/campana.ts:138`), con `CAMPANA.activa = true` (`utils/campana.ts:43`). La razón está escrita ahí mismo: el catálogo ya viene con el 40% aplicado y un cupón encima dejaría la venta en 49% de descuento sin que nadie lo decidiera. Los cupones **siguen vivos en la tabla**; lo que está apagado es aceptarlos al cobrar. Se reactivan solos cuando se apague la campaña.
2. **Qué cupones existen: no se puede saber desde el repo.** `SETUP.md:40` nombra `AMANTI15` (MercadoPago) y `AMANTI25` (Aplazo), y `utils/campana.ts:118-124` menciona que `AMANTI15` «sigue vivo en Supabase». Pero el propio paquete advierte que `SETUP.md` está desactualizado y que justamente «habla de cupones que ya no existen» (`ENTREGA/00-LEEME-PRIMERO.md`, «Los otros dos documentos del repo»). **La lista real solo se lee haciendo `select * from public.coupons` en el dashboard.** Sin verificar desde el repo.
3. **`used_count` se incrementa *best-effort* y nunca tumba un pedido.** `incrementCouponUsage` (`server/utils/orders.ts:47-67`) lee `used_count`, escribe `used_count + 1` con **compare-and-set** (`.eq('used_count', current)`, o `.is('used_count', null)` la primera vez) y reintenta hasta tres veces si perdió la carrera. Si de plano no lo logra, solo deja un `console.warn` (`:66`) y sigue. Se llama **después** de guardar los artículos (`orders.ts:157`), a propósito: el pedido ya está creado y no debe fallar por un contador. Consecuencia práctica: **`used_count` puede quedarse corto** bajo concurrencia alta, así que `max_uses` es un tope aproximado, no una garantía dura. Si algún día necesitas que lo sea, eso se resuelve con una función en Postgres, no aquí.

---

## 4. En qué orden se corren los `.sql`

Primero, una aclaración que ahorra confusión: **`all.sql` es la unión de otros cuatro archivos.** Contiene `leads`, `wishlist_items`, `reviews`, la columna `gift` de `orders` y `abandoned_carts` (`supabase/all.sql:5`). O sea que `reviews.sql`, `wishlist.sql`, `orders-gift.sql` y `abandoned-carts.sql` son redundantes si corres `all.sql`. Existen porque se fueron agregando uno por uno y luego se juntaron. `all.sql` es idempotente: se puede correr varias veces sin romper nada (`all.sql:3-4`).

Orden si hubiera que levantar una base de cero:

| # | Paso | Nota |
|---|---|---|
| 0 | **Crear `profiles`, `addresses`, `orders`, `order_items` y `coupons`, con sus políticas RLS y el trigger que crea el perfil al darse de alta un usuario** | **No está en el repo.** Sin esto, el paso 1 falla. Abajo va el trigger; el resto hay que volcarlo del proyecto real. |
| 1 | `supabase/all.sql` | Crea `leads`, `wishlist_items`, `reviews`, `abandoned_carts` y agrega `orders.gift` |
| 2 | `supabase/orders-envio.sql` | Agrega `shipped_at` y `tracking` a `orders` |
| 3 | `supabase/addresses-colonia.sql` | Agrega `colonia` a `addresses` |
| 4 | `supabase/resenas-invitado.sql` | Necesita que `reviews` **y** `orders` ya existan |

> **Trampa de orden.** `all.sql` no se puede correr sobre una base vacía: en la línea `supabase/all.sql:61` hace `alter table public.orders add column if not exists gift jsonb`. El `if not exists` aplica a la *columna*, no a la tabla — si `orders` no existe, esa sentencia revienta y el script se corta a la mitad.

> **Trampa de despliegue.** `supabase/addresses-colonia.sql:10-13` lo dice tal cual: *corre esto ANTES de desplegar el código que usa la columna*. La lectura del panel de cuenta hace `select('*')` y aguanta sin la columna, pero el alta de direcciones (`AccountAddresses.vue:79`) y el snapshot del pedido (`server/utils/orders.ts:24`) la nombran explícitamente, y sin ella fallan. Mismo criterio para cualquier `.sql` futuro: **base primero, deploy después**.

Los pasos 2 y 4 son los que se corrieron el 27-ago-2026 en producción, según `BITACORA.md:870`.

**Qué promete cada archivo incremental, y qué no.** `orders-envio.sql` y `addresses-colonia.sql` son aditivos, nullables, sin default y no destructivos, y cada uno lo declara en su encabezado (`orders-envio.sql:7-8`, `addresses-colonia.sql:15-17`). **`resenas-invitado.sql` es distinto y su encabezado no promete nada de eso** (`resenas-invitado.sql:1-13` explica el *por qué* del cambio y por qué no se abre RLS a `anon`, y nada más): quita el `not null` de `reviews.user_id` (`:16`) y crea un índice UNIQUE parcial (`:28-30`) que **falla si la tabla ya trae filas duplicadas en `(order_id, product_slug)`**. El `if not exists` protege contra re-ejecución, no contra datos que ya chocan. Revisa esos duplicados antes de correrlo:

```sql
select order_id, product_slug, count(*)
from public.reviews
where order_id is not null
group by order_id, product_slug
having count(*) > 1;
```

### El trigger de `profiles` que falta

`composables/useAuth.ts:10-16` manda `full_name` y `phone` en `options.data` del `signUp`, que en Supabase caen en `raw_user_meta_data`, y el comentario dice que de ahí los toma «el trigger». Ese trigger **no está en el repo**. Sin él, un usuario nuevo se registra pero nunca aparece en `profiles`, y eso dispara la trampa silenciosa de la sección 8 («Perfil actualizado ✓» sin guardar nada).

Este es el mínimo que lo destraba en un entorno nuevo. **No es el DDL de producción** —no se puede leer desde el repo—, es una reconstrucción a partir de lo que el código espera. Cuando tengas acceso al dashboard, vuelca el real y compáralo:

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, updated_at)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

Tres decisiones ahí que no son adorno:

- **`security definer`** porque el insert en `auth.users` no corre con un rol que pueda escribir en `public.profiles`.
- **`set search_path = public`** porque una función `security definer` sin `search_path` fijo es un agujero conocido de Postgres: quien controle el `search_path` de la sesión puede hacer que `profiles` resuelva a otra tabla.
- **`on conflict (id) do nothing`** porque si el trigger lanza, **el registro entero falla**: el usuario no se crea y el formulario de alta se rompe. Es preferible un perfil que no se creó a un alta que revienta.

Pruébalo a mano después de correrlo: crea un usuario, confirma que aparezca su fila en `profiles`, edítala desde el panel de cuenta y recarga.

---

## 5. Dónde viven las variables de entorno

**Todas las variables de producción se configuran en Vercel**, que es donde corre el sitio (`ENTREGA/07-variables-de-entorno.md` §0 lista las 15 que hay hoy). El repo lo da por hecho en todos lados: `BITACORA.md:865` («Variables que se pusieron hoy en Vercel»), `SETUP.md:51` («en tu `.env` (y en Vercel)»), `server/api/pedidos.get.ts:9` («se cambia la variable en Vercel»), `server/utils/costoEnvio.ts:9-11` («debe bastar con cambiar la variable en Vercel — sin desplegar»), `nuxt.config.ts:104-107`. El `.env` local es solo para desarrollo y no está en el repo; `.env.example` es la plantilla.

> **Trampa que ya costó tiempo una vez.** En Vercel **una variable nueva solo entra con un despliegue nuevo**. El 27-ago-2026 hubo que hacer un **commit vacío** nada más para que las variables recién puestas tomaran efecto (`BITACORA.md:865-868`). Si cambias o agregas una variable y «no pasa nada», no es que esté mal escrita: falta redesplegar. Ojo también con el matiz de `costoEnvio.ts:9-11`, que promete cambiar el monto «sin desplegar»: eso vale para *cambiar* el valor de una variable ya cargada, no para *crearla*.

> **Al rotar `SUPABASE_SERVICE_ROLE_KEY`, actualízala en producción Y en los previews.** Mientras la llave vieja está revocada y la nueva no está cargada, `supabaseAdmin()` lanza 500 y se cae **todo el back de pedidos a la vez**: el cobro con MercadoPago (`SETUP.md:38`), el de Stripe, `/api/pedidos` y `/api/pedido-enviado` (quien surte no puede trabajar), `/api/resena` y `/api/cart-save`. Hazlo en una ventana de poco tráfico y verifica con un pedido de prueba antes de irte.

### Variables que el código usa y `.env.example` NO lista

`.env.example` cubre WhatsApp, MercadoPago, Stripe, las URLs públicas, las tres de Supabase y las cinco de GoHighLevel. Faltan estas cuatro, y las cuatro fallan **en silencio**:

| Variable | Dónde se lee | Qué pasa si falta | Dónde sí está documentada |
|---|---|---|---|
| `NUXT_PEDIDOS_PIN` | `pedidos.get.ts:17`, `pedido-enviado.post.ts:11` | `/pedidos` responde **404**. Quien surte no puede trabajar | `BITACORA.md:866`, `AMANTI-Automatizaciones-2026-09-03.html:449` |
| `NUXT_RESENA_SECRET` | `server/utils/resenaToken.ts:27` | La reseña de invitado queda **apagada**, `/api/resena` devuelve 404 (`resena.post.ts:20`) y los enlaces del correo del día 10 salen sin firma (`resenaToken.ts:67-71`) | `BITACORA.md:866`, `AMANTI-Automatizaciones-2026-09-03.html:353,448` |
| `NUXT_ENVIO_COSTO` (y su gemela `NUXT_PUBLIC_ENVIO_COSTO`) | `server/utils/costoEnvio.ts:23`, `nuxt.config.ts:121-125` | **El envío sale gratis para todos** y cada pedido bajo $1,000 le cuesta el envío a AMANTI. Es exactamente la falla que se corrigió el 27-ago (`costoEnvio.ts:4-7`) | `BITACORA.md:865-866`, `AMANTI-Automatizaciones-2026-09-03.html:450` |
| `NUXT_N8N_CHAT_WEBHOOK` | `nuxt.config.ts:97-99` | Cae a una URL de respaldo escrita en el código. No aparece en ningún inventario | — |

Las dos primeras se pusieron a mano en Vercel el mismo día (`BITACORA.md:865-866`) y nunca bajaron a `.env.example`. **Vale la pena agregar las cuatro a `.env.example`, vacías y con su comentario.** En un entorno nuevo —un preview, un clon, el proyecto ya migrado— nadie se entera de que existen hasta que algo no funciona y no hay ningún error que lo diga. El detalle completo de cada variable está en `07-variables-de-entorno.md`.

**Sin verificar desde el repo:** qué variables están efectivamente cargadas hoy en Vercel, con qué valor y en qué entornos (Production / Preview / Development).

---

## 6. Las dos llaves: `anon` y `service_role`

| | `anon` | `service_role` |
|---|---|---|
| Variable | `SUPABASE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |
| Quién la lee | `@nuxtjs/supabase` (`nuxt.config.ts:12`) | `server/utils/supabaseAdmin.ts:12` |
| Dónde corre | navegador **y** servidor | **solo** servidor |
| RLS | la respeta | **se la salta por completo** |
| Si se filtra | daño acotado por RLS | control total de la base |

La URL del proyecto es `SUPABASE_URL` (`SETUP.md:36`) y no es secreta.

**Por qué la `service_role` solo vive del lado del servidor.** `server/utils/supabaseAdmin.ts:3-5` lo explica en el propio archivo: la URL se puede tomar del `runtimeConfig` público porque no es secreta, pero la llave se lee **exclusivamente** de `process.env.SUPABASE_SERVICE_ROLE_KEY`, una variable **sin prefijo público**. En Nuxt, lo que va en `runtimeConfig.public` se serializa dentro del HTML que recibe el navegador; lo que se lee con `process.env` desde `server/` no. Esa es toda la separación: un prefijo.

El cliente se crea una sola vez y se cachea en el módulo (`supabaseAdmin.ts:6,9`), con `persistSession: false` y `autoRefreshToken: false` (`:20`) — en el servidor no hay sesión de usuario que guardar ni refrescar; sería estado compartido entre peticiones de clientes distintos.

**Qué pasa si falta.** `supabaseAdmin()` lanza un error 500 con el mensaje `Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (server-side)` (`supabaseAdmin.ts:13-19`). Como todo el back de pedidos pasa por ahí, el efecto es amplio: `SETUP.md:38` lo resume en que **todo pago con MercadoPago devuelve HTTP 500**, y lo mismo aplica a `/api/pedidos`, `/api/pedido-enviado`, `/api/resena` y `/api/cart-save`.

> **Advertencia que puede tumbar el negocio entero.** Si alguien mueve esa llave a una variable con prefijo `NUXT_PUBLIC_` o la mete en `runtimeConfig.public` —por ejemplo «para que funcione también en el cliente»—, la llave queda impresa en el HTML de todas las páginas. Cualquiera que abra «ver código fuente» puede leer, modificar y borrar toda la base saltándose RLS: pedidos, domicilios, teléfonos y correos de todos los clientes. Si llega a pasar, hay que **rotar la llave desde el dashboard de Supabase** (regenerarla) además de revertir el código; borrar el deploy no basta, porque la llave ya circuló. Y al rotarla, lee la advertencia de la sección 5 sobre previews.

---

## 7. La pantalla de pedidos con PIN

Quien surte los pedidos entra a **`/pedidos`** (`pages/pedidos.vue`), teclea un PIN y ve la lista de lo que hay que mandar. Las piezas son tres:

- `pages/pedidos.vue` — la pantalla.
- `server/api/pedidos.get.ts` — `GET /api/pedidos?pin=…`, devuelve los pedidos.
- `server/api/pedido-enviado.post.ts` — `POST /api/pedido-enviado`, marca uno como enviado.

El PIN es una sola variable de entorno, **`NUXT_PEDIDOS_PIN`**, y se compara tal cual contra lo que llega (`pedidos.get.ts:17,21-23`; `pedido-enviado.post.ts:11,15`).

**Por qué un PIN y no una cuenta.** El razonamiento está escrito completo en `server/api/pedidos.get.ts:6-12`, y es honesto sobre sus límites:

- Esa pantalla expone nombre, teléfono y domicilio de clientes reales.
- La usa **una** persona, casi siempre desde el teléfono. Un PIN compartido es «lo mínimo razonable» para eso.
- **No es autenticación de verdad.** Si el PIN se filtra, se cambia la variable en Vercel y listo.
- **Cuando haya más gente surtiendo, esto debe pasar a cuentas con rol.** Está marcado como deuda consciente, no como diseño final.

**Falla cerrado, no abierto.** Si `NUXT_PEDIDOS_PIN` no está configurada, el endpoint devuelve **404**, no queda abierto (`pedidos.get.ts:18`, `pedido-enviado.post.ts:12`). La razón está en el comentario: *un descuido de configuración no puede terminar publicando domicilios*. Es la decisión correcta y hay que conservarla al tocar ese archivo.

Otras decisiones de esa pantalla, con su porqué:

- Solo se listan pedidos en estado `paid` y `refunded`, máximo 200, más recientes primero (`pedidos.get.ts:30-34`). Lo `pending` no se surte, y mostrarlo invita a mandar algo que nadie pagó. **Consecuencia:** los pedidos por WhatsApp nunca aparecen aquí — se crean `pending` (`order-whatsapp.post.ts:19`) y ningún webhook los mueve, así que se atienden por la conversación de WhatsApp, no por esta pantalla.
- Cada pedido trae la bandera `sinDireccion` calculada en el servidor (`pedidos.get.ts:55`) y la tarjeta la pinta en amarillo (`pedidos.vue:141-143`): un pedido sin dirección no se puede surtir y eso tiene que saltar a la vista antes de empacar, no al momento de pegar la guía.
- La dirección se arma en un **bloque de varias líneas** listo para copiar y pegar en la guía (`pedidos.vue:52-59`, termina en `.filter(Boolean).join('\n')`), y se pinta dentro de un `<pre>` con `white-space: pre-wrap` (`pedidos.vue:146`, `:204`). El comentario del código en `pedidos.vue:51` dice «en una sola línea» y está mal redactado; el código manda. El **correo va fuera de ese bloque** a propósito (`pedidos.vue:152-157`): eso se pega en una guía de envío y ahí no pinta nada.
- La página lleva `robots: noindex, nofollow` (`pedidos.vue:86-89`), porque trae datos personales.
- El PIN se guarda en el `localStorage` del navegador de quien surte para no teclearlo cada vez (`pedidos.vue:30,41`), envuelto en `try/catch` por si es modo privado.
- «Marcar enviado» escribe `shipped_at` y `tracking`, y «Deshacer» los pone en `null` (`pedido-enviado.post.ts:22-26`). Deshacer existe porque marcar de más pasa, y sin eso habría que entrar a la base a corregirlo. **Nota importante: marcar enviado NO toca `orders.status`** — el estado del pago es autoridad exclusiva de los webhooks (`pedido-enviado.post.ts:4-5`).
- Al marcar (nunca al deshacer) se avisa a GoHighLevel sin esperar respuesta (`pedido-enviado.post.ts:37-55`). El porqué está en el comentario `:30-36`: un aviso que no sale se reenvía, pero un pedido que no se puede marcar como enviado **detiene el trabajo de quien surte**.

> **Trampas de esta pantalla.**
> 1. **`NUXT_PEDIDOS_PIN` no está en `.env.example`.** Solo aparece en `BITACORA.md:866` y en la tabla de variables de `AMANTI-Automatizaciones-2026-09-03.html:449` (donde figura como «Puesta · 27 de agosto»), nunca en `.env.example`. Vale la pena agregarla ahí. Ver la tabla de la sección 5.
> 2. **El PIN viaja en la query string de un `GET`** (`pedidos.get.ts:20-23`, `pedidos.vue:27`), así que queda escrito en los registros de acceso del hosting y en el historial del navegador. Si algún día se endurece esto, mover el PIN al cuerpo o a un encabezado es el primer paso.
> 3. **Defecto conocido: el número de guía nunca se muestra.** `pedidos.vue:172` pinta `p.tracking`, pero el `select` de `pedidos.get.ts:31` no incluye `tracking` — se guarda bien y no se lee. Se arregla agregando `tracking` a esa lista de columnas.

---

## 8. Cuentas de cliente y recuperación de contraseña

Toda la autenticación es **Supabase Auth** a través de `@nuxtjs/supabase`. El envoltorio del proyecto es `composables/useAuth.ts`, que expone `signUp`, `signIn`, `signInWithGoogle`, `signOut`, `resetPassword` y el usuario reactivo.

**Configuración.** `nuxt.config.ts:8-14` pone `redirect: false` a propósito, y el comentario explica el diseño: login y registro viven en la **misma página** (`/cuenta`) sin redirección global, y **no hay middleware de ruta**. Funciona porque `/cuenta` no renderiza datos privados en SSR — todo se carga en el cliente después de que la sesión se resuelve (`pages/cuenta/index.vue:13-16` espera a `onMounted` justo para no «flashear» el formulario de login a alguien que ya tiene sesión). El propio comentario deja la regla para el futuro: **si alguna subruta llega a renderizar datos privados en el servidor, hay que agregar middleware que redirija a los no autenticados.**

**Registro.** `useAuth.ts:11-16`. El nombre y el teléfono se mandan en `options.data`, lo que en Supabase cae en `raw_user_meta_data`; el comentario dice que de ahí los toma «el trigger» que llena `profiles`. **Ese trigger no está en el repo** — el DDL mínimo para reponerlo está en la sección 4. El formulario exige nombre, correo válido, contraseña de 6+ y aceptación explícita de Términos y Aviso de Privacidad (`components/account/AccountAuth.vue:39-42,90-93`).

`AccountAuth.vue:47-48` maneja los dos casos posibles: si `signUp` devuelve sesión, entra directo; si no, muestra «te enviamos un correo para confirmar tu cuenta». O sea que el código funciona con o sin confirmación por correo — cuál está activada se decide en el dashboard de Supabase y **no se puede verificar desde el repo**.

`AccountAuth.vue:15-24` traduce los mensajes de error de Supabase (que llegan en inglés) a español. Si actualizas la librería y cambian los textos, esas comparaciones por substring se rompen en silencio: el usuario vería el mensaje crudo en inglés.

**Google.** `useAuth.ts:23-27` usa `signInWithOAuth({ provider: 'google' })` con retorno a `/cuenta`. El comentario de `:22` dice que Google ya está habilitado en el dashboard; **eso no se puede verificar desde el repo**.

**Recuperación de contraseña.** Son dos piezas:

1. `useAuth.ts:35` llama `resetPasswordForEmail` con `redirectTo: ${origin}/cuenta/nueva-contrasena`. El disparador está en `AccountAuth.vue:57-65`, y la respuesta al usuario es deliberadamente ambigua —*«si el correo existe, te enviamos un enlace»*— para no revelar qué correos están registrados.
2. `pages/cuenta/nueva-contrasena.vue` recibe el clic del correo. `@nuxtjs/supabase` consume el token y crea una **sesión de recuperación**; la página la detecta escuchando el evento `PASSWORD_RECOVERY` de `onAuthStateChange` (`:22-24`) y con eso habilita el formulario. Guardar llama `supabase.auth.updateUser({ password })` (`:41`). Mínimo 6 caracteres y confirmación repetida (`:34-35`).

> **Trampa de configuración.** Ese `redirectTo` tiene que estar dado de alta en la lista de *Redirect URLs* del dashboard de Supabase, y tiene que incluir **cada dominio** desde el que se use el sitio (producción y cualquier preview). Si no está, el enlace del correo no crea la sesión de recuperación y el usuario ve «el enlace no es válido o expiró» (`nueva-contrasena.vue:37`) aunque el correo sea de hace un minuto. **No se puede verificar desde el repo.**

**Qué hace cada pestaña del panel de cuenta** (`pages/cuenta/index.vue:5-9,43-45`):

- **Mi perfil** (`AccountProfile.vue`) — lee `profiles` con `maybeSingle()` (`:22-26`) y guarda con `update(...).eq('id', uid)` (`:46-53`).
- **Direcciones** (`AccountAddresses.vue`) — CRUD completo contra `addresses` **directo desde el navegador con la llave anon**, apoyándose en que RLS aísla por `user_id` (`:2`).
- **Pedidos** (`AccountOrders.vue`) — solo lectura de `orders` con sus `order_items` anidados, también desde el navegador y además filtrando por `.eq('user_id', uid)` (`:55-59`). El botón «Volver a pedir» mapea los artículos del pedido contra el catálogo **vigente** por nombre (`:30-48`): reusa precio y slug actuales, y si el producto ya no existe avisa en vez de fallar.

> **No deduzcas la máquina de estados del mapa de etiquetas.** `AccountOrders.vue:14-21` traduce `pending`, `paid`, `shipped`, `delivered`, `cancelled` y `refunded` (más sus versiones en español) a etiquetas de interfaz. **De esos, `shipped` y `delivered` no los escribe nadie**, y las versiones en español tampoco: los únicos que se escriben en `orders.status` son los cuatro de la sección 3, y el envío **no vive en `status`** sino en `shipped_at` y `tracking` (`pedido-enviado.post.ts:22-26`). Ese mapa es defensivo/heredado, con un `fallback` en `:22` para cualquier valor desconocido. Si te pones a buscar dónde se escribe `shipped`, no vas a encontrar nada — no porque falte, sino porque no existe.

> **Trampa silenciosa en el perfil.** `AccountProfile.vue:46-53` usa `update`, no `upsert`. En Postgres, un `UPDATE` que no encuentra filas **no es un error**: afecta cero filas y devuelve éxito. Si la fila de `profiles` no existe —por ejemplo porque el trigger de alta no está puesto en ese entorno—, el usuario ve «Perfil actualizado ✓» y no se guardó nada. Al montar una base nueva, esto hay que probarlo a mano: crear un usuario, ver que aparezca su fila en `profiles`, editarla y recargar.

**Favoritos.** `stores/wishlist.ts` es un store de Pinia con `persist: true` (`:23`), o sea `localStorage`. El plugin `plugins/wishlist-sync.client.ts` lo sincroniza con la nube cuando hay sesión: al iniciar sesión hace **merge** (unión de lo local y lo de la nube) para no perder favoritos (`:15-36`), y después cada cambio se propaga (`:38-55`). Degrada con gracia: si la consulta falla —tabla inexistente, sin sesión— simplemente `return` y todo sigue en `localStorage` como antes (`:22`). Al cerrar sesión deja de sincronizar y lo local queda intacto (`:58-61`).

---

## 9. Políticas de seguridad a nivel de fila (RLS), dicho tal cual

Esto es lo que el repo declara, literalmente. Nada más.

| Tabla | RLS | Políticas declaradas en el repo |
|---|---|---|
| `leads` | activado (`all.sql:15`) | Solo `insert` para cualquiera (`all.sql:17-19`). **No hay política de `select`**, así que nadie puede leer los correos por la API — solo el dashboard o la `service_role`. |
| `wishlist_items` | activado (`wishlist.sql:17`) | `select`, `insert` y `delete`, todas con `auth.uid() = user_id` (`wishlist.sql:20-30`). **No hay `update`** — y no hace falta: el plugin solo hace `upsert` con `ignoreDuplicates: true` (que en Postgres es `do nothing`) y `delete` (`wishlist-sync.client.ts:28-31,46-52`). |
| `reviews` | activado (`reviews.sql:20`) | `select` **público** con `using (true)` (`:24-25`); `insert`, `update` y `delete` solo de la propia fila (`:28-38`). |
| `abandoned_carts` | activado (`abandoned-carts.sql:23`) | **Ninguna, a propósito.** El archivo lo explica (`:6-9`): con RLS activado y sin políticas, `anon` y `authenticated` no pueden leer ni escribir nada; solo la `service_role`, que se salta RLS. Toda la escritura pasa por `/api/cart-save`. |
| `orders` | **no consta en el repo** | ninguna |
| `order_items` | **no consta en el repo** | ninguna |
| `addresses` | **no consta en el repo** | ninguna |
| `profiles` | **no consta en el repo** | ninguna |
| `coupons` | **no consta en el repo** | ninguna |

Son nueve tablas: las cuatro que el repo crea y las cinco que no.

> **Advertencia seria.** El panel de cuenta consulta `orders`, `order_items`, `addresses` y `profiles` **desde el navegador, con la llave anon**, y los comentarios del código dicen que confía en RLS para aislar por usuario: `AccountAddresses.vue:2` («RLS aísla por `user_id`»), `AccountOrders.vue:2` («del usuario (RLS)»), `AccountProfile.vue:2` («RLS: el usuario solo ve/edita su fila»). Si esas políticas **no** existen en el proyecto de Supabase, cualquier persona con una sesión —o incluso sin ella, según cómo estén los `grants`— puede leer los pedidos, los domicilios y los teléfonos de todos los clientes usando la llave anon, que viaja en el HTML de todas las páginas. **No se puede verificar desde el repo.** Es la primera cosa que hay que revisar en el dashboard: Supabase → Table Editor → cada tabla → pestaña de políticas.

Dos cosas más que el propio código admite sobre `reviews`:

- La política `reviews_insert_own` deja que **cualquier usuario con cuenta reseñe cualquier producto sin haberlo comprado**. Lo dice `server/api/resena.post.ts:12-13` y lo repite `server/utils/resenaToken.ts:17-19`.
- Por eso el camino de invitado quedó **más estricto** que el de usuario registrado: `/api/resena` comprueba tres candados en orden antes de escribir (`resena.post.ts:6-11`): que la firma del enlace sea válida (`:34`), que el pedido esté `paid` (`:54`) y que el pedido de verdad incluya ese producto (`:63`). La firma es un HMAC con **`NUXT_RESENA_SECRET`**, comparado en **tiempo constante** (`server/utils/resenaToken.ts:52-59`) porque comparar con `===` filtra byte a byte qué tan cerca anduvo quien lo intenta. Sin esa variable configurada la reseña de invitado queda apagada y el endpoint devuelve 404 (`resenaToken.ts:31-33`, `resena.post.ts:20`) — y **esa variable tampoco está en `.env.example`** (ver la tabla de la sección 5), así que en un entorno nuevo este camino, que es el más importante de los dos, nace apagado sin que nada lo diga. Por eso `resenas-invitado.sql:9-13` **no abre ninguna política de RLS a `anon`**: hacerlo sería dejar abierta justo la puerta que ese endpoint está cuidando.

---

## 10. Cómo trabajar sin escribir en la base de producción

**No hay proyecto de staging.** No hay `supabase/config.toml` ni carpeta `migrations/`, los `.sql` se corren a mano en el SQL Editor del proyecto real, y no existe ninguna separación de entornos en el repo.

> **Advertencia.** Correr `pnpm dev` con el `.env` de producción **escribe en producción**. No es simulado: `/api/checkout`, `/api/stripe-checkout` y `/api/order-whatsapp` crean filas reales en `orders` y `order_items` con la `service_role`; el alta de direcciones del panel de cuenta escribe en `addresses`; y `/api/cart-save` escribe en `abandoned_carts` — y esa última, si además `NUXT_GHL_WEBHOOK_CARRITO_ABANDONADO` está puesta, **dispara un trigger premium de GoHighLevel que se cobra por uso** y mete a un correo real en la secuencia de recuperación. Lo mismo vale para las pruebas e2e: `test/e2e/orders.spec.ts:16-23` y `test/e2e/account-auth.spec.ts:17-25` crean usuarios y pedidos con la `service_role` contra el proyecto que apunte `SB_URL`.

Lo recomendable, y lo que resuelve varios huecos a la vez:

1. **Levanta un segundo proyecto de Supabase de pruebas.** Con el volcado de esquema de la sección 11 lo montas en minutos y ya no tocas producción para nada. Es también donde se ensaya la restauración de un respaldo y donde se prueba el trigger de `profiles`.
2. **Ten dos `.env`**: uno apuntando al proyecto de pruebas para el día a día, y el de producción solo cuando de verdad haga falta. Ninguno de los dos va al repo.
3. **En el `.env` de desarrollo deja vacías las cinco URLs de GoHighLevel.** `.env.example:45` lo dice: vacía o ausente = ese evento queda apagado y el resto sigue funcionando. Es la forma barata de no generar cobros ni correos a clientes reales desde tu máquina.
4. **Deja `NUXT_PEDIDOS_PIN` puesta también en desarrollo** si vas a tocar `/pedidos`; sin ella el endpoint responde 404 y vas a perder un rato creyendo que rompiste algo.

---

## 11. Respaldos

**En el repo no hay absolutamente nada de respaldo**: ni script, ni tarea programada, ni documentación. Búsqueda de `pg_dump` y `backup` en todo el repo: cero resultados. La palabra `respaldo` **sí** aparece (en `BITACORA.md`, `nuxt.config.ts:104`, `server/utils/baseUrl.ts:6,10`, `server/utils/orders.ts:124`, `server/api/mp-webhook.post.ts:171`), pero siempre con el sentido de *valor de reserva* — nunca de copia de seguridad. Lo que Supabase haga por su cuenta —respaldos diarios automáticos, *point-in-time recovery*— depende del plan contratado y **no se puede ver desde aquí**.

Lo que conviene montar, y con qué frecuencia:

| Qué | Cuándo | Por qué |
|---|---|---|
| **Volcado de esquema** (solo estructura, sin datos) | Cada vez que se corra un `.sql`, y hoy mismo como tarea cero | Es lo que resuelve el hueco de la sección 2. El resultado se guarda en el repo, por ejemplo como `supabase/esquema-actual.sql`, y deja de ser un dato que solo vive en el dashboard. |
| **Volcado completo** (esquema + datos) | Diario | `orders`, `order_items`, `addresses` y `profiles` son el negocio. Un pedido perdido es plata perdida. |
| **Volcado manual antes de tocar nada** | Antes de correr cualquier `.sql` nuevo o de borrar filas a mano | `orders-envio.sql` y `addresses-colonia.sql` son aditivos y seguros, pero `resenas-invitado.sql` ya no lo es (sección 4) y el siguiente puede no serlo. |

Las dos rutas para sacarlo:

- **CLI de Supabase** — ya se usó en este proyecto alguna vez (`supabase/.temp/cli-latest` marca `v2.116.0`). `supabase db dump` saca el esquema y, con la bandera de datos, también el contenido.
- **`pg_dump` directo** contra la cadena de conexión de Postgres que da el dashboard del proyecto. Es la ruta que no depende de que el CLI esté instalado.

Reglas al hacerlo:

1. La cadena de conexión y la contraseña de la base **son secretos**: van en el gestor de contraseñas del equipo o en la variable de entorno de donde corra el respaldo, nunca en el repo ni en un archivo `.sql`.
2. El archivo del volcado **con datos** trae correos, teléfonos y domicilios de clientes reales. No se sube al repo ni a un Drive compartido abierto. Ver la sección 13.
3. El volcado **solo de esquema** sí va al repo: no tiene datos personales y es justo lo que hoy falta.
4. Un respaldo que nunca se restauró no es un respaldo. Conviene probar la restauración una vez, contra el proyecto de pruebas de la sección 10.

**Cómo comprobar que la base está viva y bien.** El repo trae pruebas de punta a punta que hablan con Supabase de verdad: `test/e2e/account-auth.spec.ts` y `test/e2e/orders.spec.ts`. Necesitan tres variables de entorno —`SB_URL`, `SB_ANON`, `SB_SVC`— y **se omiten solas si no están** (`account-auth.spec.ts:14`, `orders.spec.ts:14`), para que el CI siga verde sin secretos. Crean un usuario confirmado con la `service_role`, prueban el flujo real y lo borran al terminar (`account-auth.spec.ts:17-25`). Es la forma más rápida de saber si una base recién levantada quedó bien — pero apúntalas al proyecto de pruebas, no al de producción.

---

## 12. Pedidos huérfanos y filas que hay que vigilar

**Qué es un pedido huérfano.** `createPendingOrder` inserta primero la fila de `orders` y después sus `order_items` (`server/utils/orders.ts:128-154`). Si el insert de los artículos falla, hace un **rollback best-effort**: borra el `orders` recién creado (`:151`). Si *ese borrado también falla*, deja la fila sin artículos y lo registra con `console.error('[orders] ROLLBACK FALLÓ, order huérfano sin items:', …)` (`:152`).

**Por qué normalmente no se traduce en un cobro perdido.** Los tres endpoints de compra llaman a `createPendingOrder` **antes** de crear la preferencia de MercadoPago o la sesión de Stripe (`checkout.post.ts:75`, `stripe-checkout.post.ts:28`, `order-whatsapp.post.ts:19`), y esa función lanza un 500 en ese punto (`orders.ts:153`). El cliente nunca llega a la pasarela, así que el huérfano se queda `pending` para siempre.

**La salvaguarda que sí importa.** Aun así, los dos webhooks se niegan a marcar `paid` un pedido sin artículos (`mp-webhook.post.ts:118-125`, `stripe-webhook.post.ts:112-119`): cuentan `order_items` y, si sale cero, escriben un `console.error` y devuelven `order-has-no-items` sin tocar el estado. Es defensa en profundidad, pero tiene un costo real: **si por cualquier camino un pago aterrizara sobre un pedido sin artículos, el cliente pagaría y su pedido jamás pasaría a `paid`** — no aparecería en `/pedidos`, nadie lo surtiría, y no habría ningún error visible para él. Lo único que queda es esa línea en los logs de Vercel.

**Cómo detectarlos:**

```sql
select o.id, o.status, o.payment_method, o.total, o.created_at
from public.orders o
left join public.order_items oi on oi.order_id = o.id
where oi.id is null
order by o.created_at desc;
```

**Cómo limpiarlos, con cuidado.** Antes de borrar nada, revisa dos cosas:

- **No borres todos los `pending`.** Los pedidos por WhatsApp se crean `pending` y **nadie los mueve nunca** (no hay webhook para ese método; `test/e2e/orders.spec.ts:170` lo da por hecho). Un barrido de «pending viejos» se llevaría el historial de esos pedidos. Filtra siempre por `payment_method` y por la ausencia de artículos.
- **Un huérfano con `status = 'paid'` o con `mp_payment_id` no se toca**: eso ya no es un huérfano de rollback, es un incidente de cobro. Va por `11-fallas-conocidas.md`.

Conviene dejar una alerta sobre esas dos líneas de log (`[orders] ROLLBACK FALLÓ` y `pago aprobado para order sin items`), porque hoy nadie las mira.

---

## 13. Datos personales

La base guarda **datos personales de clientes reales**: nombre, correo, teléfono y domicilio completo en `orders.shipping_address` y en `addresses`; correo y teléfono en `profiles`; correo en `leads` y en `abandoned_carts`. Cualquiera con la `service_role` los lee todos, saltándose RLS.

Lo que el repo declara, y que hay que seguir cumpliendo:

- El aviso de privacidad publicado (`pages/privacidad.vue`) nombra a **Raúl Díaz Calderón** como **responsable del tratamiento** conforme a la LFPDPPP (`privacidad.vue:5,8`). Esa figura es del negocio y no cambia porque cambie quién mantiene el código: quien administre la base lo hace **por cuenta del responsable**, no en nombre propio.
- El sitio promete **derechos ARCO** y da un canal concreto: solicitudes a **nan.cerva@icloud.com**, con nombre, datos involucrados y descripción (`privacidad.vue:20-21`). El mismo correo es el canal para oponerse a las finalidades secundarias (`:15`) y para supresión de datos de menores (`:27`).
- El aviso dice que los datos se comparten con terceros que prestan servicios —paqueterías, plataformas de pago, proveedores de tecnología y analítica— y que **no se venden** (`privacidad.vue:18`).

Qué significa eso en la práctica para quien recibe la base:

| Situación | Qué hay que hacer | Dónde tocar |
|---|---|---|
| **Solicitud de acceso** («¿qué tienen de mí?») | Buscar por correo en `profiles`, `addresses`, `orders` (dentro de `shipping_address`), `reviews`, `leads` y `abandoned_carts` | SQL Editor, con la `service_role` |
| **Solicitud de rectificación** | Corregir la fila. Ojo: `orders.shipping_address` es un **snapshot histórico** del pedido; corregir el perfil no reescribe pedidos viejos, y así debe ser | `profiles`, `addresses` |
| **Solicitud de cancelación / supresión** | Borrar el usuario de `auth.users` se lleva en cascada favoritos y **reseñas** (`on delete cascade`, `all.sql:24,41`), pone en null el `user_id` de `abandoned_carts` (`all.sql:66`) y **no borra `orders`** — que hay que conservar por obligaciones fiscales y de garantía (`privacidad.vue:14`). El domicilio dentro de `shipping_address` hay que tratarlo aparte | ver la trampa de la sección 14 |
| **Aparece un volcado con datos** | No va al repo, no va a un Drive abierto, no va por correo. Cifrado y con caducidad | sección 11, regla 2 |

**Sin verificar desde el repo:** no hay ninguna política de retención escrita (ni en el aviso de privacidad ni en el código: `privacidad.vue:14` solo dice que se conservan «el tiempo necesario»), no hay ningún proceso automatizado de borrado, y no consta quién queda operativamente a cargo de atender una solicitud ARCO después de la entrega. **Es el pendiente más caro de esta sección y hay que cerrarlo con el dueño del negocio antes de que llegue la primera solicitud**, no después. `12-pendientes-y-riesgos.md` es el lugar donde debe quedar anotado con dueño y fecha.

---

## 14. Resumen de trampas

| Trampa | Qué pasa | Dónde |
|---|---|---|
| **`service_role` expuesta al cliente** | Control total de la base para cualquiera. Hay que rotar la llave, no solo revertir el deploy | `server/utils/supabaseAdmin.ts:3-12` |
| **RLS no verificable de 5 tablas** | Si falta, la llave anon lee pedidos y domicilios de todos los clientes | sección 9 |
| **`CHECK` de `status` con tres valores** | Los dos webhooks empiezan a fallar en silencio ante todo pago rechazado, cancelado o expirado. Son **cuatro** estados | `mp-webhook.post.ts:20-28,36-40`; `stripe-webhook.post.ts:45-58,23-27` |
| **`all.sql` sobre base vacía** | Se corta a la mitad porque `orders` no existe | `supabase/all.sql:61` |
| **`resenas-invitado.sql` sobre datos con duplicados** | El índice UNIQUE parcial falla. Su encabezado **no** promete ser re-ejecutable ni aditivo, a diferencia de los otros dos incrementales | `supabase/resenas-invitado.sql:16,28-30` |
| **Deploy antes que el `.sql`** | El alta de direcciones y el snapshot del pedido fallan | `supabase/addresses-colonia.sql:10-13` |
| **Perfil que dice guardado y no guarda** | `update` sin fila previa devuelve éxito con cero filas. Causa raíz: el trigger de `profiles` no está en el repo | `components/account/AccountProfile.vue:46-53`; DDL en la sección 4 |
| **Cuatro variables fuera de `.env.example`** | `NUXT_PEDIDOS_PIN` (404 en `/pedidos`), `NUXT_RESENA_SECRET` (reseña de invitado apagada), `NUXT_ENVIO_COSTO` (**envío gratis para todos**), `NUXT_N8N_CHAT_WEBHOOK`. Las cuatro fallan en silencio | sección 5 |
| **Variable nueva en Vercel sin redesplegar** | No toma efecto. Ya pasó una vez y hubo que hacer un commit vacío | `BITACORA.md:865-868` |
| **`pnpm dev` con el `.env` de producción** | Escribe pedidos, direcciones y carritos reales, y puede disparar cobros de GHL | sección 10 |
| **El número de guía no se muestra** | Se guarda `tracking` pero el `select` no lo pide | `server/api/pedidos.get.ts:31` vs `pages/pedidos.vue:172` |
| **Deducir la máquina de estados de `AccountOrders`** | `shipped` y `delivered` están en el mapa de etiquetas pero **nadie los escribe**; el envío vive en `shipped_at`/`tracking` | `AccountOrders.vue:14-21` vs `pedido-enviado.post.ts:22-26` |
| **Borrar `pending` viejos en bloque** | Se lleva el historial de los pedidos por WhatsApp, que se quedan `pending` para siempre | `order-whatsapp.post.ts:19`; sección 12 |
| **Tocar el candado de carritos abandonados** | **Cobra de más.** Ver abajo | `server/utils/ghl.ts:138-146` |
| **Borrar un usuario de `auth.users`** | Se van en cascada sus favoritos y **sus reseñas** (`on delete cascade`), y sus reseñas desaparecen de la ficha pública. En `abandoned_carts` el `user_id` queda en null y la fila sobrevive | `supabase/all.sql:24,41,66` |
| **`@supabase/supabase-js` no es dependencia directa** | `supabaseAdmin.ts:1` lo importa, pero `package.json:15-22` no lo lista: llega como dependencia transitiva de `@nuxtjs/supabase`. Si esa librería cambia su árbol, el build truena sin que nadie haya tocado ese archivo | `package.json`, `server/utils/supabaseAdmin.ts:1` |

**La trampa de dinero, con detalle.** `POST /api/cart-save` se llama muchísimo: cuatro segundos después de cada cambio del carrito y cada vez que se oculta la pestaña — un solo comprador genera fácilmente ocho o diez llamadas (`cart-save.post.ts:35-37`). Los disparadores de GoHighLevel **son premium y se cobran por uso**, así que avisar en cada guardado sería tirar dinero y además volver a meter al mismo contacto en la secuencia de 1h/24h/48h una y otra vez (`:37-39`).

El candado es la fila de `abandoned_carts`: si ya existe una viva (`recovered = false`) para ese correo, es que ya se avisó de ese episodio y no se dispara nada.

> **Dónde vive la regla: `server/utils/ghl.ts:138-146`, no en el endpoint.** `cart-save.post.ts` solo *reúne los hechos* —`recuperado`, `episodioVivo`, `registroDisponible` (`:44-73`)— y se los pasa a `debeAvisarCarrito` (`:77`). La decisión está aislada a propósito, y el comentario de `ghl.ts:126-137` lo dice: *«Vive aquí y no dentro del endpoint porque es LA regla que evita que nos cobren de más… Separada así queda probada»*. Tiene su propio bloque de pruebas en `test/unit/ghl.test.ts:139-141`. Si vas a «simplificar» esto, vas a abrir `cart-save.post.ts`, no vas a encontrar la lógica y vas a tocar lo que no es.

La función corta en tres pasos, en este orden (`ghl.ts:143-145`): si el carrito se recuperó, no avisa; si **no** se pudo leer la tabla, tampoco avisa; y solo entonces mira si el episodio ya estaba vivo. Ese segundo corte es **pesimista a propósito**, y va de la mano con el `catch` del endpoint (`cart-save.post.ts:68-73`): si la tabla no existe o la lectura falla, no hay forma de saber si ya se avisó, y ante la duda **no** se dispara. El comentario lo dice sin rodeos: *equivocarse hacia el lado de mandar de más aquí significa cobrar de más y spamear al cliente*. Si alguien invierte ese default para que dispare siempre, la factura de GHL sube y los clientes reciben la secuencia de recuperación repetida. No se toca sin entender esto primero.
