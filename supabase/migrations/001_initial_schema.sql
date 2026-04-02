-- OpsFlow Initial Schema
-- Run this in your Supabase SQL editor: https://supabase.com/dashboard → SQL Editor

-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Profiles ─────────────────────────────────────────────────────────────────
-- Extends auth.users — auto-populated via trigger below
create table public.profiles (
  id        uuid references auth.users(id) on delete cascade primary key,
  email     text not null,
  full_name text,
  role      text not null default 'reviewer',
  created_at timestamptz default now()
);

-- ─── Invoices ─────────────────────────────────────────────────────────────────
create type public.invoice_status as enum (
  'uploaded',
  'under_review',
  'approved',
  'flagged'
);

create table public.invoices (
  id             uuid default uuid_generate_v4() primary key,
  invoice_number text,
  vendor_name    text not null,
  property_name  text,
  amount         numeric(12, 2),
  status         public.invoice_status not null default 'uploaded',
  assigned_to    uuid references public.profiles(id) on delete set null,
  uploaded_by    uuid references public.profiles(id) on delete set null,
  file_url       text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- ─── Comments ─────────────────────────────────────────────────────────────────
create table public.comments (
  id         uuid default uuid_generate_v4() primary key,
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  user_id    uuid references public.profiles(id) on delete set null,
  content    text not null,
  created_at timestamptz default now()
);

-- ─── Audit Logs ───────────────────────────────────────────────────────────────
create table public.audit_logs (
  id         uuid default uuid_generate_v4() primary key,
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  user_id    uuid references public.profiles(id) on delete set null,
  action     text not null,
  note       text,
  created_at timestamptz default now()
);

-- ─── Row Level Security ────────────────────────────────────────────────────────
alter table public.profiles   enable row level security;
alter table public.invoices   enable row level security;
alter table public.comments   enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: users can see all profiles, only edit their own
create policy "profiles_select" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "profiles_insert" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update" on public.profiles
  for update using (auth.uid() = id);

-- Invoices: all authenticated users have full access (small internal team)
create policy "invoices_select" on public.invoices
  for select using (auth.role() = 'authenticated');

create policy "invoices_insert" on public.invoices
  for insert with check (auth.role() = 'authenticated');

create policy "invoices_update" on public.invoices
  for update using (auth.role() = 'authenticated');

-- Comments: authenticated users can read all, insert only their own
create policy "comments_select" on public.comments
  for select using (auth.role() = 'authenticated');

create policy "comments_insert" on public.comments
  for insert with check (auth.uid() = user_id);

-- Audit logs: authenticated users can read all and insert
create policy "audit_select" on public.audit_logs
  for select using (auth.role() = 'authenticated');

create policy "audit_insert" on public.audit_logs
  for insert with check (auth.role() = 'authenticated');

-- ─── Auto-create profile on sign-up ───────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Storage ──────────────────────────────────────────────────────────────────
-- Create a public bucket for invoice PDFs
insert into storage.buckets (id, name, public)
  values ('invoices', 'invoices', true)
  on conflict do nothing;

create policy "invoices_storage_insert" on storage.objects
  for insert with check (bucket_id = 'invoices' and auth.role() = 'authenticated');

create policy "invoices_storage_select" on storage.objects
  for select using (bucket_id = 'invoices');

create policy "invoices_storage_delete" on storage.objects
  for delete using (bucket_id = 'invoices' and auth.uid() = owner);
