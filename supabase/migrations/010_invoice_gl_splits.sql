-- Add structured accounting allocation support for invoices.
-- Local-first rollout: do not run this in production until the frontend has been verified locally.

alter table public.invoices
  add column if not exists gl_splits jsonb not null default '[]'::jsonb;
