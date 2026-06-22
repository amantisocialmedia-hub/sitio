-- ============================================================
-- AMANTI · Favoritos sincronizados a la cuenta (wishlist en la nube)
-- Ejecuta este SQL en Supabase → SQL Editor (una sola vez).
-- RLS: cada usuario solo puede ver/editar sus propios favoritos.
-- Mientras no exista esta tabla, los favoritos siguen funcionando
-- en localStorage (el plugin degrada con gracia, no rompe nada).
-- ============================================================

create table if not exists public.wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  slug        text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, slug)
);

alter table public.wishlist_items enable row level security;

-- Cada usuario gestiona únicamente sus filas.
drop policy if exists "wishlist_select_own" on public.wishlist_items;
create policy "wishlist_select_own" on public.wishlist_items
  for select using (auth.uid() = user_id);

drop policy if exists "wishlist_insert_own" on public.wishlist_items;
create policy "wishlist_insert_own" on public.wishlist_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "wishlist_delete_own" on public.wishlist_items;
create policy "wishlist_delete_own" on public.wishlist_items
  for delete using (auth.uid() = user_id);

create index if not exists wishlist_items_user_idx on public.wishlist_items(user_id);
