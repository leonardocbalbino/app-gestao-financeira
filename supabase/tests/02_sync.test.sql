begin;
select plan(14);

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000001', 'free@sync.dev'),
  ('cccccccc-0000-0000-0000-000000000002', 'pro@sync.dev'),
  ('cccccccc-0000-0000-0000-000000000003', 'other@sync.dev');

-- Usuário 2 tem sync liberado e budgets.max = 1 (via overrides)
insert into public.user_plan_overrides (user_id, feature_key, value) values
  ('cccccccc-0000-0000-0000-000000000002', 'sync.cloud', 'true'),
  ('cccccccc-0000-0000-0000-000000000002', 'budgets.max', '1'),
  ('cccccccc-0000-0000-0000-000000000002', 'members.max', '2'),
  ('cccccccc-0000-0000-0000-000000000003', 'sync.cloud', 'true');

-- 1) Free não sincroniza
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$select public.sync_push('accounts', '[]'::jsonb)$$, '42501', 'sync_not_allowed', 'free sem sync.cloud é bloqueado');

-- 2) Pro: insere, LWW e tombstone
set local request.jwt.claims = '{"sub":"cccccccc-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (public.sync_push('accounts', '[{"id":"dddddddd-0000-0000-0000-000000000001","name":"Banco","type":"checking","initial_balance_cents":1000,"color":"#000","icon":"wallet","archived":false,"sort_order":0,"created_at":"2026-11-01T00:00:00Z","updated_at":"2026-11-01T00:00:00Z","deleted_at":null}]'::jsonb) ->> 'applied')::int,
  1, 'insere conta');
select is(
  (public.sync_push('accounts', '[{"id":"dddddddd-0000-0000-0000-000000000001","name":"Antigo","type":"checking","initial_balance_cents":1000,"color":"#000","icon":"wallet","archived":false,"sort_order":0,"created_at":"2026-11-01T00:00:00Z","updated_at":"2026-10-01T00:00:00Z","deleted_at":null}]'::jsonb) ->> 'stale')::int,
  1, 'escrita mais antiga é descartada (LWW)');
select is((select name from public.accounts where id = 'dddddddd-0000-0000-0000-000000000001'), 'Banco', 'valor mais recente mantido');
select is(
  (public.sync_push('accounts', '[{"id":"dddddddd-0000-0000-0000-000000000001","name":"Banco","type":"checking","initial_balance_cents":1000,"color":"#000","icon":"wallet","archived":false,"sort_order":0,"created_at":"2026-11-01T00:00:00Z","updated_at":"2026-11-05T00:00:00Z","deleted_at":"2026-11-05T00:00:00Z"}]'::jsonb) ->> 'applied')::int,
  1, 'tombstone aplicado');
select isnt((select deleted_at from public.accounts where id = 'dddddddd-0000-0000-0000-000000000001'), null, 'conta marcada como excluída');
select is((select user_id::text from public.accounts where id = 'dddddddd-0000-0000-0000-000000000001'), 'cccccccc-0000-0000-0000-000000000002', 'user_id vem do JWT, não do cliente');

-- 3) Limite no servidor: budgets.max = 1 → segundo orçamento é rejeitado (linha a linha)
select is(
  jsonb_array_length(public.sync_push('budgets', '[
    {"id":"eeeeeeee-0000-0000-0000-000000000001","category_id":"eeeeeeee-0000-0000-0000-0000000000c1","limit_cents":1000,"start_month":"2026-11","created_at":"2026-11-01T00:00:00Z","updated_at":"2026-11-01T00:00:00Z","deleted_at":null},
    {"id":"eeeeeeee-0000-0000-0000-000000000002","category_id":"eeeeeeee-0000-0000-0000-0000000000c2","limit_cents":1000,"start_month":"2026-11","created_at":"2026-11-01T00:00:00Z","updated_at":"2026-11-01T00:00:00Z","deleted_at":null}
  ]'::jsonb) -> 'rejected'),
  1, 'segundo orçamento rejeitado pelo limite');
select is((select count(*)::int from public.budgets), 1, 'apenas um orçamento gravado');
-- Atualizar o existente continua permitido
select is(
  (public.sync_push('budgets', '[{"id":"eeeeeeee-0000-0000-0000-000000000001","category_id":"eeeeeeee-0000-0000-0000-0000000000c1","limit_cents":5000,"start_month":"2026-11","created_at":"2026-11-01T00:00:00Z","updated_at":"2026-11-02T00:00:00Z","deleted_at":null}]'::jsonb) ->> 'applied')::int,
  1, 'editar item existente não esbarra no limite');

-- 4) RLS: outro usuário não vê nem sobrescreve
set local request.jwt.claims = '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.accounts), 0, 'não vê dados de outro usuário');
select is(
  jsonb_array_length(public.sync_push('accounts', '[{"id":"dddddddd-0000-0000-0000-000000000001","name":"Hack","type":"checking","initial_balance_cents":0,"color":"#000","icon":"wallet","archived":false,"sort_order":0,"created_at":"2026-11-01T00:00:00Z","updated_at":"2027-01-01T00:00:00Z","deleted_at":null}]'::jsonb) -> 'rejected'),
  1, 'não sobrescreve linha alheia');

-- 5) Família com limite de membros (dono: members.max = 2)
set local request.jwt.claims = '{"sub":"cccccccc-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok($$select public.create_household('Casa')$$, 'cria família');
reset role;
insert into public.household_members (household_id, user_id)
select id, 'cccccccc-0000-0000-0000-000000000003' from public.households where name = 'Casa';
select throws_ok(
  $$insert into public.household_members (household_id, user_id)
    select id, 'cccccccc-0000-0000-0000-000000000001' from public.households where name = 'Casa'$$,
  'P0001', 'limit_reached:members.max', 'terceiro membro excede members.max');

select * from finish();
rollback;
