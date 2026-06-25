# Deployment Guide

This app is a Vite React frontend with Supabase for auth, database, RLS, and realtime.

## Required Before Deploying

1. Run the latest `supabase-schema.sql` in the Supabase SQL editor.
2. Confirm the SQL finishes without errors.
3. Wait a moment for the Supabase REST schema cache to refresh.
4. Run the local two-user QA checklist from the app's QA page.
5. Run:

```bash
npm run lint
npm run build
```

## Vercel Deployment

Recommended settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

Add these Vercel environment variables:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

Use the anon/publishable key only. Do not put a Supabase service-role key in Vercel for this frontend.

## Supabase Auth URLs

After Vercel gives you a production URL, update Supabase:

1. Go to Authentication > URL Configuration.
2. Set Site URL to the production URL, for example:

```text
https://your-app.vercel.app
```

3. Add redirect URLs:

```text
https://your-app.vercel.app
http://127.0.0.1:5174
http://127.0.0.1:5173
```

The local URLs are useful while developing.

## Production Smoke Test

After deployment:

1. Open the production URL.
2. Sign up as User A.
3. Sign up as User B in a second browser/private window.
4. Set display names for both users.
5. Send and accept a couple request.
6. Submit a Daily check-up from User A.
7. Confirm User B can see it in Overview and History.
8. Submit from User B.
9. Add a Talk prompt and move it through Scheduled, Needs another talk, and Resolved.

## Rollback

If production pairing or submissions fail:

1. Check that Vercel has the correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Re-run `supabase-schema.sql`.
3. Refresh the app.
4. Check the browser console and Supabase logs for the exact error.
