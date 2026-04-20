-- Local-first trust hardening: allow a lightweight manual portfolio override per invoice.

alter table public.invoices
  add column if not exists portfolio_override text;
