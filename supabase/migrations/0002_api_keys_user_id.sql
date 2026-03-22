-- Transition api_keys ownership from email -> auth user_id.
-- Use only when migrating an existing database created with v1 schema.

alter table public.api_keys
  drop column if exists email;

alter table public.api_keys
  add column if not exists user_id uuid;

alter table public.api_keys
  drop constraint if exists api_keys_user_id_fkey;

alter table public.api_keys
  add constraint api_keys_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete cascade;

create unique index if not exists idx_api_keys_user_id_unique on public.api_keys(user_id);

do $$
begin
  if not exists (select 1 from public.api_keys where user_id is null) then
    alter table public.api_keys alter column user_id set not null;
  else
    raise notice 'api_keys.user_id has null rows; backfill before enforcing NOT NULL';
  end if;
end;
$$;
