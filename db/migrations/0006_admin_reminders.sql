-- Admins (inclusive viewer) leem lembretes para a tela "Lembretes e envios" do painel.
create policy "reminders: admins leem" on public.reminders for select to app_user
  using ((select public.is_admin('viewer')));
