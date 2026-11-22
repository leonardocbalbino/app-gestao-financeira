begin;
create extension if not exists pgtap;
select plan(19);

-- Usuários de teste
insert into public.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'free@test.dev'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'sub@test.dev'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'grant@test.dev'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'admin@test.dev');

-- 1) Default = Free com valores do catálogo
select is(public.get_entitlements('aaaaaaaa-0000-0000-0000-000000000001') ->> 'plan_id', 'free', 'sem nada → plano padrão');
select is(public.get_entitlements('aaaaaaaa-0000-0000-0000-000000000001') -> 'features' -> 'export.pdf', 'false'::jsonb, 'free: export.pdf false');
select is(public.get_entitlements('aaaaaaaa-0000-0000-0000-000000000001') -> 'features' -> 'budgets.max', '3'::jsonb, 'free: budgets.max 3');
select is(public.get_entitlements('aaaaaaaa-0000-0000-0000-000000000001') -> 'features' -> 'ads.show', 'true'::jsonb, 'free: com anúncios');

-- 2) Assinatura ativa → Pro
insert into public.subscriptions (user_id, rc_entitlement, status, expires_at)
values ('aaaaaaaa-0000-0000-0000-000000000002', 'pro', 'active', now() + interval '30 days');
select is(public.get_entitlements('aaaaaaaa-0000-0000-0000-000000000002') ->> 'source', 'subscription', 'assinatura ativa');
select is(public.get_entitlements('aaaaaaaa-0000-0000-0000-000000000002') -> 'features' -> 'budgets.max', 'null'::jsonb, 'pro: ilimitado (null)');
select is(public.get_entitlements('aaaaaaaa-0000-0000-0000-000000000002') -> 'features' -> 'ads.show', 'false'::jsonb, 'pro: sem anúncios');

-- Assinatura expirada → volta ao Free
update public.subscriptions set expires_at = now() - interval '1 day', status = 'expired'
 where user_id = 'aaaaaaaa-0000-0000-0000-000000000002';
select is(public.get_entitlements('aaaaaaaa-0000-0000-0000-000000000002') ->> 'plan_id', 'free', 'assinatura expirada → free');

-- 3) Concessão manual tem prioridade sobre assinatura/padrão; revogação remove
insert into public.manual_grants (id, user_id, plan_id, expires_at, reason)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'pro', now() + interval '7 days', 'suporte');
select is(public.get_entitlements('aaaaaaaa-0000-0000-0000-000000000003') ->> 'source', 'manual_grant', 'concessão manual ativa');
update public.manual_grants set revoked_at = now() where id = 'bbbbbbbb-0000-0000-0000-000000000001';
select is(public.get_entitlements('aaaaaaaa-0000-0000-0000-000000000003') ->> 'plan_id', 'free', 'concessão revogada → free');

-- 4) Override do usuário vence tudo; override expirado é ignorado
insert into public.user_plan_overrides (user_id, feature_key, value) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'budgets.max', '10'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'export.pdf', 'true');
insert into public.user_plan_overrides (user_id, feature_key, value, expires_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'goals.max', '9', now() - interval '1 hour');
select is(public.get_entitlements('aaaaaaaa-0000-0000-0000-000000000001') -> 'features' -> 'budgets.max', '10'::jsonb, 'override de limite');
select is(public.get_entitlements('aaaaaaaa-0000-0000-0000-000000000001') -> 'features' -> 'export.pdf', 'true'::jsonb, 'override booleano');
select is(public.get_entitlements('aaaaaaaa-0000-0000-0000-000000000001') -> 'features' -> 'goals.max', '1'::jsonb, 'override expirado ignorado');

-- 5) Validação de tipo
select throws_ok(
  $$insert into public.user_plan_overrides (user_id, feature_key, value) values ('aaaaaaaa-0000-0000-0000-000000000002', 'export.pdf', '5')$$,
  '23514', null, 'valor incompatível com o tipo é rejeitado');

-- 6) RLS: usuário comum lê só o que é seu e não chama get_entitlements de terceiros
set local role app_user;
set local app.user_id = 'aaaaaaaa-0000-0000-0000-000000000002';
select is((select count(*)::int from public.user_plan_overrides), 0, 'não vê overrides de outros');
select is(public.my_entitlements() ->> 'plan_id', 'free', 'my_entitlements usa app.uid()');
select throws_ok($$select public.get_entitlements('aaaaaaaa-0000-0000-0000-000000000001')$$, '42501', null, 'get_entitlements bloqueado para usuário');
select throws_ok($$select public.publish_plan_matrix()$$, '42501', null, 'não-admin não publica matriz');
reset role;

-- 7) Publicação: rascunho → produção, auditado
insert into public.admins (user_id, role) values ('aaaaaaaa-0000-0000-0000-000000000004', 'editor');
set local role app_user;
set local app.user_id = 'aaaaaaaa-0000-0000-0000-000000000004';
update public.plan_features_draft set value = '5' where plan_id = 'free' and feature_key = 'budgets.max';
select is(public.publish_plan_matrix(), 1, 'publica 1 mudança');
reset role;

select * from finish();
rollback;
