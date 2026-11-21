-- HUB-118 — close the database layer behind the Guest Portal bulk-read fix.
-- Owner-run in the Supabase SQL Editor. Agents never apply this (Hard Rule 26).
--
-- RLS-ONLY: no table or column changes, so migrations/schema.sql (tables and
-- columns only, Hard Rule 27) is unchanged.
--
-- Why: the committed snapshot (migrations/db-state.json, generated 2026-08-04)
-- shows rls_enabled = false on public.guest_drinks while guest_allergies,
-- guest_sessions, guest_chat_messages and guest_feedback have it enabled with
-- no policies. With RLS off, anyone holding the public anon key can read every
-- guest's drink order straight through PostgREST, bypassing the app routes.
--
-- Safe: every read/write of guest_drinks goes through supabaseAdmin()
-- (service role bypasses RLS), and get_household_activity is SECURITY DEFINER.
-- Enabling RLS with no policy makes the table service-role-only, exactly like
-- guest_allergies. Idempotent: a no-op if RLS is already on.

-- 1. Check first (expected today per the snapshot: rls_enabled = false).
SELECT relname, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('guest_drinks', 'guest_allergies');

-- 2. Apply.
ALTER TABLE public.guest_drinks ENABLE ROW LEVEL SECURITY;

-- 3. Verify: both rows must show rls_enabled = true, and no policy may exist
--    on guest_drinks (the second query must return zero rows).
SELECT relname, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('guest_drinks', 'guest_allergies');

SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'guest_drinks';

-- Rollback (only if something unexpected breaks):
-- ALTER TABLE public.guest_drinks DISABLE ROW LEVEL SECURITY;
