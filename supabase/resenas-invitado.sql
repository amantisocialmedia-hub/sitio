-- Reseñas de quien compró SIN cuenta.
--
-- 27-ago-2026. Hasta hoy dejar reseña exigía iniciar sesión, y hoy mismo se
-- descubrió que el invitado es la mayoría de los compradores (de hecho hasta
-- esta tarde era el único que ni siquiera podía pagar). La secuencia del día 10
-- que arma César manda al cliente a dejar su reseña: sin esto, todos esos
-- clientes llegan a un «Inicia sesión» y se van.
--
-- La reseña de invitado entra SOLO por /api/resena, que antes comprueba la firma
-- del enlace, que el pedido esté pagado y que incluya ese producto. Por eso no
-- se abre ninguna política de RLS a `anon`: ese endpoint escribe con la llave de
-- servicio, que se salta RLS. Abrirla aquí sería dejar la puerta que el endpoint
-- justamente está cuidando.

-- 1) user_id deja de ser obligatorio: una reseña de invitado no tiene usuario.
alter table public.reviews alter column user_id drop not null;

-- 2) De qué compra salió. Sirve para verificar y para no duplicar.
alter table public.reviews add column if not exists order_id uuid
  references public.orders(id) on delete set null;

-- 3) Una reseña por producto y por compra.
--
--    El único que ya existía es (user_id, product_slug) y NO cubre esto: en
--    Postgres los NULL no chocan entre sí, así que con user_id nulo ese índice
--    deja pasar cuantas reseñas se manden. Este es parcial, sobre las filas que
--    sí traen pedido.
create unique index if not exists reviews_order_slug_uidx
  on public.reviews(order_id, product_slug)
  where order_id is not null;

-- 4) Las reseñas de invitado se leen igual que las demás: la política
--    reviews_public_read ya es `using (true)` y no hay que tocarla.
