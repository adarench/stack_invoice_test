-- Allow vendor_name to be null so the ingestion pipeline can persist invoices
-- whose parser couldn't recover a vendor, instead of injecting the
-- "Unknown Vendor" sentinel that hid triage cases.

alter table public.invoices
  alter column vendor_name drop not null;
