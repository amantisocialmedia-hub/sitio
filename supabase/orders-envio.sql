-- Marcado de envio de pedidos.
--
-- Para que Nancy pueda registrar que ya mando un pedido y no se le empalmen.
-- Antes no habia donde apuntarlo: la unica forma de saber si algo ya salio era
-- acordarse.
--
-- Aditivo y no destructivo: dos columnas nullables, sin default, sin tocar
-- datos existentes. Se puede correr mas de una vez.

alter table public.orders
  add column if not exists shipped_at timestamptz;

alter table public.orders
  add column if not exists tracking text;

comment on column public.orders.shipped_at is
  'Cuando se marco como enviado desde el panel de pedidos. NULL = todavia no sale.';
comment on column public.orders.tracking is
  'Numero de guia de la paqueteria, capturado a mano al marcar el envio.';
