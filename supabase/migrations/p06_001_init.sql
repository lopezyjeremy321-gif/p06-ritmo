-- Ritmo (P06) - esquema inicial. IDEMPOTENTE: se puede ejecutar varias veces.
-- Sin sentencias destructivas; no toca auth.*, storage.* ni objetos que no empiecen por p06_.
-- Pensado para el esquema public de un proyecto Supabase COMPARTIDO: todo lleva prefijo p06_
-- y no toca nada ajeno (sin event triggers globales, sin tocar auth.users).
-- Reglas: user_id lo pone el servidor (default auth.uid()); RLS en cada tabla; politicas por
-- operacion con (select auth.uid()) para que Postgres lo evalue una vez por consulta (initplan).

-- ---------------------------------------------------------------- tablas
create table if not exists public.p06_habits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  icon          text not null default 'check-circle' check (icon ~ '^[a-z0-9-]{1,32}$'),
  weekly_target smallint not null default 7 check (weekly_target between 1 and 7),
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.p06_habit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id   uuid not null references public.p06_habits (id) on delete cascade,
  log_date   date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

create table if not exists public.p06_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('gasto', 'ingreso')),
  amount_cents bigint not null check (amount_cents between 1 and 100000000000),
  category     text not null check (char_length(category) between 1 and 40),
  note         text not null default '' check (char_length(note) <= 200),
  occurred_on  date not null default current_date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists p06_habits_user_idx      on public.p06_habits (user_id, created_at desc);
create index if not exists p06_habit_logs_user_idx  on public.p06_habit_logs (user_id, log_date desc);
create index if not exists p06_habit_logs_habit_idx on public.p06_habit_logs (habit_id);
create index if not exists p06_entries_user_idx     on public.p06_entries (user_id, occurred_on desc);

-- ------------------------------------------------ updated_at lo fija el servidor
create or replace function public.p06_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.user_id    := old.user_id;     -- el dueno no se puede cambiar
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

do $$ begin if not exists (select 1 from pg_trigger where tgname = 'p06_habits_touch' and tgrelid = 'public.p06_habits'::regclass) then create trigger p06_habits_touch before insert or update on public.p06_habits for each row execute function public.p06_touch_updated_at(); end if; end $$;
do $$ begin if not exists (select 1 from pg_trigger where tgname = 'p06_habit_logs_touch' and tgrelid = 'public.p06_habit_logs'::regclass) then create trigger p06_habit_logs_touch before insert or update on public.p06_habit_logs for each row execute function public.p06_touch_updated_at(); end if; end $$;
do $$ begin if not exists (select 1 from pg_trigger where tgname = 'p06_entries_touch' and tgrelid = 'public.p06_entries'::regclass) then create trigger p06_entries_touch before insert or update on public.p06_entries for each row execute function public.p06_touch_updated_at(); end if; end $$;

-- Un log solo puede apuntar a un habito del mismo usuario.
create or replace function public.p06_habit_logs_same_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.p06_habits h where h.id = new.habit_id and h.user_id = new.user_id) then
    raise exception 'habit_not_owned' using errcode = '42501';
  end if;
  return new;
end $$;
do $$ begin if not exists (select 1 from pg_trigger where tgname = 'p06_habit_logs_owner' and tgrelid = 'public.p06_habit_logs'::regclass) then create trigger p06_habit_logs_owner before insert or update on public.p06_habit_logs for each row execute function public.p06_habit_logs_same_owner(); end if; end $$;

-- ---------------------------------------------------------------- RLS
alter table public.p06_habits     enable row level security;
alter table public.p06_habit_logs enable row level security;
alter table public.p06_entries    enable row level security;
alter table public.p06_habits     force row level security;
alter table public.p06_habit_logs force row level security;
alter table public.p06_entries    force row level security;

revoke all on public.p06_habits, public.p06_habit_logs, public.p06_entries from anon, public;
grant select, insert, update, delete on public.p06_habits, public.p06_habit_logs, public.p06_entries to authenticated;

do $$
declare t text;
begin
  foreach t in array array['p06_habits', 'p06_habit_logs', 'p06_entries'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_select_own') then
      execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select_own', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_insert_own') then
      execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert_own', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_update_own') then
      execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update_own', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_delete_own') then
      execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete_own', t);
    end if;
  end loop;
end $$;

-- ------------------------------------------------ borrar MIS datos de Ritmo (ciclo de vida)
-- No borra la cuenta de auth (proyecto compartido con otras apps): solo los datos p06_.
create or replace function public.p06_delete_my_data() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  delete from public.p06_habits  where user_id = uid;   -- cascada a p06_habit_logs
  delete from public.p06_entries where user_id = uid;
end $$;
revoke all on function public.p06_delete_my_data() from public, anon;
grant execute on function public.p06_delete_my_data() to authenticated;

-- ---------------------------------------------------------------- realtime
-- UNICO toque fuera de las tablas p06_: anadir SOLO nuestras tablas a la publicacion de realtime
-- (si la publicacion existe y no es FOR ALL TABLES). No quita ni cambia nada existente.
-- Realtime respeta RLS: cada suscriptor solo recibe eventos de filas que puede leer.
do $$
declare t text;
begin
  foreach t in array array['p06_habits', 'p06_habit_logs', 'p06_entries'] loop
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
       and not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
