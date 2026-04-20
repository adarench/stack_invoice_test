# OpsFlow Change Log

Living record of meaningful product, workflow, auth, deployment, and trust-hardening changes applied to this codebase.

Last updated: 2026-04-09

## Current Status

OpsFlow is live at `https://stack-invoice-system.web.app` on:

- Frontend: Firebase Hosting
- Backend/Auth/Storage: Supabase
- Email notifications: Supabase Edge Function `send-notification` with Resend

The app is now in pilot-ready shape for a small internal Stack Real Estate team, but still has known limitations around portfolio master data and automatic G/L coding.

## Major Milestones

### 1. Hosted demo foundation

Implemented the lightweight hosted architecture:

- Firebase Hosting for the Vite frontend
- Supabase for database, auth, storage, and edge functions

Added:

- [firebase.json](/Users/arench/Desktop/invoicing_demo_flow/firebase.json)
- [.firebaserc](/Users/arench/Desktop/invoicing_demo_flow/.firebaserc)
- [.env.example](/Users/arench/Desktop/invoicing_demo_flow/.env.example)
- [DEPLOY.md](/Users/arench/Desktop/invoicing_demo_flow/DEPLOY.md)

Key outcomes:

- production build configured for static hosting
- SPA routing supported on refresh
- frontend env handling documented
- Supabase OTP/pilot auth flow documented

### 2. Real pilot users replaced demo personas

Moved the app from fake/generic internal personas to the real Stack pilot identities:

- Sharon — Ops — `sharon@stackwithus.com`
- Jen — Approver — `jen@stackwithus.com`
- Kelson — Accounting — `kelson@stackwithus.com`
- Andrew — Admin — `andrew@stackwithus.com`

Updated:

- [src/data/demoUsers.js](/Users/arench/Desktop/invoicing_demo_flow/src/data/demoUsers.js)
- Supabase seed/update migrations for pilot users

Added migration:

- [supabase/migrations/009_stack_pilot_users.sql](/Users/arench/Desktop/invoicing_demo_flow/supabase/migrations/009_stack_pilot_users.sql)

Key outcomes:

- real names now appear in assignment/workflow UI
- hosted auth can map real emails to practical role labels
- loose collaboration model preserved

### 3. Vendor upload flow unified with internal parsing

Fixed the major product inconsistency where vendor-submitted invoices uploaded PDFs but skipped the shared parsing pipeline.

Added shared ingestion layer:

- [src/lib/invoiceIngestion.js](/Users/arench/Desktop/invoicing_demo_flow/src/lib/invoiceIngestion.js)

Updated:

- [src/components/UploadInvoice.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/UploadInvoice.jsx)
- [src/components/VendorSubmit.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/VendorSubmit.jsx)
- [src/components/VendorDashboard.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/VendorDashboard.jsx)
- [src/api/invoiceApi.js](/Users/arench/Desktop/invoicing_demo_flow/src/api/invoiceApi.js)
- [src/lib/parsePdf.js](/Users/arench/Desktop/invoicing_demo_flow/src/lib/parsePdf.js)

Key outcomes:

- vendor and internal uploads now reuse the same parsing + normalization flow
- parsed fields win where appropriate
- vendor-entered data is used as fallback/supplemental metadata
- debug logging added for ingestion visibility

### 4. Hosted production parity fixes

Fixed several production-vs-local mismatches after the first hosted rollout.

Issues addressed:

- `Upload Invoice` button was rendered in some places with a no-op handler
- role-aware queue views felt empty or identical
- stale demo routing assumptions still leaked into hosted assignment/review behavior

Updated:

- [src/App.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/App.jsx)
- [src/components/Layout.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/Layout.jsx)
- [src/components/InvoiceList.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/InvoiceList.jsx)
- [src/components/Dashboard.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/Dashboard.jsx)
- [src/api/userApi.js](/Users/arench/Desktop/invoicing_demo_flow/src/api/userApi.js)
- [src/components/ActionRequiredBanner.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/ActionRequiredBanner.jsx)
- [src/components/NeedsAttentionPanel.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/NeedsAttentionPanel.jsx)

Key outcomes:

- upload works from live internal UI
- queue empty states are clearer
- hosted behavior is closer to localhost

### 5. Internal upload access restored across roles

Role refinement had become too restrictive and hid internal upload from some users.

Updated:

- [src/data/demoUsers.js](/Users/arench/Desktop/invoicing_demo_flow/src/data/demoUsers.js)

Key outcomes:

- Ops, Approver, Accounting, and Admin can all access internal upload
- vendor flow remains separate
- roles still guide emphasis, but do not hard-block collaboration

### 6. Global search made real

The shell/top-bar search looked global but was previously fake.

Updated:

- [src/App.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/App.jsx)
- [src/components/Layout.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/Layout.jsx)
- [src/components/InvoiceList.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/InvoiceList.jsx)

Current behavior:

- search is client-filtered over the live invoice dataset loaded from Supabase
- supported fields include:
  - `invoice_number`
  - `vendor_name`
  - `property_name`
  - `description`
  - `bill_to_name`
- newly uploaded invoices become searchable immediately through app state + realtime refresh

### 7. Single-user workflow testing and admin override

Removed the implicit multi-user dependency that made full lifecycle testing awkward.

Updated:

- [src/api/userApi.js](/Users/arench/Desktop/invoicing_demo_flow/src/api/userApi.js)
- [src/components/InvoiceDetail.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/InvoiceDetail.jsx)

Key outcomes:

- Admin can complete upload → assign → submit → approve → paid
- self-assignment/self-review flow is supported
- vendor users are not assignable internally

### 8. Password login added for pilot reliability

The app originally exposed only magic-link login, which created rate-limit problems during repeated testing.

Updated:

- [src/context/AuthContext.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/context/AuthContext.jsx)
- [src/components/LoginScreen.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/LoginScreen.jsx)

Current behavior:

- `Password` sign-in is available for repeat pilot use
- `Magic Link` remains available as fallback

Pilot password setup was done manually in Supabase Auth for:

- Sharon
- Jen
- Kelson
- Andrew

### 9. Local accounting + portfolio upgrade groundwork

Implemented the first accounting-allocation and portfolio-aware workflow layer locally, then rolled the production-safe parts forward.

Added:

- [supabase/migrations/010_invoice_gl_splits.sql](/Users/arench/Desktop/invoicing_demo_flow/supabase/migrations/010_invoice_gl_splits.sql)
- [supabase/migrations/011_invoice_portfolio_override.sql](/Users/arench/Desktop/invoicing_demo_flow/supabase/migrations/011_invoice_portfolio_override.sql)
- [src/data/propertyCatalog.js](/Users/arench/Desktop/invoicing_demo_flow/src/data/propertyCatalog.js)
- [src/lib/invoiceAccounting.js](/Users/arench/Desktop/invoicing_demo_flow/src/lib/invoiceAccounting.js)
- [src/components/PortfolioTabs.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/PortfolioTabs.jsx)

Updated:

- [src/components/InvoiceDetail.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/InvoiceDetail.jsx)
- [src/components/InvoiceList.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/InvoiceList.jsx)
- [src/components/Dashboard.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/Dashboard.jsx)
- [src/components/ParsedInvoiceView.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/ParsedInvoiceView.jsx)
- [src/api/invoiceApi.js](/Users/arench/Desktop/invoicing_demo_flow/src/api/invoiceApi.js)
- [src/data/mockData.js](/Users/arench/Desktop/invoicing_demo_flow/src/data/mockData.js)

Key outcomes:

- invoices support `gl_splits`
- invoice detail supports editing multi-line accounting allocations
- portfolio grouping exists in the UI
- portfolio override exists on invoice detail

### 10. Trust-hardening pass

Applied a focused trust-hardening patch before broader pilot usage.

#### Allocation controls

Updated:

- [src/lib/invoiceAccounting.js](/Users/arench/Desktop/invoicing_demo_flow/src/lib/invoiceAccounting.js)
- [src/App.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/App.jsx)
- [src/components/InvoiceDetail.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/InvoiceDetail.jsx)
- [src/components/InvoiceList.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/InvoiceList.jsx)
- [src/components/ActionRequiredBanner.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/ActionRequiredBanner.jsx)
- [src/components/NeedsAttentionPanel.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/NeedsAttentionPanel.jsx)

Key outcomes:

- mismatched or missing allocations block approval/payment
- inline messaging explains why

#### Portfolio uncertainty

Updated:

- [src/lib/invoiceAccounting.js](/Users/arench/Desktop/invoicing_demo_flow/src/lib/invoiceAccounting.js)
- [src/components/InvoiceDetail.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/InvoiceDetail.jsx)
- [src/api/invoiceApi.js](/Users/arench/Desktop/invoicing_demo_flow/src/api/invoiceApi.js)

Key outcomes:

- `Needs Mapping` is visible instead of silent
- manual portfolio override is supported

#### AI/risk language softening

Updated:

- [src/components/InvoiceDetail.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/InvoiceDetail.jsx)
- [src/components/ApprovalQueue.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/ApprovalQueue.jsx)
- [src/data/mockData.js](/Users/arench/Desktop/invoicing_demo_flow/src/data/mockData.js)

Key outcomes:

- language now sounds assistive rather than falsely authoritative
- examples:
  - `Review Recommended`
  - `Extraction confidence`
  - softer anomaly copy

### 11. Short-term production cleanup for visible detail-page trust issues

Applied a tight production-safe patch for messy live invoice detail pages.

Updated:

- [src/data/propertyCatalog.js](/Users/arench/Desktop/invoicing_demo_flow/src/data/propertyCatalog.js)
- [src/lib/invoiceAccounting.js](/Users/arench/Desktop/invoicing_demo_flow/src/lib/invoiceAccounting.js)
- [src/api/userApi.js](/Users/arench/Desktop/invoicing_demo_flow/src/api/userApi.js)
- [src/components/InvoiceDetail.jsx](/Users/arench/Desktop/invoicing_demo_flow/src/components/InvoiceDetail.jsx)

Key outcomes:

- known property codes now map:
  - `4401` → `Operations`
  - `6509` → `Storage`
- assignment dropdown is deduped across seeded + real profiles
- default accounting allocation is rendered when enough info exists
- assignment display no longer shows contradictory `Unassigned` vs `Assigned to Jen` states on detail pages

## Current Known Limitations

These are not hidden bugs; they are known product limits.

### G/L code inference is still manual-first

The app can now infer:

- portfolio
- entity code
- entity name
- amount

But it does **not** yet have a real rules engine for deriving G/L codes from:

- vendor
- service type
- property
- historical coding patterns

So when no saved `gl_splits` exist, the fallback allocation row may still show:

- entity filled in
- amount filled in
- `No G/L code`

This is intentional and safer than inventing a G/L code.

### Portfolio mapping is still a short-term lookup

Portfolio resolution currently relies on:

- manual override
- friendly property name
- known property/entity code aliases

It is not yet a full master-data system.

### App-level compatibility fallbacks still exist

Some invoice API paths still degrade gracefully if optional schema columns are missing. That is helpful during rollout, but long-term the app should rely less on silent optional-column fallbacks.

## Production-Executed Steps So Far

These were actually completed, not just planned.

- Firebase Hosting configured and deployed
- Supabase project linked and used as backend
- pilot users configured in Supabase Auth
- password sign-in enabled in app
- `send-notification` edge function deployed
- `RESEND_API_KEY` set in Supabase secrets
- migrations `010_invoice_gl_splits.sql` and `011_invoice_portfolio_override.sql` applied in Supabase
- multiple Firebase redeploys completed as UI/workflow fixes were rolled out

## Recommended Next Work

Highest-value next patches if continuing from here:

1. Add explicit default G/L mapping rules
   - likely by vendor + portfolio
   - only where confidence is explicit

2. Improve property/entity master data
   - move beyond a checked-in lookup map

3. Reduce old compatibility logic in `invoiceApi`
   - fail more clearly once production schema is stable

4. Add real regression coverage
   - build alone is not enough
   - critical workflows need at least a minimal hosted smoke test script or E2E coverage

## Update Guidance

When continuing work, append new entries in this file under:

- new production patch
- local feature implementation
- migration applied
- deployment performed
- known limitation discovered

Keep entries factual:

- what changed
- which files changed
- what actually shipped
- what still remains limited
