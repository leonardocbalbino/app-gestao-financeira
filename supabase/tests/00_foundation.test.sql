-- Testes pgTAP. Rodar com: supabase test db
begin;
select plan(4);

select has_table('public', 'profiles', 'tabela profiles existe');
select is(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true,
  'RLS habilitado em profiles'
);

-- Signup cria perfil automaticamente
insert into auth.users (id, email, raw_user_meta_data, is_anonymous)
values ('11111111-1111-1111-1111-111111111111', 'a@test.dev', '{"full_name":"Ana"}', false);

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Ana',
  'perfil criado no signup'
);

-- Outro usuário não enxerga o perfil
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'b@test.dev');
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  0,
  'RLS isola perfis entre usuários'
);

select * from finish();
rollback;
