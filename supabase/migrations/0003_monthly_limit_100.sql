-- Enforce default monthly quota of 1000 requests per API key.

alter table public.api_keys
  alter column requests_limit set default 1000;

update public.api_keys
set requests_limit = 1000
where requests_limit is null or requests_limit <> 1000;
