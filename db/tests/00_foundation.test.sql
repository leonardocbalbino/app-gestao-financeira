begin;
create extension if not exists pgtap;
select plan(6);

select has_table('public', 'users', 'tabela users existe');
select is(
  (select relrowsecurity from pg_class where oid = 'public.users'::regclass),
  true, 'RLS habilitado em users');
select is(
  (select rolbypassrls from pg_roles where rolname = 'app_api'), false, 'app_api respeita RLS');

insert into public.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.dev');

set local role app_user;
set local app.user_id = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.users), 1, 'usuário só enxerga a si mesmo');
select throws_ok($$select * from public.refresh_tokens$$, '42501', null, 'tokens de sessão inacessíveis ao app');
select throws_ok(
  $$update public.users set password_hash = 'x' where id = '22222222-2222-2222-2222-222222222222'$$,
  '42501', null, 'app não altera users diretamente');

select * from finish();
rollback;
