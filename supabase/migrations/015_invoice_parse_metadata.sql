-- Persist parser provenance so production regressions are diagnosable.

alter table public.invoices
  add column if not exists parse_method text,
  add column if not exists parse_confidence double precision,
  add column if not exists parse_metadata jsonb not null default '{}'::jsonb;
