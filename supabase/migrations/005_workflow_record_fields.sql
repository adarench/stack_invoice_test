-- Normalize the invoice workflow to:
-- uploaded -> in_review -> approved -> paid
-- and add minimal system-of-record metadata.

ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'in_review';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'paid';

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS assigned_reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Migrate legacy statuses into the supported state machine.
UPDATE public.invoices
SET status = 'in_review'
WHERE status = 'under_review';

UPDATE public.invoices
SET status = 'uploaded',
    assigned_to = NULL,
    assigned_reviewer_id = NULL
WHERE status IN ('flagged', 'rejected', 'needs_triage');

-- Backfill reviewer assignment where we already know who owned review.
UPDATE public.invoices
SET assigned_reviewer_id = COALESCE(assigned_reviewer_id, assigned_to)
WHERE assigned_to IS NOT NULL;
