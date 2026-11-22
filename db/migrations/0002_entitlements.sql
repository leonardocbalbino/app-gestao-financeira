-- Fase 4 — Entitlements: planos, catálogo de features, matriz, overrides, assinaturas,
-- concessões manuais, configurações remotas, admins e auditoria.
-- Regra: o app NUNCA decide "é Pro"; ele consulta get_entitlements / my_entitlements.

-- ---------------------------------------------------------------------------
-- Admins e papéis
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references public.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

-- Verifica se o usuário atual é admin com papel mínimo.
create or replace function public.is_admin(min_role text default 'viewer')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
    where a.user_id = (select app.uid())
      and case min_role
            when 'viewer' then a.role in ('viewer', 'editor', 'owner')
            when 'editor' then a.role in ('editor', 'owner')
            when 'owner'  then a.role = 'owner'
            else false
          end
  );
$$;

create policy "admins: admins leem" on public.admins for select to app_user
  using ((select public.is_admin('viewer')));
create policy "admins: owner gerencia" on public.admins for all to app_user
  using ((select public.is_admin('owner'))) with check ((select public.is_admin('owner')));

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security;
create policy "audit: admins leem" on public.admin_audit_log for select to app_user
  using ((select public.is_admin('viewer')));

create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pk text := tg_argv[0];
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.admin_audit_log (actor_id, action, entity, entity_id, before, after)
  values (
    app.uid(),
    lower(tg_op),
    tg_table_name,
    case when pk is null then null
         else (select string_agg(rec ->> k, ':') from unnest(string_to_array(pk, ',')) k) end,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Planos e catálogo
-- ---------------------------------------------------------------------------
create table public.plans (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  name text not null,
  description text not null default '',
  is_default boolean not null default false,
  sort_order int not null default 0,
  rc_entitlement text unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index plans_single_default on public.plans (is_default) where is_default;
create trigger plans_set_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

create table public.features (
  key text primary key check (key ~ '^[a-z]+\.[a-z_]+$'),
  type text not null check (type in ('boolean', 'limit', 'ads')),
  label text not null,
  description text not null default '',
  group_name text not null,
  default_value jsonb not null,
  paywall_label text not null,
  paywall_visible boolean not null default true,
  sort_order int not null default 0,
  constraint features_default_matches_type check (
    (type in ('boolean', 'ads') and jsonb_typeof(default_value) = 'boolean')
    or (type = 'limit' and jsonb_typeof(default_value) in ('number', 'null'))
  )
);

-- Valida o tipo do valor contra a feature (boolean | número >= 0 | null = ilimitado).
create or replace function public.feature_value_valid(fkey text, val jsonb)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case f.type
    when 'limit' then jsonb_typeof(val) = 'null'
      or (jsonb_typeof(val) = 'number' and (val #>> '{}')::numeric >= 0)
    else jsonb_typeof(val) = 'boolean'
  end
  from public.features f where f.key = fkey;
$$;

-- Matriz publicada (lida pelo app).
create table public.plan_features (
  plan_id text not null references public.plans (id) on delete cascade,
  feature_key text not null references public.features (key) on delete cascade,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (plan_id, feature_key),
  constraint plan_features_value_valid check (public.feature_value_valid(feature_key, value))
);

-- Rascunho editado no admin; publish_plan_matrix() copia para plan_features.
create table public.plan_features_draft (
  plan_id text not null references public.plans (id) on delete cascade,
  feature_key text not null references public.features (key) on delete cascade,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (plan_id, feature_key),
  constraint plan_features_draft_value_valid check (public.feature_value_valid(feature_key, value))
);

-- ---------------------------------------------------------------------------
-- Overrides por usuário, assinaturas e concessões manuais
-- ---------------------------------------------------------------------------
create table public.user_plan_overrides (
  user_id uuid not null references public.users (id) on delete cascade,
  feature_key text not null references public.features (key) on delete cascade,
  value jsonb not null,
  reason text not null default '',
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, feature_key),
  constraint overrides_value_valid check (public.feature_value_valid(feature_key, value))
);

create table public.subscriptions (
  user_id uuid primary key references public.users (id) on delete cascade,
  rc_entitlement text not null,
  status text not null check (status in ('active', 'in_grace', 'cancelled', 'billing_issue', 'expired')),
  store text,
  product_id text,
  period_type text,
  expires_at timestamptz,
  original_transaction_id text,
  last_event_id text,
  last_event_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.manual_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  plan_id text not null references public.plans (id),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  reason text not null default '',
  granted_by uuid,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint manual_grants_period check (expires_at is null or expires_at > starts_at)
);
create index manual_grants_user_idx on public.manual_grants (user_id);

-- ---------------------------------------------------------------------------
-- Configuração remota (linha única)
-- ---------------------------------------------------------------------------
create table public.app_config (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.ad_config (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger app_config_set_updated_at before update on public.app_config
  for each row execute function public.set_updated_at();
create trigger ad_config_set_updated_at before update on public.ad_config
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.features enable row level security;
alter table public.plan_features enable row level security;
alter table public.plan_features_draft enable row level security;
alter table public.user_plan_overrides enable row level security;
alter table public.subscriptions enable row level security;
alter table public.manual_grants enable row level security;
alter table public.app_config enable row level security;
alter table public.ad_config enable row level security;

-- Catálogo/matriz publicada: leitura pública (paywall funciona antes do login).
create policy "plans: leitura pública" on public.plans for select to app_user using (true);
create policy "features: leitura pública" on public.features for select to app_user using (true);
create policy "plan_features: leitura pública" on public.plan_features for select to app_user using (true);
create policy "app_config: leitura pública" on public.app_config for select to app_user using (true);
create policy "ad_config: leitura pública" on public.ad_config for select to app_user using (true);

-- Escrita: editores.
create policy "plans: editores escrevem" on public.plans for all to app_user
  using ((select public.is_admin('editor'))) with check ((select public.is_admin('editor')));
create policy "features: editores escrevem" on public.features for all to app_user
  using ((select public.is_admin('editor'))) with check ((select public.is_admin('editor')));
create policy "draft: admins leem" on public.plan_features_draft for select to app_user
  using ((select public.is_admin('viewer')));
create policy "draft: editores escrevem" on public.plan_features_draft for all to app_user
  using ((select public.is_admin('editor'))) with check ((select public.is_admin('editor')));
create policy "app_config: editores escrevem" on public.app_config for update to app_user
  using ((select public.is_admin('editor'))) with check ((select public.is_admin('editor')));
create policy "ad_config: editores escrevem" on public.ad_config for update to app_user
  using ((select public.is_admin('editor'))) with check ((select public.is_admin('editor')));

-- Dados por usuário: dono lê os próprios; admins leem tudo; editores escrevem overrides/grants.
create policy "overrides: dono ou admin lê" on public.user_plan_overrides for select to app_user
  using (user_id = (select app.uid()) or (select public.is_admin('viewer')));
create policy "overrides: editores escrevem" on public.user_plan_overrides for all to app_user
  using ((select public.is_admin('editor'))) with check ((select public.is_admin('editor')));
create policy "subscriptions: dono ou admin lê" on public.subscriptions for select to app_user
  using (user_id = (select app.uid()) or (select public.is_admin('viewer')));
-- (escrita de subscriptions apenas via service_role no webhook — sem policy de escrita)
create policy "grants: dono ou admin lê" on public.manual_grants for select to app_user
  using (user_id = (select app.uid()) or (select public.is_admin('viewer')));
create policy "grants: editores escrevem" on public.manual_grants for all to app_user
  using ((select public.is_admin('editor'))) with check ((select public.is_admin('editor')));

-- Auditoria automática das tabelas administrativas.
create trigger audit_plans after insert or update or delete on public.plans
  for each row execute function public.audit_row('id');
create trigger audit_features after insert or update or delete on public.features
  for each row execute function public.audit_row('key');
create trigger audit_plan_features after insert or update or delete on public.plan_features
  for each row execute function public.audit_row('plan_id,feature_key');
create trigger audit_overrides after insert or update or delete on public.user_plan_overrides
  for each row execute function public.audit_row('user_id,feature_key');
create trigger audit_grants after insert or update or delete on public.manual_grants
  for each row execute function public.audit_row('id');
create trigger audit_app_config after update on public.app_config
  for each row execute function public.audit_row('id');
create trigger audit_ad_config after update on public.ad_config
  for each row execute function public.audit_row('id');
create trigger audit_admins after insert or update or delete on public.admins
  for each row execute function public.audit_row('user_id');

-- ---------------------------------------------------------------------------
-- Resolução de entitlements
-- Prioridade: override do usuário → plano efetivo (concessão manual > assinatura > padrão)
--             → valor do plano na matriz → default do catálogo.
-- ---------------------------------------------------------------------------
create or replace function public.get_effective_plan(p_user uuid)
returns table (plan_id text, source text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  (
    select g.plan_id, 'manual_grant'::text, g.expires_at
    from public.manual_grants g
    join public.plans p on p.id = g.plan_id
    where g.user_id = p_user
      and g.revoked_at is null
      and g.starts_at <= now()
      and (g.expires_at is null or g.expires_at > now())
    order by p.sort_order desc, g.expires_at desc nulls first
    limit 1
  )
  union all
  (
    select p.id, 'subscription'::text, s.expires_at
    from public.subscriptions s
    join public.plans p on p.rc_entitlement = s.rc_entitlement and p.active
    where s.user_id = p_user
      and s.status in ('active', 'in_grace', 'cancelled', 'billing_issue')
      and (s.expires_at is null or s.expires_at > now())
    limit 1
  )
  union all
  (
    select p.id, 'default'::text, null::timestamptz
    from public.plans p where p.is_default
    limit 1
  )
  limit 1;
$$;

create or replace function public.get_entitlements(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ep record;
  result jsonb;
begin
  select * into ep from public.get_effective_plan(p_user);

  select jsonb_object_agg(
           f.key,
           coalesce(
             (select o.value from public.user_plan_overrides o
               where o.user_id = p_user and o.feature_key = f.key
                 and (o.expires_at is null or o.expires_at > now())),
             (select pf.value from public.plan_features pf
               where pf.plan_id = ep.plan_id and pf.feature_key = f.key),
             f.default_value
           )
         )
    into result
    from public.features f;

  return jsonb_build_object(
    'plan_id', coalesce(ep.plan_id, 'free'),
    'plan_name', coalesce((select p.name from public.plans p where p.id = ep.plan_id), 'Free'),
    'source', coalesce(ep.source, 'default'),
    'expires_at', ep.expires_at,
    'features', coalesce(result, '{}'::jsonb),
    'resolved_at', now()
  );
end;
$$;

-- get_entitlements de qualquer usuário: apenas service_role e admins (via wrapper).
revoke execute on function public.get_entitlements(uuid) from public, app_user;
revoke execute on function public.get_effective_plan(uuid) from public, app_user;

create or replace function public.my_entitlements()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_entitlements((select app.uid()));
$$;
revoke execute on function public.my_entitlements() from public;
grant execute on function public.my_entitlements() to app_user;

create or replace function public.admin_get_entitlements(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin('viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return public.get_entitlements(p_user);
end;
$$;
grant execute on function public.admin_get_entitlements(uuid) to app_user;

-- Limite numérico de uma feature para o usuário (null = ilimitado). Usado nos triggers de sync.
create or replace function public.feature_limit(p_user uuid, p_key text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case jsonb_typeof(public.get_entitlements(p_user) -> 'features' -> p_key)
    when 'number' then (public.get_entitlements(p_user) -> 'features' ->> p_key)::numeric
    else null
  end;
$$;
revoke execute on function public.feature_limit(uuid, text) from public, app_user;

-- Matriz pública para a tabela comparativa do paywall.
create or replace function public.get_plan_matrix()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'plans', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'is_default', p.is_default,
        'sort_order', p.sort_order, 'rc_entitlement', p.rc_entitlement) order by p.sort_order)
      from public.plans p where p.active), '[]'::jsonb),
    'values', coalesce((select jsonb_agg(jsonb_build_object(
        'plan_id', pf.plan_id, 'feature_key', pf.feature_key, 'value', pf.value))
      from public.plan_features pf join public.plans p on p.id = pf.plan_id and p.active), '[]'::jsonb),
    'paywall_keys', coalesce((select jsonb_agg(f.key order by f.sort_order)
      from public.features f where f.paywall_visible), '[]'::jsonb)
  );
$$;
grant execute on function public.get_plan_matrix() to app_user;

-- Config remota consolidada (app consulta a cada ~60 s).
create or replace function public.get_remote_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'app', (select data from public.app_config where id = 1),
    'ads', (select data from public.ad_config where id = 1),
    'updated_at', greatest(
      (select updated_at from public.app_config where id = 1),
      (select updated_at from public.ad_config where id = 1),
      (select max(updated_at) from public.plan_features)
    )
  );
$$;
grant execute on function public.get_remote_config() to app_user;

-- ---------------------------------------------------------------------------
-- Publicação da matriz (preview/diff no admin)
-- ---------------------------------------------------------------------------
create or replace function public.plan_matrix_diff()
returns table (plan_id text, feature_key text, live jsonb, draft jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(d.plan_id, l.plan_id), coalesce(d.feature_key, l.feature_key), l.value, d.value
  from public.plan_features_draft d
  full join public.plan_features l on l.plan_id = d.plan_id and l.feature_key = d.feature_key
  where public.is_admin('viewer') and l.value is distinct from d.value
  order by 1, 2;
$$;
grant execute on function public.plan_matrix_diff() to app_user;

create or replace function public.publish_plan_matrix()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed int;
begin
  if not public.is_admin('editor') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select count(*) into changed from public.plan_matrix_diff();
  delete from public.plan_features l
   where not exists (select 1 from public.plan_features_draft d
                      where d.plan_id = l.plan_id and d.feature_key = l.feature_key);
  insert into public.plan_features (plan_id, feature_key, value, updated_at)
  select plan_id, feature_key, value, now() from public.plan_features_draft
  on conflict (plan_id, feature_key) do update
    set value = excluded.value, updated_at = now()
    where public.plan_features.value is distinct from excluded.value;
  insert into public.admin_audit_log (actor_id, action, entity, after)
  values (app.uid(), 'publish', 'plan_matrix', jsonb_build_object('changes', changed));
  return changed;
end;
$$;
grant execute on function public.publish_plan_matrix() to app_user;

-- ---------------------------------------------------------------------------
-- Dados iniciais (espelham packages/shared/src/features.ts — teste garante sincronia)
-- ---------------------------------------------------------------------------
insert into public.features (key, type, label, description, group_name, default_value, paywall_label, sort_order) values
  ('export.pdf', 'boolean', 'Exportar PDF', 'Gerar relatório mensal em PDF', 'Exportação', 'false', 'Relatório em PDF', 10),
  ('export.csv', 'boolean', 'Exportar CSV', 'Exportar transações em CSV', 'Exportação', 'false', 'Exportar planilha CSV', 20),
  ('bills.reminders', 'boolean', 'Lembretes de contas', 'Notificações antes do vencimento', 'Lembretes', 'false', 'Lembretes de contas a pagar', 30),
  ('sync.cloud', 'boolean', 'Sincronização na nuvem', 'Backup e sincronização entre aparelhos', 'Sincronização', 'false', 'Backup e sincronização', 40),
  ('reports.advanced', 'boolean', 'Relatórios avançados', 'Comparativos, tendências e categorias detalhadas', 'Relatórios', 'false', 'Relatórios avançados', 50),
  ('insights.monthly', 'boolean', 'Insights mensais', 'Resumo inteligente do mês', 'Relatórios', 'false', 'Insights do mês', 60),
  ('transactions.recurring', 'boolean', 'Transações recorrentes', 'Lançamentos automáticos mensais', 'Organização', 'false', 'Transações recorrentes', 70),
  ('categories.custom', 'boolean', 'Categorias personalizadas', 'Criar e editar categorias', 'Organização', 'false', 'Categorias personalizadas', 80),
  ('budgets.alerts', 'boolean', 'Alertas de orçamento', 'Aviso ao atingir 80% e 100%', 'Lembretes', 'false', 'Alertas de orçamento', 90),
  ('accounts.max', 'limit', 'Contas', 'Quantidade de contas/carteiras', 'Limites', '2', 'Contas e carteiras', 100),
  ('budgets.max', 'limit', 'Orçamentos', 'Orçamentos por categoria ativos', 'Limites', '3', 'Orçamentos por categoria', 110),
  ('goals.max', 'limit', 'Metas', 'Metas de economia ativas', 'Limites', '1', 'Metas de economia', 120),
  ('history.months', 'limit', 'Histórico', 'Meses de histórico visíveis nos relatórios', 'Limites', '3', 'Meses de histórico', 130),
  ('members.max', 'limit', 'Membros', 'Pessoas na conta compartilhada (família)', 'Limites', '1', 'Pessoas compartilhando', 140),
  ('ads.show', 'ads', 'Exibir anúncios', 'Quando verdadeiro, o app exibe anúncios', 'Anúncios', 'true', 'Sem anúncios', 150);

insert into public.plans (id, name, description, is_default, sort_order, rc_entitlement) values
  ('free', 'Free', 'Essencial para organizar suas finanças', true, 0, null),
  ('pro', 'Pro', 'Tudo liberado, sem anúncios', false, 1, 'pro');

-- Free = defaults do catálogo; Pro = tudo liberado, limites ilimitados (null), sem anúncios.
insert into public.plan_features (plan_id, feature_key, value)
select 'free', key, default_value from public.features;
insert into public.plan_features (plan_id, feature_key, value)
select 'pro', key,
  case type
    when 'boolean' then 'true'::jsonb
    when 'ads' then 'false'::jsonb
    else case key when 'members.max' then '5'::jsonb else 'null'::jsonb end
  end
from public.features;
insert into public.plan_features_draft (plan_id, feature_key, value)
select plan_id, feature_key, value from public.plan_features;

insert into public.app_config (id, data) values (1, jsonb_build_object(
  'min_app_version', '1.0.0',
  'maintenance_mode', false,
  'maintenance_message', '',
  'paywall_default_plan', 'annual',
  'feature_flags', '{}'::jsonb
));
insert into public.ad_config (id, data) values (1, jsonb_build_object(
  'enabled', true,
  'placements', jsonb_build_object(
    'banner_home', true, 'banner_budgets', true, 'banner_reports', true,
    'native_transactions', true, 'interstitial', false),
  'native_every_n', 8,
  'interstitial_min_interval_sec', 300,
  'ad_unit_ids', jsonb_build_object('ios', '{}'::jsonb, 'android', '{}'::jsonb)
));
