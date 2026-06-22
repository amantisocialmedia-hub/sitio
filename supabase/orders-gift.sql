-- ============================================================
-- AMANTI · Modo Regalo
-- Ejecuta este SQL en Supabase → SQL Editor (una sola vez).
-- Agrega una columna jsonb a `orders` para guardar la info de regalo
-- { isGift, recipient, sender, message }.
-- Mientras no exista, el pedido se crea igual y la info de regalo solo
-- viaja en el mensaje de WhatsApp (el server hace el update best-effort).
-- ============================================================

alter table public.orders add column if not exists gift jsonb;
