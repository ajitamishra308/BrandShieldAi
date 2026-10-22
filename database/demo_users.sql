-- Run AFTER you create four users in Supabase (Authentication -> Users -> Add user -> Create new user,
-- tick "Auto Confirm User"). Use these emails and one shared demo password:
--   creator@brandshield.demo   manager@brandshield.demo
--   reviewer@brandshield.demo  admin@brandshield.demo
-- These are demo-only accounts with no real data.

insert into public.profiles (id, full_name, role)
select id, 'Asha (Creator)', 'creator' from auth.users where email = 'creator@brandshield.demo'
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;

insert into public.profiles (id, full_name, role)
select id, 'Rohan (Manager)', 'manager' from auth.users where email = 'manager@brandshield.demo'
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;

insert into public.profiles (id, full_name, role)
select id, 'Meera (Reviewer)', 'reviewer' from auth.users where email = 'reviewer@brandshield.demo'
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;

insert into public.profiles (id, full_name, role)
select id, 'Kabir (Admin)', 'admin' from auth.users where email = 'admin@brandshield.demo'
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;
