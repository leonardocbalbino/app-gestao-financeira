-- Lembretes multicanal (push, e-mail, SMS, WhatsApp), família compartilhada e ajustes.

-- ---------------------------------------------------------------------------
-- Família: dados sincronizados herdam a família do autor automaticamente
-- ---------------------------------------------------------------------------
create or replace function public.assign_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.household_id is null then
    select m.household_id into new.household_id
      from public.household_members m where m.user_id = new.user_id
     order by m.created_at limit 1;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['accounts', 'categories', 'transactions', 'budgets', 'goals', 'bills'] loop
    execute format('create trigger %1$s_assign_household before insert on public.%1$s
      for each row execute function public.assign_household()', t);
  end loop;
end;
$$;

-- Ao entrar na família, os dados existentes do membro passam a ser compartilhados.
create or replace function public.share_existing_rows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare t text;
begin
  foreach t in array array['accounts', 'categories', 'transactions', 'budgets', 'goals', 'bills'] loop
    execute format('update public.%I set household_id = $1 where user_id = $2 and household_id is null', t)
      using new.household_id, new.user_id;
  end loop;
  return new;
end;
$$;
create trigger household_members_share after insert on public.household_members
  for each row execute function public.share_existing_rows();

-- Ao sair, os dados do membro voltam a ser só dele.
create or replace function public.unshare_rows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare t text;
begin
  foreach t in array array['accounts', 'categories', 'transactions', 'budgets', 'goals', 'bills'] loop
    execute format('update public.%I set household_id = null where user_id = $1 and household_id = $2', t)
      using old.user_id, old.household_id;
  end loop;
  return old;
end;
$$;
create trigger household_members_unshare after delete on public.household_members
  for each row execute function public.unshare_rows();

create or replace function public.my_household()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', h.id, 'name', h.name, 'invite_code', h.invite_code, 'owner_id', h.owner_id,
    'members', (select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'role', m.role,
        'name', coalesce(u.display_name, split_part(u.email::text, '@', 1), 'Membro'))
        order by m.created_at)
      from public.household_members m join public.users u on u.id = m.user_id
      where m.household_id = h.id))
  from public.households h
  join public.household_members me on me.household_id = h.id and me.user_id = app.uid()
  limit 1;
$$;
grant execute on function public.my_household() to app_user;

-- Contas a pagar: dia de vencimento original (31 → 28 fev → 31 mar)
alter table public.bills add column anchor_day int check (anchor_day between 1 and 31);

-- ---------------------------------------------------------------------------
-- sync_push: household_id e user_id nunca vêm do cliente
-- ---------------------------------------------------------------------------
create or replace function public.sync_push(p_table text, p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  row_json jsonb;
  cols text;
  updates text;
  applied int := 0;
  stale int := 0;
  rejected jsonb := '[]'::jsonb;
  n int;
begin
  if p_table not in ('accounts', 'categories', 'transactions', 'budgets', 'goals', 'bills') then
    raise exception 'invalid_table' using errcode = '22023';
  end if;
  if coalesce((public.my_entitlements() -> 'features' ->> 'sync.cloud')::boolean, false) is not true then
    raise exception 'sync_not_allowed' using errcode = '42501';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'batch_too_large' using errcode = '22023';
  end if;

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position),
         string_agg(format('%1$I = excluded.%1$I', column_name), ', ' order by ordinal_position)
    into cols, updates
    from information_schema.columns
   where table_schema = 'public' and table_name = p_table
     and column_name not in ('user_id', 'household_id', 'server_updated_at');

  for row_json in select * from jsonb_array_elements(p_rows) loop
    begin
      execute format(
        'insert into public.%1$I (%2$s, user_id)
         select %2$s, app.uid() from jsonb_populate_record(null::public.%1$I, $1)
         on conflict (id) do update set %3$s
         where public.%1$I.updated_at < excluded.updated_at',
        p_table, cols, updates
      ) using row_json;
      get diagnostics n = row_count;
      if n > 0 then applied := applied + 1; else stale := stale + 1; end if;
    exception when others then
      rejected := rejected || jsonb_build_object('id', row_json ->> 'id', 'reason', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('applied', applied, 'stale', stale, 'rejected', rejected, 'server_time', now());
end;
$$;

-- ---------------------------------------------------------------------------
-- Push tokens (Expo)
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now(),
  invalid_at timestamptz
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
create policy "push_tokens: dono" on public.push_tokens for all to app_user
  using (user_id = (select app.uid())) with check (user_id = (select app.uid()));

-- ---------------------------------------------------------------------------
-- Lembretes de pagamento (eu pago) e cobrança (alguém me deve)
-- ---------------------------------------------------------------------------
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default app.uid() references public.users (id) on delete cascade,
  kind text not null check (kind in ('payment', 'charge')),
  title text not null check (char_length(title) between 1 and 60),
  amount_cents bigint check (amount_cents is null or amount_cents > 0),
  due_at timestamptz not null,
  anchor_day int check (anchor_day between 1 and 31),
  recurrence text not null default 'none' check (recurrence in ('none', 'weekly', 'monthly', 'yearly')),
  -- minutos antes do vencimento (ex.: {1440, 0} = 1 dia antes e na hora)
  offsets_min int[] not null default '{1440}' check (array_length(offsets_min, 1) between 1 and 4),
  channels text[] not null check (channels <@ array['push', 'email', 'sms', 'whatsapp'] and array_length(channels, 1) >= 1),
  -- cobrança: avisar também o devedor (exige consentimento declarado pelo usuário)
  counterparty_name text check (char_length(counterparty_name) <= 60),
  counterparty_phone text check (counterparty_phone is null or counterparty_phone ~ '^\+[1-9]\d{7,14}$'),
  counterparty_email citext,
  notify_counterparty boolean not null default false,
  counterparty_channels text[] not null default '{}' check (counterparty_channels <@ array['email', 'sms', 'whatsapp']),
  note text check (char_length(note) <= 280),
  status text not null default 'active' check (status in ('active', 'paused', 'done')),
  next_occurrence_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint reminders_counterparty_needs_contact check (
    not notify_counterparty or counterparty_phone is not null or counterparty_email is not null
  )
);
create index reminders_user_idx on public.reminders (user_id) where deleted_at is null;
create trigger reminders_set_updated_at before update on public.reminders
  for each row execute function public.set_updated_at();
alter table public.reminders enable row level security;
create policy "reminders: dono" on public.reminders for all to app_user
  using (user_id = (select app.uid())) with check (user_id = (select app.uid()));

create table public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  occurrence_due_at timestamptz not null,
  scheduled_for timestamptz not null,
  channel text not null check (channel in ('push', 'email', 'sms', 'whatsapp')),
  recipient text not null check (recipient in ('self', 'counterparty')),
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'simulated', 'failed', 'skipped', 'cancelled')),
  attempts int not null default 0,
  last_error text,
  provider text,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reminder_id, occurrence_due_at, scheduled_for, channel, recipient)
);
create index reminder_deliveries_due_idx on public.reminder_deliveries (scheduled_for)
  where status = 'pending';
alter table public.reminder_deliveries enable row level security;
create policy "deliveries: dono lê" on public.reminder_deliveries for select to app_user
  using (user_id = (select app.uid()));
create policy "deliveries: admins leem" on public.reminder_deliveries for select to app_user
  using ((select public.is_admin('viewer')));

-- Limite de lembretes ativos e canais pagos impostos no servidor
create trigger reminders_limit before insert or update on public.reminders
  for each row execute function public.enforce_row_limit('reminders.max');

create or replace function public.enforce_reminder_channels()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  f jsonb := public.get_entitlements(new.user_id) -> 'features';
  all_channels text[] := new.channels || case when new.notify_counterparty then new.counterparty_channels else '{}' end;
begin
  if 'sms' = any(all_channels) and coalesce((f ->> 'reminders.sms')::boolean, false) is not true then
    raise exception 'feature_required:reminders.sms' using errcode = 'P0001';
  end if;
  if 'whatsapp' = any(all_channels) and coalesce((f ->> 'reminders.whatsapp')::boolean, false) is not true then
    raise exception 'feature_required:reminders.whatsapp' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger reminders_channels before insert or update of channels, counterparty_channels, notify_counterparty
  on public.reminders for each row execute function public.enforce_reminder_channels();

-- Catálogo: novas funcionalidades de lembretes
insert into public.features (key, type, label, description, group_name, default_value, paywall_label, sort_order) values
  ('reminders.max', 'limit', 'Lembretes', 'Lembretes de pagamento/cobrança ativos', 'Limites', '3', 'Lembretes de pagamento e cobrança', 145),
  ('reminders.sms', 'boolean', 'Lembretes por SMS', 'Enviar lembretes por SMS', 'Lembretes', 'false', 'Lembretes por SMS', 92),
  ('reminders.whatsapp', 'boolean', 'Lembretes por WhatsApp', 'Enviar lembretes por WhatsApp', 'Lembretes', 'false', 'Lembretes por WhatsApp', 94);
insert into public.plan_features (plan_id, feature_key, value) values
  ('free', 'reminders.max', '3'), ('free', 'reminders.sms', 'false'), ('free', 'reminders.whatsapp', 'false'),
  ('pro', 'reminders.max', 'null'), ('pro', 'reminders.sms', 'true'), ('pro', 'reminders.whatsapp', 'true');
insert into public.plan_features_draft (plan_id, feature_key, value)
select plan_id, feature_key, value from public.plan_features
where feature_key in ('reminders.max', 'reminders.sms', 'reminders.whatsapp');

-- ---------------------------------------------------------------------------
-- Permissões do papel de aplicação (RLS continua valendo)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on all tables in schema public to app_user;
revoke all on public.refresh_tokens, public.email_otps from app_user;
revoke insert, update, delete on public.users from app_user;
grant select, insert, update, delete on all tables in schema public to app_service;

-- O worker (app_service) consulta o plano do usuário antes de SMS/WhatsApp.
grant execute on function public.get_entitlements(uuid), public.get_effective_plan(uuid),
  public.feature_limit(uuid, text) to app_service;
