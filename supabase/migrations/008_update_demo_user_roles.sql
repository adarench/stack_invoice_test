-- Update demo user roles and names to match simplified role model.
-- Legacy roles 'uploader' and 'reviewer' are renamed to 'ops' and 'approver'.

update public.profiles set role = 'ops', full_name = 'Sharon', email = 'sharon@stackwithus.com'
  where id = '00000000-0000-0000-0000-000000000001';

update public.profiles set role = 'approver', full_name = 'Jen', email = 'jen@stackwithus.com'
  where id = '00000000-0000-0000-0000-000000000002';

update public.profiles set full_name = 'Kelson', email = 'kelson@stackwithus.com'
  where id = '00000000-0000-0000-0000-000000000003';

update public.profiles set full_name = 'Andrew', email = 'andrew@stackwithus.com'
  where id = '00000000-0000-0000-0000-000000000004';

update public.profiles set full_name = 'Vendor User', email = 'vendor@stackwithus.com'
  where id = '00000000-0000-0000-0000-000000000005';

-- Normalize pilot roles when real auth users sign in through Supabase.
update public.profiles set role = 'ops', full_name = 'Sharon'
  where lower(email) = 'sharon@stackwithus.com';

update public.profiles set role = 'approver', full_name = 'Jen'
  where lower(email) = 'jen@stackwithus.com';

update public.profiles set role = 'accounting', full_name = 'Kelson'
  where lower(email) = 'kelson@stackwithus.com';

update public.profiles set role = 'admin', full_name = 'Andrew'
  where lower(email) = 'andrew@stackwithus.com';

-- Migrate any other profiles still using legacy role names
update public.profiles set role = 'ops' where role = 'uploader';
update public.profiles set role = 'approver' where role = 'reviewer';
