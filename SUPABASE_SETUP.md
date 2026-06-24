# Supabase Setup

1. Create a Supabase project.
2. In Supabase, enable Email under Authentication > Providers.
3. Optional: enable Google under Authentication > Providers.
4. Add your local app URL to Authentication > URL Configuration:
   - `http://127.0.0.1:5173`
   - `http://127.0.0.1:5174`
5. Run `supabase-schema.sql` in the Supabase SQL editor.
6. Copy `.env.example` to `.env.local` and fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Restart the Vite dev server.

How to test:

1. Register user A.
2. Register user B in another browser profile.
3. Copy user B's displayed ID or email.
4. User A searches for user B and creates the couple.
5. Each user submits their own check-ups.

Without these environment variables, the app stays in local prototype mode.
