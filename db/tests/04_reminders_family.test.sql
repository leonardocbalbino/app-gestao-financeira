begin;
create extension if not exists pgtap;
select plan(11);

insert into public.users (id, email) values
  ('aaaa0000-0000-0000-0000-000000000001', 'dono@fam.dev'),
  ('aaaa0000-0000-0000-0000-000000000002', 'membro@fam.dev'),
  ('aaaa0000-0000-0000-0000-000000000003', 'free@fam.dev');
insert into public.user_plan_overrides (user_id, feature_key, value) values
  ('aaaa0000-0000-0000-0000-000000000001', 'sync.cloud', 'true'),
  ('aaaa0000-0000-0000-0000-000000000001', 'members.max', '3'),
  ('aaaa0000-0000-0000-0000-000000000002', 'sync.cloud', 'true');

set local role app_user;

-- Membro cria dados antes de entrar na família
set local app.user_id = 'aaaa0000-0000-0000-0000-000000000002';
select lives_ok($$select public.sync_push('accounts', '[{"id":"bbbb0000-0000-0000-0000-000000000001","name":"Conta do membro","type":"cash","initial_balance_cents":0,"color":"#000","icon":"wallet","archived":false,"sort_order":0,"created_at":"2026-11-01T00:00:00Z","updated_at":"2026-11-01T00:00:00Z","deleted_at":null}]'::jsonb)$$, 'membro sincroniza');

-- Dono cria família; membro entra pelo código
set local app.user_id = 'aaaa0000-0000-0000-0000-000000000001';
select lives_ok($$select public.create_household('Casa')$$, 'dono cria família');
reset role;
create temp table code as select invite_code from public.households where name = 'Casa';
grant select on code to app_user;
set local role app_user;
set local app.user_id = 'aaaa0000-0000-0000-0000-000000000002';
select lives_ok($$select public.join_household((select invite_code from code))$$, 'membro entra');

-- Dono passa a ver a conta do membro (compartilhada ao entrar)
set local app.user_id = 'aaaa0000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.accounts), 1, 'dono vê dados do membro');
select is(jsonb_array_length(public.my_household() -> 'members'), 2, 'família com 2 membros');

-- Dado novo do dono já nasce compartilhado; push do cliente não zera household_id
select lives_ok($$select public.sync_push('accounts', '[{"id":"bbbb0000-0000-0000-0000-000000000002","name":"Conta do dono","type":"cash","initial_balance_cents":0,"color":"#000","icon":"wallet","archived":false,"sort_order":0,"created_at":"2026-11-01T00:00:00Z","updated_at":"2026-11-01T00:00:00Z","deleted_at":null}]'::jsonb)$$, 'dono sincroniza');
select lives_ok($$select public.sync_push('accounts', '[{"id":"bbbb0000-0000-0000-0000-000000000001","name":"Editada pelo dono","type":"cash","initial_balance_cents":0,"color":"#000","icon":"wallet","archived":false,"sort_order":0,"created_at":"2026-11-01T00:00:00Z","updated_at":"2026-11-03T00:00:00Z","deleted_at":null}]'::jsonb)$$, 'dono edita conta do membro');
set local app.user_id = 'aaaa0000-0000-0000-0000-000000000002';
select is((select string_agg(name, ',' order by name) from public.accounts), 'Conta do dono,Editada pelo dono', 'membro vê tudo e a edição');

-- Lembretes: Free não usa SMS/WhatsApp; limite de 3 ativos
set local app.user_id = 'aaaa0000-0000-0000-0000-000000000003';
select throws_ok(
  $$insert into public.reminders (kind, title, due_at, channels) values ('payment', 'Luz', now() + interval '2 days', '{push,sms}')$$,
  'P0001', 'feature_required:reminders.sms', 'Free não envia SMS');
insert into public.reminders (kind, title, due_at, channels) values
  ('payment', 'A', now() + interval '1 day', '{push,email}'),
  ('payment', 'B', now() + interval '1 day', '{push}'),
  ('charge', 'C', now() + interval '1 day', '{email}');
select throws_ok(
  $$insert into public.reminders (kind, title, due_at, channels) values ('payment', 'D', now() + interval '1 day', '{push}')$$,
  'P0001', 'limit_reached:reminders.max', 'quarto lembrete excede o limite Free');
set local app.user_id = 'aaaa0000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.reminders), 0, 'lembretes são privados');

select * from finish();
rollback;
