-- 012_invoice_edit_log.sql
-- Add a per-invoice edit log for tracking non-admin field edits.
--
-- Each entry: { user, user_id, timestamp, fields: string[] }

alter table public.invoices
  add column if not exists edit_log jsonb not null default '[]'::jsonb;
