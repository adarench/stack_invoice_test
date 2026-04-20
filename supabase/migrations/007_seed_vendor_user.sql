-- Seed the vendor demo user into profiles.
insert into public.profiles (id, email, full_name, role)
values ('00000000-0000-0000-0000-000000000005', 'vendor@stackwithus.com', 'Vendor User', 'vendor')
on conflict (id) do update set
  email     = excluded.email,
  full_name = excluded.full_name,
  role      = excluded.role;
