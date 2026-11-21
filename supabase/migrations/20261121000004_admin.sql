-- Fase 8 — Funções de apoio ao painel admin (todas exigem papel via is_admin).

-- Autoria automática
alter table public.manual_grants alter column granted_by set default auth.uid();
alter table public.user_plan_overrides alter column created_by set default auth.uid();
alter table public.plan_features_draft alter column updated_by set default auth.uid();

create policy "profiles: admins leem" on public.profiles for select to authenticated
  using ((select public.is_admin('viewer')));

create or replace function public.admin_assert(min_role text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin(min_role) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- Indicadores do dashboard
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_assert('viewer');
  return jsonb_build_object(
    'users_total', (select count(*) from auth.users),
    'users_anonymous', (select count(*) from auth.users where is_anonymous),
    'users_new_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'subscriptions_active', (select count(*) from public.subscriptions
      where status in ('active', 'in_grace', 'cancelled', 'billing_issue')
        and (expires_at is null or expires_at > now())),
    'subscriptions_cancelled', (select count(*) from public.subscriptions
      where status = 'cancelled' and expires_at > now()),
    'subscriptions_billing_issue', (select count(*) from public.subscriptions
      where status in ('billing_issue', 'in_grace')),
    'grants_active', (select count(*) from public.manual_grants
      where revoked_at is null and starts_at <= now() and (expires_at is null or expires_at > now())),
    'overrides_total', (select count(*) from public.user_plan_overrides),
    'sync_users', (select count(distinct user_id) from public.transactions),
    'by_store', coalesce((select jsonb_object_agg(coalesce(store, 'desconhecida'), n) from (
      select store, count(*) n from public.subscriptions
      where status <> 'expired' and (expires_at is null or expires_at > now()) group by store) s), '{}'::jsonb),
    'signups_by_day', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'count', n) order by d) from (
      select date_trunc('day', created_at)::date d, count(*) n from auth.users
      where created_at > now() - interval '30 days' group by 1) x), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.admin_stats() to authenticated;

-- Busca de usuários (e-mail parcial ou id exato), com plano efetivo
create or replace function public.admin_search_users(p_query text default '', p_limit int default 50, p_offset int default 0)
returns table (
  id uuid,
  email text,
  is_anonymous boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  plan_id text,
  source text,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_assert('viewer');
  return query
  select u.id, u.email::text, coalesce(u.is_anonymous, false), u.created_at, u.last_sign_in_at,
         ep.plan_id, ep.source, ep.expires_at
    from auth.users u
    cross join lateral public.get_effective_plan(u.id) ep
   where coalesce(p_query, '') = ''
      or u.email ilike '%' || p_query || '%'
      or u.id::text = p_query
   order by u.created_at desc
   limit least(greatest(p_limit, 1), 500) offset greatest(p_offset, 0);
end;
$$;
grant execute on function public.admin_search_users(text, int, int) to authenticated;

create or replace function public.admin_user_detail(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_assert('viewer');
  return jsonb_build_object(
    'user', (select jsonb_build_object('id', u.id, 'email', u.email, 'is_anonymous', u.is_anonymous,
              'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
              'providers', u.raw_app_meta_data -> 'providers')
             from auth.users u where u.id = p_user),
    'entitlements', public.get_entitlements(p_user),
    'subscription', (select to_jsonb(s) from public.subscriptions s where s.user_id = p_user),
    'grants', coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at desc)
                 from public.manual_grants g where g.user_id = p_user), '[]'::jsonb),
    'overrides', coalesce((select jsonb_agg(to_jsonb(o) order by o.feature_key)
                 from public.user_plan_overrides o where o.user_id = p_user), '[]'::jsonb),
    'usage', jsonb_build_object(
      'accounts', (select count(*) from public.accounts where user_id = p_user and deleted_at is null),
      'transactions', (select count(*) from public.transactions where user_id = p_user and deleted_at is null),
      'budgets', (select count(*) from public.budgets where user_id = p_user and deleted_at is null),
      'goals', (select count(*) from public.goals where user_id = p_user and deleted_at is null)
    )
  );
end;
$$;
grant execute on function public.admin_user_detail(uuid) to authenticated;

-- Gestão de admins (somente owner)
create or replace function public.admin_list_admins()
returns table (user_id uuid, email text, role text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_assert('viewer');
  return query select a.user_id, u.email::text, a.role, a.created_at
    from public.admins a join auth.users u on u.id = a.user_id order by a.created_at;
end;
$$;
grant execute on function public.admin_list_admins() to authenticated;

create or replace function public.admin_set_role(p_email text, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  perform public.admin_assert('owner');
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'user_not_found' using errcode = 'P0002'; end if;
  if p_role is null or p_role = '' then
    if uid = auth.uid() then raise exception 'cannot_remove_self' using errcode = 'P0001'; end if;
    delete from public.admins where user_id = uid;
  else
    insert into public.admins (user_id, role) values (uid, p_role)
    on conflict (user_id) do update set role = excluded.role;
  end if;
end;
$$;
grant execute on function public.admin_set_role(text, text) to authenticated;

-- Descarta o rascunho da matriz (volta ao publicado)
create or replace function public.discard_plan_matrix_draft()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_assert('editor');
  delete from public.plan_features_draft;
  insert into public.plan_features_draft (plan_id, feature_key, value)
  select plan_id, feature_key, value from public.plan_features;
end;
$$;
grant execute on function public.discard_plan_matrix_draft() to authenticated;

-- Novo plano já nasce com linhas no rascunho (defaults do catálogo)
create or replace function public.seed_plan_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.plan_features_draft (plan_id, feature_key, value)
  select new.id, f.key, f.default_value from public.features f
  on conflict do nothing;
  return new;
end;
$$;
create trigger plans_seed_draft after insert on public.plans
  for each row execute function public.seed_plan_draft();
