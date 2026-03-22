-- Optional local seed data for testing.
-- Keys are now tied to Supabase Auth users.
-- Replace user_id with a real auth.users.id value.

insert into public.api_keys (key, user_id, requests_limit)
values ('api_live_dev_replace_me', '00000000-0000-0000-0000-000000000000', 1000)
on conflict (key) do nothing;
