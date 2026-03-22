-- API Template v1 schema
-- Run in Supabase SQL editor or via Supabase CLI migrations.

create extension if not exists pgcrypto;

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  requests_used int4 not null default 0,
  requests_limit int4 not null default 1000,
  is_active bool not null default true,
  constraint api_keys_requests_non_negative check (requests_used >= 0 and requests_limit >= 0)
);

-- Compatibility for existing databases created before user_id was introduced.
alter table public.api_keys
  add column if not exists user_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'api_keys_user_id_fkey'
      and conrelid = 'public.api_keys'::regclass
  ) then
    alter table public.api_keys
      add constraint api_keys_user_id_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete cascade;
  end if;
end;
$$;

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  endpoint text not null,
  resource_id text,
  status_code int2 not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_keys_key on public.api_keys(key);
create unique index if not exists idx_api_keys_user_id_unique on public.api_keys(user_id);
create index if not exists idx_usage_logs_api_key_id on public.usage_logs(api_key_id);
create index if not exists idx_usage_logs_created_at on public.usage_logs(created_at desc);

alter table public.api_keys enable row level security;
alter table public.usage_logs enable row level security;

-- Public roles are fully denied by default (no policy).
-- Service role gets explicit full access.

drop policy if exists service_role_full_api_keys on public.api_keys;
create policy service_role_full_api_keys
on public.api_keys
for all
to service_role
using (true)
with check (true);

drop policy if exists service_role_full_usage_logs on public.usage_logs;
create policy service_role_full_usage_logs
on public.usage_logs
for all
to service_role
using (true)
with check (true);
