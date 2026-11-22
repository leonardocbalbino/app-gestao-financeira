-- Fundação: Postgres puro (sem Supabase).
-- Identidade do usuário por transação: a API executa `SET LOCAL app.user_id = '<uuid>'`
-- e o RLS usa app.uid(). Dois papéis de conexão:
--   app_api      → membro de app_user, SUJEITO a RLS (dados do usuário)
--   app_service  → BYPASSRLS, apenas para código confiável (login, webhook, worker, admin auth)

create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists app;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_api') then
    create role app_api login;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_service') then
    create role app_service login bypassrls;
  end if;
end;
$$;

grant app_user to app_api;
grant usage on schema public, app to app_user, app_service;

-- Usuário atual da transação (null = anônimo/sem sessão).
create or replace function app.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Usuários (substitui auth.users + profiles)
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email citext unique,
  email_verified_at timestamptz,
  password_hash text,
  apple_sub text unique,
  google_sub text unique,
  is_anonymous boolean not null default false,
  display_name text check (char_length(display_name) <= 60),
  phone text check (phone is null or phone ~ '^\+[1-9]\d{7,14}$'),
  -- Consentimentos de canal (LGPD): SMS/WhatsApp só com opt-in explícito
  email_opt_in boolean not null default true,
  sms_opt_in boolean not null default false,
  whatsapp_opt_in boolean not null default false,
  theme_preference text not null default 'system' check (theme_preference in ('system', 'light', 'dark')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

alter table public.users enable row level security;
create policy "users: dono lê" on public.users for select to app_user
  using (id = (select app.uid()));
-- Escrita em users só pelo app_service (a API valida os campos).

-- Sessões (refresh tokens rotativos; guardamos só o hash)
create table public.refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  family uuid not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  user_agent text
);
create index refresh_tokens_user_idx on public.refresh_tokens (user_id);
alter table public.refresh_tokens enable row level security;

-- Códigos de login por e-mail (hash + tentativas)
create table public.email_otps (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  code_hash text not null,
  link_user_id uuid references public.users (id) on delete cascade,
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_otps_email_idx on public.email_otps (email, created_at desc);
alter table public.email_otps enable row level security;

grant select, insert, update, delete on all tables in schema public to app_service;
alter default privileges in schema public grant select, insert, update, delete on tables to app_service;
alter default privileges in schema public grant usage, select on sequences to app_service, app_user;
