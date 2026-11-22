begin;
create extension if not exists pgtap;
select plan(8);

insert into public.users (id, email) values
  ('ffffffff-0000-0000-0000-000000000001', 'owner@admin.dev'),
  ('ffffffff-0000-0000-0000-000000000002', 'viewer@admin.dev'),
  ('ffffffff-0000-0000-0000-000000000003', 'cliente@app.dev');
insert into public.admins (user_id, role) values
  ('ffffffff-0000-0000-0000-000000000001', 'owner'),
  ('ffffffff-0000-0000-0000-000000000002', 'viewer');

set local role app_user;

-- Cliente comum não acessa nada do admin
set local app.user_id = 'ffffffff-0000-0000-0000-000000000003';
select throws_ok($$select public.admin_stats()$$, '42501', 'forbidden', 'cliente não vê estatísticas');
select throws_ok($$select * from public.admin_search_users('')$$, '42501', 'forbidden', 'cliente não busca usuários');

-- Viewer lê, mas não escreve
set local app.user_id = 'ffffffff-0000-0000-0000-000000000002';
select ok((public.admin_stats() ->> 'users_total')::int >= 3, 'viewer vê estatísticas');
select is((select email from public.admin_search_users('cliente@app.dev')), 'cliente@app.dev', 'busca por e-mail');
select throws_ok(
  $$insert into public.manual_grants (user_id, plan_id) values ('ffffffff-0000-0000-0000-000000000003', 'pro')$$,
  '42501', null, 'viewer não concede Pro');
select throws_ok($$select public.admin_set_role('cliente@app.dev', 'editor')$$, '42501', 'forbidden', 'viewer não gerencia admins');

-- Owner concede Pro (autoria automática) e vê no detalhe
set local app.user_id = 'ffffffff-0000-0000-0000-000000000001';
insert into public.manual_grants (user_id, plan_id, reason) values ('ffffffff-0000-0000-0000-000000000003', 'pro', 'teste');
select is(
  public.admin_user_detail('ffffffff-0000-0000-0000-000000000003') -> 'entitlements' ->> 'source',
  'manual_grant', 'concessão manual aparece no detalhe');
select is(
  (select granted_by::text from public.manual_grants where user_id = 'ffffffff-0000-0000-0000-000000000003'),
  'ffffffff-0000-0000-0000-000000000001', 'granted_by preenchido com o admin');

select * from finish();
rollback;
