-- ============================================================
-- AMANTI · Carritos abandonados (captura para recuperación)
-- Ejecuta este SQL en Supabase → SQL Editor (una sola vez).
-- Guarda un snapshot del carrito (correo + items) para poder recuperarlo
-- después (por WhatsApp manual hoy, o por correo cuando conectes un ESP
-- tipo Resend/Klaviyo). La escritura la hace el server con service_role
-- (endpoint /api/cart-save), por eso NO se exponen políticas de insert al
-- cliente: con RLS activado y sin políticas, el anon/auth no puede leer ni
-- escribir directo, solo el service_role (que las omite).
-- ============================================================

create table if not exists public.abandoned_carts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  email       text,
  items       jsonb not null,
  total       numeric not null default 0,
  recovered   boolean not null default false,
  updated_at  timestamptz not null default now(),
  unique (email)
);

alter table public.abandoned_carts enable row level security;
-- Sin políticas: solo el service_role (server) puede leer/escribir.

create index if not exists abandoned_carts_email_idx on public.abandoned_carts(email);
create index if not exists abandoned_carts_user_idx on public.abandoned_carts(user_id);
