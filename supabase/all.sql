-- ============================================================
-- AMANTI · TODO EN UNO — pega este bloque completo en
-- Supabase → SQL Editor → New query → Run. Es idempotente
-- (se puede correr varias veces sin romper nada).
-- Incluye: leads · wishlist · reviews · orders.gift · abandoned_carts
-- ============================================================

-- ---------- 1) LEADS (welcome modal / newsletter) ----------
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  source      text,
  created_at  timestamptz not null default now()
);
alter table public.leads enable row level security;
-- Cualquiera puede registrar su correo; nadie puede leerlos vía API (solo dashboard/service_role).
drop policy if exists "leads_insert_anyone" on public.leads;
create policy "leads_insert_anyone" on public.leads
  for insert with check (true);

-- ---------- 2) WISHLIST (favoritos en la nube) ----------
create table if not exists public.wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  slug        text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, slug)
);
alter table public.wishlist_items enable row level security;
drop policy if exists "wishlist_select_own" on public.wishlist_items;
create policy "wishlist_select_own" on public.wishlist_items for select using (auth.uid() = user_id);
drop policy if exists "wishlist_insert_own" on public.wishlist_items;
create policy "wishlist_insert_own" on public.wishlist_items for insert with check (auth.uid() = user_id);
drop policy if exists "wishlist_delete_own" on public.wishlist_items;
create policy "wishlist_delete_own" on public.wishlist_items for delete using (auth.uid() = user_id);
create index if not exists wishlist_items_user_idx on public.wishlist_items(user_id);

-- ---------- 3) REVIEWS (reseñas reales) ----------
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
drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_public_read" on public.reviews for select using (true);
drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own" on public.reviews for insert with check (auth.uid() = user_id);
drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own" on public.reviews for update using (auth.uid() = user_id);
drop policy if exists "reviews_delete_own" on public.reviews;
create policy "reviews_delete_own" on public.reviews for delete using (auth.uid() = user_id);
create index if not exists reviews_slug_idx on public.reviews(product_slug);

-- ---------- 4) MODO REGALO (columna en orders) ----------
alter table public.orders add column if not exists gift jsonb;

-- ---------- 5) CARRITOS ABANDONADOS (captura) ----------
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
-- Sin políticas: solo el server (service_role) lee/escribe.
create index if not exists abandoned_carts_email_idx on public.abandoned_carts(email);
create index if not exists abandoned_carts_user_idx on public.abandoned_carts(user_id);
