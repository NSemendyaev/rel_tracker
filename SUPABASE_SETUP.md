# Supabase Setup

1. Create a Supabase project.
2. In Supabase, enable Email under Authentication > Providers.
3. Optional: enable Google under Authentication > Providers.
4. Add your local app URL to Authentication > URL Configuration:
   - `http://127.0.0.1:5173`
   - `http://127.0.0.1:5174`
5. Run `supabase-schema.sql` in the Supabase SQL editor.
   - If you already ran an older version of the schema, run the whole file again. It replaces the recursive `couple_members` policies and adds `couple_requests`.
   - If the app says `Could not find the table 'public.couple_requests' in the schema cache`, the latest SQL has not been applied to that Supabase project yet, or the REST schema cache has not refreshed. The SQL file ends with `notify pgrst, 'reload schema';` to force that refresh.
   - The schema also adds `couple_requests`, `couple_members`, and `checkup_submissions` to Supabase Realtime so request, partner, and history changes appear without manual refresh.
6. Copy `.env.example` to `.env.local` and fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Restart the Vite dev server.

How to test:

1. Register user A.
2. Register user B in another browser profile.
3. Copy user B's displayed ID or email.
4. User A searches for user B and sends a couple request.
5. User B signs in, views the pending request, and accepts it.
6. Both users should now see the shared dashboard.
7. Each user submits their own check-ups.

Without these environment variables, the app stays in local prototype mode.
