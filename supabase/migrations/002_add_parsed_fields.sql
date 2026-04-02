-- Add parsed invoice fields that were missing from the initial schema.
-- These fields are extracted from uploaded PDFs and must persist across reloads.

alter table public.invoices
  add column if not exists invoice_date  date,
  add column if not exists due_date      date,
  add column if not exists bill_to_name  text,
  add column if not exists description   text,
  add column if not exists line_items    jsonb default '[]'::jsonb,
  add column if not exists raw_text      text,
  add column if not exists parse_status  text,       -- 'parsed', 'partial', 'failed', 'manual'
  add column if not exists parse_errors  text,
  add column if not exists source        text;       -- 'upload', 'manual', 'mock'

-- ─── Allow anon access for demo mode (VITE_SKIP_AUTH=true) ────────────────────
-- When auth is skipped, the anon key is used. These policies let the demo work
-- without requiring a real login. In production, remove these and use authenticated-only.

create policy "invoices_anon_select" on public.invoices
  for select using (true);

create policy "invoices_anon_insert" on public.invoices
  for insert with check (true);

create policy "invoices_anon_update" on public.invoices
  for update using (true);

-- Profiles: allow anon read so invoice joins on profiles work in demo mode
create policy "profiles_anon_select" on public.profiles
  for select using (true);

-- Audit logs and comments: allow anon access for demo mode
create policy "audit_anon_select" on public.audit_logs
  for select using (true);

create policy "audit_anon_insert" on public.audit_logs
  for insert with check (true);

create policy "comments_anon_select" on public.comments
  for select using (true);

create policy "comments_anon_insert" on public.comments
  for insert with check (true);

-- Storage: allow anon uploads for demo mode
create policy "invoices_storage_anon_insert" on storage.objects
  for insert with check (bucket_id = 'invoices');

create policy "invoices_storage_anon_select" on storage.objects
  for select using (bucket_id = 'invoices');
