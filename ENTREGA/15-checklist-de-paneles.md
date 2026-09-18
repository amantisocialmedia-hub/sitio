# Checklist de paneles: lo que el repo no puede decir

Cada sección de este paquete marcó como «sin verificar desde el repo» lo que solo se puede
confirmar entrando a un panel. Sumaban más de cien puntos repartidos en catorce archivos; aquí están
juntos, sin repetir, agrupados por el panel donde se resuelven.

**Lo que ya NO está en esta lista porque se verificó el 18/09/2026:** qué variables están cargadas en
Vercel producción (`07-variables-de-entorno.md` §0), a qué equipo y proyecto está ligado el sitio
(`izalith/amanti-store-cake`), cuántas pruebas pasan (268), los registros DNS del dominio
(`14-traspaso-de-infraestructura.md` paso 4), que el sitemap está desfasado (`12` §16) y que
`MP_WEBHOOK_TEST_MODE` no existe en producción.

Úsala como lista de trabajo de la primera semana. Marca cada punto con lo que encontraste; si algo
contradice este paquete, **el panel manda** y el paquete se corrige.

---

## Vercel

- [ ] **Quién tiene acceso al equipo `izalith` y quién puede desplegar.** Es el primer punto del
      traspaso (`14`, paso 2).
- [ ] Que el despliegue esté atado al push a `master` (integración con GitHub) y que nadie despliegue
      a mano con el CLI. La bitácora solo documenta el flujo por push.
- [ ] **Versión de Node del build.** El repo no la fija: no hay `engines` en `package.json` ni
      `.nvmrc`. Anótala y fíjala en el repo.
- [ ] Que `NUXT_ENVIO_COSTO` y `NUXT_PUBLIC_ENVIO_COSTO` tengan **el mismo valor**. Uno cobra y el
      otro pinta; si difieren, el carrito enseña un envío y Mercado Pago cobra otro (`03`).
- [ ] Que `NUXT_PUBLIC_PUBLIC_BASE_URL` valga `https://amanti.mx` y no `localhost` (`01` §9, trampa 3).
- [ ] Qué hace el botón **Redeploy** del panel: si recarga las variables o reutiliza la caché. Lo
      único probado en este proyecto es el commit vacío (`08`).
- [ ] La protección de los despliegues de preview (contraseña o SSO). Importa porque **las llaves de
      Mercado Pago también están en Preview**: un preview puede cobrar de verdad.
- [ ] Qué commit está desplegado en producción ahora mismo, contra el HEAD de `master`.

## Supabase

- [ ] **Organización, project ref, plan y quién tiene el rol de Owner.** Sin Owner no te pueden
      invitar ni transferir el proyecto (`14`, paso 3).
- [ ] **Volcar el esquema real antes de cualquier cambio** (`supabase db dump`). Las tablas `orders`,
      `order_items`, `coupons`, `profiles` y `addresses` **no se crean en ningún `.sql` del repo**: sin
      ese volcado, la base no se puede reconstruir (`06`, `12` §8).
- [ ] Las políticas RLS de esas cinco tablas. El panel de cuenta las consulta desde el navegador con
      la llave pública y confía en que existan.
- [ ] El trigger que llena `profiles` al registrarse. La sección `06` trae una reconstrucción, no el
      original: compáralos.
- [ ] Cuáles de los ocho `.sql` de `supabase/` están aplicados de verdad, en especial
      `abandoned-carts.sql`, del que no hay registro de que se haya corrido.
- [ ] Si `orders.user_id` admite nulos. Los pedidos de invitado dependen de eso.
- [ ] Qué cupones hay en `coupons` y cuáles están activos. Durante la campaña el servidor los rechaza
      todos; cuando se apague, los que estén activos vuelven a valer.
- [ ] Cuántos pedidos `pending` quedaron de las pruebas de agosto. Ensucian cualquier conteo.
- [ ] Auth: si la confirmación por correo está activa, si el acceso con Google está habilitado y
      qué URLs de redirección están dadas de alta para recuperar contraseña.
- [ ] Qué respaldos automáticos da el plan (diarios, recuperación a un punto en el tiempo).

## GoHighLevel (lo opera César)

- [ ] **De quién es la cuenta, quién la paga** y cuánto tiempo se guardan ahí los datos de clientes.
- [ ] Qué workflows existen, cuáles están activos y qué hace cada uno con lo que el sitio le manda.
- [ ] Que las tres URLs cargadas en Vercel sigan vivas. La única prueba que sirve es disparar una y
      buscar `request sent to trigger execution server` con su `id`; **`test request received` no
      dice nada** (`04` §10). Cada disparo se cobra.
- [ ] Crear el workflow de **pedido enviado** y cargar su URL en Vercel (`12` §2).
- [ ] El mapeo de campos dinámicos de las plantillas de correo (`12` §3).
- [ ] Apagar el módulo de Pixel del formulario de newsletter, que descarga la librería de Meta aunque
      se rechacen las cookies (`12` §7).
- [ ] Rotar la URL del trigger de aviso de pedido: sus identificadores quedaron en el historial de git
      (`13`, grupo C).

## Mercado Pago

- [ ] A nombre de quién está la cuenta.
- [ ] Que la URL de notificaciones sea `https://amanti.mx/api/mp-webhook` con el evento **Pagos**.
      Si apunta a otro lado, se cobra y el pedido nunca pasa a pagado (`03`, `14` paso 5).
- [ ] Si la plataforma deja dos credenciales vivas a la vez, para rotar sin ventana de caída.

## Google (cuenta `amanti.socialmedia@gmail.com`, la opera Emilio)

- [ ] **Google Analytics 4: la propiedad de AMANTI vive bajo la cuenta personal `memo_rx` del
      desarrollador saliente** (`BITACORA.md:414-415`). Antes del corte hay que nombrar
      administrador a una cuenta de AMANTI y luego retirar la del saliente. Si se hace al revés, se
      pierde la propiedad **y el histórico, que no se recupera**: GA4 no rellena hacia atrás
      (`BITACORA.md:463`). Es el único punto de esta lista donde el orden no tiene vuelta atrás.
- [ ] **Que la contraseña ya se haya cambiado.** Quedó escrita en el grupo de WhatsApp el 31/08 y no
      hay constancia del cambio. Es la prioridad número uno de la rotación (`13`).
- [ ] Verificación en dos pasos activada en esa cuenta.
- [ ] Si se aceptaron las invitaciones a Google Ads y Merchant Center del 31/08.
- [ ] **De quién es Tag Manager.** Emilio dijo que no es suyo; nadie lo ha reclamado.
- [ ] Si la conversión de compra de Ads ya registró alguna venta real (`12` §4).
- [ ] Estado de Merchant Center: productos aprobados, suspendidos o con discrepancia de precio;
      cada cuánto jala el feed; reglas de envío e impuestos dadas de alta.
- [ ] Si alguien está subiendo la referencia de los mensajes de WhatsApp a Ads como conversión
      fuera de línea.

## Dominio y correo

- [ ] **A nombre de quién está la cuenta de Hostinger**, donde viven los servidores de nombres.
- [ ] El registrador del `.mx` y a nombre de quién está el dominio.
- [ ] En Vercel, si `amanti.mx` está dado de alta como raíz, como `www` o ambos.
- [ ] Crear el registro DMARC (`12` §15). Cinco minutos una vez que haya acceso a Hostinger.
- [ ] La cuenta de Zoho Mail (correo de `contacto@amanti.mx`): a nombre de quién está.

## n8n (el chat EROS)

- [ ] De quién es el espacio de trabajo donde vive el agente, quién lo paga y si se transfiere. El
      subdominio no es de AMANTI (`12` §11).
- [ ] Si la URL del webhook sigue viva. Está escrita en `nuxt.config.ts:99`, así que viaja con el
      repo: conviene rotarla.

## Otras cuentas

- [ ] Microsoft Clarity y Meta (Pixel y Business Manager): a nombre de quién están.
- [ ] La línea de WhatsApp que recibe los pedidos: a nombre de quién está.
- [ ] Si la compra de prueba con tarjeta APRO ya se hizo (`12` §4).
