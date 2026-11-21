-- Fase 7 — Sincronização (Pro: sync.cloud). Local-first: o aparelho é a fonte da verdade;
-- o servidor guarda cópias com Last-Write-Wins por updated_at (relógio do cliente) e tombstones.
-- server_updated_at (relógio do servidor) é o cursor de pull.

-- ---------------------------------------------------------------------------
-- Famílias (conta compartilhada) — limite members.max imposto por trigger
-- ---------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Família',
  owner_id uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;

create or replace function public.my_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select household_id from public.household_members where user_id = (select auth.uid());
$$;

create policy "households: membros leem" on public.households for select to authenticated
  using (id in (select public.my_household_ids()));
create policy "households: dono atualiza" on public.households for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "members: membros leem" on public.household_members for select to authenticated
  using (household_id in (select public.my_household_ids()));
create policy "members: dono remove ou membro sai" on public.household_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    or household_id in (select id from public.households where owner_id = (select auth.uid()))
  );

-- Limite de membros = members.max do DONO da família.
create or replace function public.enforce_members_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
  lim numeric;
  cnt int;
begin
  select owner_id into owner from public.households where id = new.household_id;
  lim := public.feature_limit(owner, 'members.max');
  select count(*) into cnt from public.household_members where household_id = new.household_id;
  if lim is not null and cnt >= lim then
    raise exception 'limit_reached:members.max' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger household_members_limit before insert on public.household_members
  for each row execute function public.enforce_members_limit();

create or replace function public.create_household(p_name text default 'Família')
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.households;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  insert into public.households (name, owner_id) values (coalesce(nullif(trim(p_name), ''), 'Família'), auth.uid())
  returning * into h;
  insert into public.household_members (household_id, user_id, role) values (h.id, auth.uid(), 'owner');
  return h;
end;
$$;
grant execute on function public.create_household(text) to authenticated;

create or replace function public.join_household(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select id into hid from public.households where invite_code = upper(trim(p_code));
  if hid is null then raise exception 'invalid_code' using errcode = 'P0002'; end if;
  insert into public.household_members (household_id, user_id) values (hid, auth.uid())
  on conflict do nothing;
  return hid;
end;
$$;
grant execute on function public.join_household(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Tabelas sincronizadas
-- ---------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  name text not null check (char_length(name) between 1 and 40),
  type text not null check (type in ('checking', 'savings', 'credit_card', 'cash', 'investment', 'other')),
  initial_balance_cents bigint not null default 0,
  color text not null,
  icon text not null,
  archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  slug text,
  name text not null check (char_length(name) between 1 and 30),
  kind text not null check (kind in ('expense', 'income')),
  icon text not null,
  color text not null,
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  kind text not null check (kind in ('expense', 'income', 'transfer')),
  amount_cents bigint not null check (amount_cents > 0),
  description text not null default '' check (char_length(description) <= 80),
  category_id uuid,
  account_id uuid not null,
  to_account_id uuid,
  date date not null,
  notes text check (char_length(notes) <= 500),
  recurrence text not null default 'none' check (recurrence in ('none', 'weekly', 'monthly', 'yearly')),
  recurrence_parent_id uuid,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table public.budgets (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  category_id uuid not null,
  limit_cents bigint not null check (limit_cents > 0),
  start_month text not null check (start_month ~ '^\d{4}-\d{2}$'),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  name text not null check (char_length(name) between 1 and 40),
  target_cents bigint not null check (target_cents > 0),
  saved_cents bigint not null default 0 check (saved_cents >= 0),
  deadline date,
  icon text not null,
  color text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table public.bills (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  name text not null check (char_length(name) between 1 and 40),
  amount_cents bigint not null check (amount_cents > 0),
  due_date date not null,
  category_id uuid,
  recurrence text not null default 'none' check (recurrence in ('none', 'weekly', 'monthly', 'yearly')),
  paid_at timestamptz,
  remind_days_before int not null default 1 check (remind_days_before between 0 and 30),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create or replace function public.touch_server_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- Índices de cursor e RLS + server_updated_at automático + RLS
do $$
declare
  t text;
begin
  foreach t in array array['accounts', 'categories', 'transactions', 'budgets', 'goals', 'bills'] loop
    execute format('create index %1$s_user_cursor_idx on public.%1$s (user_id, server_updated_at)', t);
    execute format('create index %1$s_household_idx on public.%1$s (household_id) where household_id is not null', t);
    execute format('alter table public.%s enable row level security', t);
    execute format($p$create policy "%1$s: dono ou família lê" on public.%1$s for select to authenticated
      using (user_id = (select auth.uid()) or household_id in (select public.my_household_ids()))$p$, t);
    execute format($p$create policy "%1$s: dono ou família insere" on public.%1$s for insert to authenticated
      with check (user_id = (select auth.uid())
        and (household_id is null or household_id in (select public.my_household_ids())))$p$, t);
    execute format($p$create policy "%1$s: dono ou família altera" on public.%1$s for update to authenticated
      using (user_id = (select auth.uid()) or household_id in (select public.my_household_ids()))
      with check (household_id is null or household_id in (select public.my_household_ids()) or user_id = (select auth.uid()))$p$, t);
    -- Sem policy de DELETE: exclusão é sempre tombstone (deleted_at), propagada pelo sync.
    execute format('create trigger %1$s_server_updated_at before insert or update on public.%1$s
      for each row execute function public.touch_server_updated_at()', t);
  end loop;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- Limites do plano impostos no servidor (o app também bloqueia, mas não é confiável).
-- Só bloqueia CRIAÇÃO de itens ativos além do limite; dados existentes nunca são apagados.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_row_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  feature text := tg_argv[0];
  lim numeric;
  cnt int;
  becoming_active boolean;
begin
  becoming_active := new.deleted_at is null and (
    tg_op = 'INSERT' or old.deleted_at is not null
    or (tg_table_name = 'accounts'
        and coalesce((to_jsonb(old) ->> 'archived')::boolean, false)
        and not coalesce((to_jsonb(new) ->> 'archived')::boolean, false))
  );
  if not becoming_active then return new; end if;
  if tg_table_name = 'accounts' and coalesce((to_jsonb(new) ->> 'archived')::boolean, false) then
    return new;
  end if;

  lim := public.feature_limit(new.user_id, feature);
  if lim is null then return new; end if;

  execute format(
    'select count(*) from public.%I where user_id = $1 and deleted_at is null and id <> $2 %s',
    tg_table_name,
    case when tg_table_name = 'accounts' then 'and not archived' else '' end
  ) into cnt using new.user_id, new.id;

  if cnt >= lim then
    raise exception 'limit_reached:%', feature using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger accounts_limit before insert or update on public.accounts
  for each row execute function public.enforce_row_limit('accounts.max');
create trigger budgets_limit before insert or update on public.budgets
  for each row execute function public.enforce_row_limit('budgets.max');
create trigger goals_limit before insert or update on public.goals
  for each row execute function public.enforce_row_limit('goals.max');

-- ---------------------------------------------------------------------------
-- Push com Last-Write-Wins, linha a linha (uma linha rejeitada não derruba o lote).
-- security invoker: RLS continua valendo. Exige sync.cloud.
-- ---------------------------------------------------------------------------
create or replace function public.sync_push(p_table text, p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  row_json jsonb;
  cols text;
  updates text;
  applied int := 0;
  stale int := 0;
  rejected jsonb := '[]'::jsonb;
  n int;
begin
  if p_table not in ('accounts', 'categories', 'transactions', 'budgets', 'goals', 'bills') then
    raise exception 'invalid_table' using errcode = '22023';
  end if;
  if coalesce((public.my_entitlements() -> 'features' ->> 'sync.cloud')::boolean, false) is not true then
    raise exception 'sync_not_allowed' using errcode = '42501';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'batch_too_large' using errcode = '22023';
  end if;

  -- Colunas graváveis pelo cliente (exclui user_id e server_updated_at).
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position),
         string_agg(format('%1$I = excluded.%1$I', column_name), ', ' order by ordinal_position)
    into cols, updates
    from information_schema.columns
   where table_schema = 'public' and table_name = p_table
     and column_name not in ('user_id', 'server_updated_at');

  for row_json in select * from jsonb_array_elements(p_rows) loop
    begin
      execute format(
        'insert into public.%1$I (%2$s, user_id)
         select %2$s, auth.uid() from jsonb_populate_record(null::public.%1$I, $1)
         on conflict (id) do update set %3$s
         where public.%1$I.updated_at < excluded.updated_at',
        p_table, cols, updates
      ) using row_json;
      get diagnostics n = row_count;
      if n > 0 then applied := applied + 1; else stale := stale + 1; end if;
    exception when others then
      rejected := rejected || jsonb_build_object('id', row_json ->> 'id', 'reason', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('applied', applied, 'stale', stale, 'rejected', rejected, 'server_time', now());
end;
$$;
grant execute on function public.sync_push(text, jsonb) to authenticated;
