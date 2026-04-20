-- 013_seed_routing_team.sql
-- Seed profiles for bucket team members.

-- Drop FK to auth.users so we can insert profiles without OTP accounts.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Deduplicate: keep the row with the earliest created_at for each email,
-- delete the rest so we can add a unique constraint.
DELETE FROM public.profiles p
USING public.profiles p2
WHERE p.email = p2.email
  AND p.id <> p2.id
  AND (p.created_at > p2.created_at OR (p.created_at = p2.created_at AND p.id > p2.id));

-- Now safe to add the unique constraint.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);

INSERT INTO public.profiles (id, email, full_name, role) VALUES
  (gen_random_uuid(), 'sharon@stackwithus.com',     'Sharon',   'ops'),
  (gen_random_uuid(), 'jen@stackwithus.com',         'Jen',      'ops'),
  (gen_random_uuid(), 'andrew@stackwithus.com',      'Andrew',   'ops'),
  (gen_random_uuid(), 'trevor@stackwithus.com',      'Trevor',   'ops'),
  (gen_random_uuid(), 'ryan@stackwithus.com',        'Ryan',     'ops'),
  (gen_random_uuid(), 'nn@stackstorage.us',          'Nache',    'ops'),
  (gen_random_uuid(), 'jt@stackstorage.us',          'James',    'ops'),
  (gen_random_uuid(), 'ec@buildconstruction.co',     'Ean',      'ops'),
  (gen_random_uuid(), 'kelson@stackwithus.com',      'Kelson',   'ops'),
  (gen_random_uuid(), 'fernando@stackwithus.com',    'Fernando', 'ops'),
  (gen_random_uuid(), 'jessica@stackwithus.com',     'Jessica',  'ops'),
  (gen_random_uuid(), 'jan@stackwithus.com',         'Jan',      'ops')
ON CONFLICT (email) DO UPDATE
  SET full_name = EXCLUDED.full_name;
