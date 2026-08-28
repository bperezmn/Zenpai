-- ============================================================
-- zenpai · F4 fase 1: respaldo en la nube
-- Pegar COMPLETO en el SQL Editor del dashboard de Supabase y Run.
-- RLS estricto desde el día 1: cada quien ve SOLO lo suyo.
-- ============================================================

-- Cultivos: el estado completo de cada cultivo como jsonb
-- (esquema flexible: la app evoluciona sin migraciones de columnas)
create table if not exists public.grows (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.grows enable row level security;
create policy "grows propios" on public.grows
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Bitácora: eventos append-only. local_id es el id de Dexie en el dispositivo;
-- el índice único (user_id, grow_id, local_id) hace la subida idempotente.
create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  grow_id text not null,
  local_id bigint not null,
  ts timestamptz not null,
  data jsonb not null
);
alter table public.events enable row level security;
create policy "events propios" on public.events
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create unique index if not exists events_dedupe
  on public.events (user_id, grow_id, local_id);
create index if not exists events_por_usuario
  on public.events (user_id, grow_id);

-- Fotos: bucket PRIVADO; cada usuario solo toca su carpeta ({uid}/foto.jpg)
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy "fotos propias sel" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos propias ins" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos propias upd" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos propias del" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
