begin;
create extension if not exists pgtap;
select plan(2);

insert into public.users (id, email) values
  ('cccc0000-0000-0000-0000-000000000001', 'cliente@lem.dev'),
  ('cccc0000-0000-0000-0000-000000000002', 'viewer@lem.dev');
insert into public.admins (user_id, role) values ('cccc0000-0000-0000-0000-000000000002', 'viewer');
insert into public.reminders (user_id, kind, title, due_at, channels)
values ('cccc0000-0000-0000-0000-000000000001', 'payment', 'Luz', now() + interval '1 day', '{email}');

set local role app_user;
set local app.user_id = 'cccc0000-0000-0000-0000-000000000002';
select is((select count(*)::int from public.reminders where user_id = 'cccc0000-0000-0000-0000-000000000001'), 1, 'admin viewer lê lembretes');
-- RLS: o UPDATE não enxerga linhas de outro usuário (nada muda)
update public.reminders set title = 'x' where user_id = 'cccc0000-0000-0000-0000-000000000001';
reset role;
select is(
  (select title from public.reminders where user_id = 'cccc0000-0000-0000-0000-000000000001'),
  'Luz', 'admin não edita lembrete de cliente');

select * from finish();
rollback;
