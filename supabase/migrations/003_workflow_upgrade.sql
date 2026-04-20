-- ─── Workflow Upgrade ─────────────────────────────────────────────────────────
-- Adds multi-user workflow: roles, statuses, assignment, paid state.

-- 1. Drop FK from profiles → auth.users so we can seed demo users directly
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Add new invoice statuses to the enum
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'needs_triage';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'in_review';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'paid';

-- 3. Add workflow columns to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_action_at timestamptz DEFAULT now();

-- 4. Seed demo users (small team at Stack Real Estate)
INSERT INTO public.profiles (id, email, full_name, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'sharon@stackwithus.com', 'Sharon', 'uploader'),
  ('00000000-0000-0000-0000-000000000002', 'jen@stackwithus.com',    'Jen',    'reviewer'),
  ('00000000-0000-0000-0000-000000000003', 'kelson@stackwithus.com', 'Kelson', 'accounting'),
  ('00000000-0000-0000-0000-000000000004', 'andrew@stackwithus.com', 'Andrew', 'admin')
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email;
