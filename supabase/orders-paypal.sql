-- PayPal como pasarela (24-oct-2026).
--
-- Dos columnas para reconciliar con el panel de PayPal. El código las escribe
-- "best-effort": si no existen, el pedido se cobra y se marca pagado de todos
-- modos (la liga real es custom_id = orders.id dentro de PayPal). Correr esto
-- una vez en el SQL Editor del proyecto.
alter table public.orders add column if not exists paypal_order_id text;
alter table public.orders add column if not exists paypal_capture_id text;

create index if not exists orders_paypal_order_id_idx on public.orders (paypal_order_id);
