-- Add fields to support vendor/subcontractor direct submission.

alter table public.invoices
  add column if not exists vendor_email   text,
  add column if not exists document_type  text,       -- 'invoice', 'utility', 'contract', 'other'
  add column if not exists notes          text;

-- Allow the source column to hold 'external_submission' (already text, no enum change needed).
