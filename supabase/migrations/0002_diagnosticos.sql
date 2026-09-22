-- ============================================================
-- zenpai · diagnóstico por foto: registro de uso para el límite diario
-- (la función diagnose permite 10 por usuario cada 24 h).
-- Pegar COMPLETO en el SQL Editor del dashboard de Supabase y Run.
-- Solo guarda quién y cuándo: nunca la foto ni el resultado.
-- ============================================================

create table if not exists public.diagnosticos (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.diagnosticos enable row level security;

-- cada quien inserta y ve SOLO sus filas; sin update ni delete (el contador no se puede vaciar)
drop policy if exists "diagnosticos propios ins" on public.diagnosticos;
create policy "diagnosticos propios ins" on public.diagnosticos
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "diagnosticos propios sel" on public.diagnosticos;
create policy "diagnosticos propios sel" on public.diagnosticos
  for select to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists diagnosticos_por_usuario
  on public.diagnosticos (user_id, created_at desc);
