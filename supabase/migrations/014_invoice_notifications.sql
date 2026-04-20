-- Add invoice-level notification metadata for deduplicated review emails.

alter table public.invoices
  add column if not exists notifications jsonb not null default '{}'::jsonb;
