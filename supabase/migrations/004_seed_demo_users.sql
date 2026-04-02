-- REQUIRED: Run this in Supabase SQL Editor to enable the workflow.
-- Dashboard → SQL Editor → New query → Paste → Run

-- Drop FK from profiles → auth.users so demo users can be inserted directly
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Allow anon role to manage profiles (for demo mode)
DO $$ BEGIN
  CREATE POLICY "profiles_anon_insert" ON public.profiles FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "profiles_anon_update" ON public.profiles FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Insert pilot demo team
INSERT INTO public.profiles (id, email, full_name, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'ops@pilot.opsflow.local',        'Ops User',        'uploader'),
  ('00000000-0000-0000-0000-000000000002', 'reviewer@pilot.opsflow.local',   'Reviewer User',   'reviewer'),
  ('00000000-0000-0000-0000-000000000003', 'accounting@pilot.opsflow.local', 'Accounting User', 'accounting'),
  ('00000000-0000-0000-0000-000000000004', 'admin@pilot.opsflow.local',      'Admin User',      'admin')
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email;
