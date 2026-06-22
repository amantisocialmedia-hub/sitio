-- ============================================================
-- AMANTI · Reseñas reales de clientes
-- Ejecuta este SQL en Supabase → SQL Editor (una sola vez).
-- Lectura pública; solo usuarios autenticados dejan UNA reseña por producto.
-- Mientras no exista la tabla, la ficha muestra solo las reseñas curadas
-- (el front degrada con gracia y el formulario avisa sin romper).
-- ============================================================

create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  product_slug  text not null,
  author_name   text not null,
  rating        int  not null check (rating between 1 and 5),
  text          text not null,
  created_at    timestamptz not null default now(),
  unique (user_id, product_slug)
);

alter table public.reviews enable row level security;

-- Lectura pública (cualquiera ve las reseñas en la ficha).
drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_public_read" on public.reviews
  for select using (true);

-- Cada usuario gestiona únicamente su propia reseña.
drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own" on public.reviews
  for insert with check (auth.uid() = user_id);

drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own" on public.reviews
  for update using (auth.uid() = user_id);

drop policy if exists "reviews_delete_own" on public.reviews;
create policy "reviews_delete_own" on public.reviews
  for delete using (auth.uid() = user_id);

create index if not exists reviews_slug_idx on public.reviews(product_slug);
