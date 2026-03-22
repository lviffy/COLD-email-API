-- Optional local seed data for testing.
-- Keys are now tied to Supabase Auth users.
-- This script picks the oldest existing auth user and seeds one API key.

do $$
declare
	target_user_id uuid;
begin
	select id
	into target_user_id
	from auth.users
	order by created_at asc
	limit 1;

	if target_user_id is null then
		raise notice 'No users found in auth.users. Create an account first, then run seed.sql again.';
		return;
	end if;

	insert into public.api_keys (key, user_id, requests_limit, requests_used, is_active)
	values ('ce_live_dev_seed_key', target_user_id, 1000, 0, true)
	on conflict (user_id)
	do update set
		requests_limit = excluded.requests_limit,
		is_active = true;
end
$$;
