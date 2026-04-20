-- Normalize OpsFlow pilot personas to the real Stack Real Estate pilot users.
-- Run this after the earlier migrations if your project was already initialized.

update public.profiles
set role = 'ops',
    full_name = 'Sharon',
    email = 'sharon@stackwithus.com'
where id = '00000000-0000-0000-0000-000000000001';

update public.profiles
set role = 'approver',
    full_name = 'Jen',
    email = 'jen@stackwithus.com'
where id = '00000000-0000-0000-0000-000000000002';

update public.profiles
set role = 'accounting',
    full_name = 'Kelson',
    email = 'kelson@stackwithus.com'
where id = '00000000-0000-0000-0000-000000000003';

update public.profiles
set role = 'admin',
    full_name = 'Andrew',
    email = 'andrew@stackwithus.com'
where id = '00000000-0000-0000-0000-000000000004';

update public.profiles
set role = 'vendor',
    full_name = 'Vendor User',
    email = 'vendor@stackwithus.com'
where id = '00000000-0000-0000-0000-000000000005';

-- Map real OTP-authenticated pilot users to their intended primary roles.
update public.profiles set role = 'ops', full_name = 'Sharon'
where lower(email) = 'sharon@stackwithus.com';

update public.profiles set role = 'approver', full_name = 'Jen'
where lower(email) = 'jen@stackwithus.com';

update public.profiles set role = 'accounting', full_name = 'Kelson'
where lower(email) = 'kelson@stackwithus.com';

update public.profiles set role = 'admin', full_name = 'Andrew'
where lower(email) = 'andrew@stackwithus.com';

update public.profiles set role = 'vendor', full_name = 'Vendor User'
where lower(email) = 'vendor@stackwithus.com';
