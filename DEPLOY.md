# OpsFlow Demo Deployment

## Recommended architecture

- Frontend: Firebase Hosting
- Data, auth, storage, realtime: Supabase
- Email notifications: Supabase Edge Function `send-notification`

This repo is a static Vite app. It does not need Cloud Run.

## Required environment variables

Create `.env.local` for local work and configure the same values in your hosting build environment:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_SKIP_AUTH=false
VITE_NOTIFICATIONS_ENABLED=true
```

Notes:

- `VITE_SKIP_AUTH=false` is the hosted-demo default. The app uses real Supabase OTP login.
- Set `VITE_SKIP_AUTH=true` only for explicit local demo/mock mode.
- `VITE_NOTIFICATIONS_ENABLED=true` requires the Supabase edge function and `RESEND_API_KEY`.

## One-time Supabase setup

1. Link to the target project.

```bash
supabase link --project-ref <your-project-ref>
```

2. Apply database migrations.

```bash
supabase db push
```

3. Deploy the email edge function.

```bash
supabase functions deploy send-notification
```

4. Set the Resend secret used by the edge function.

```bash
supabase secrets set RESEND_API_KEY=<your-resend-api-key>
```

5. Configure Supabase Auth for the hosted domain.

- In Supabase Dashboard -> Authentication -> URL Configuration:
  - Set `Site URL` to your Firebase Hosting URL, for example `https://stack-invoice-system.web.app`
  - Add the same URL to `Additional Redirect URLs`
- If you later add a custom domain, add that domain to both fields as well.

## Hosted demo user setup

The app now reads roles from `public.profiles` for real OTP users.

Recommended hosted-demo flow:

1. Create or invite the demo users through Supabase Auth.
2. Have each user sign in once so the `handle_new_user` trigger creates a row in `public.profiles`.
3. Update their roles in SQL.

Example:

```sql
update public.profiles set role = 'ops', full_name = 'Sharon'        where email = 'sharon@stackwithus.com';
update public.profiles set role = 'approver', full_name = 'Jen'      where email = 'jen@stackwithus.com';
update public.profiles set role = 'accounting', full_name = 'Kelson' where email = 'kelson@stackwithus.com';
update public.profiles set role = 'admin', full_name = 'Andrew'      where email = 'andrew@stackwithus.com';
update public.profiles set role = 'vendor', full_name = 'Vendor User' where email = 'vendor@stackwithus.com';
```

Without this step, new OTP users will inherit the default profile role from the database.

## Firebase Hosting setup

1. Install dependencies.

```bash
npm install
```

2. Build locally to verify the production bundle.

```bash
npm run build
```

3. Authenticate Firebase CLI and select a project.

```bash
firebase login
firebase use stack-invoice-system
```

4. Deploy hosting.

```bash
firebase deploy --only hosting
```

This repo already targets Firebase project `stack-invoice-system` through `.firebaserc`.

`firebase.json` already includes:

- `dist/` as the hosting output
- a predeploy build hook
- SPA rewrites to `index.html`
- immutable caching for built assets

## Build and deploy checklist

- `.env.local` or CI env vars are set correctly
- `supabase db push` completed successfully
- `send-notification` edge function is deployed
- `RESEND_API_KEY` is configured
- Supabase Auth redirect URLs include the Firebase domain
- Demo users have signed in once and their roles are set in `public.profiles`
- `firebase deploy --only hosting` succeeds
- Hosted URL resolves at `https://stack-invoice-system.web.app` or `https://stack-invoice-system.firebaseapp.com`

## Gotchas

- If Supabase env vars are missing, the app now shows a setup-required screen instead of silently pretending to be production-ready.
- Role-based workflow in hosted mode depends on `public.profiles`, not the local demo-user switcher.
- Vendor and internal uploads both write to the Supabase Storage `invoices` bucket; make sure migrations created the bucket and policies.
- Notifications are non-blocking. Workflow actions still succeed if the edge function or Resend delivery fails.
