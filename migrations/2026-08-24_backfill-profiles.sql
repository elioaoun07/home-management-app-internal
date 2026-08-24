-- migrations/2026-08-24_backfill-profiles.sql
--
-- WHAT: populate `public.profiles` from `auth.users`, and keep it populated.
-- WHY:  the table is EMPTY, so four features silently degrade to an email
--       prefix or a placeholder:
--         src/hooks/useHouseholdMembers.ts   -> partner shows as "aounelio"
--         src/app/api/hub/messages/route.ts  -> sender name falls back
--         src/app/api/cron/chat-notifications/route.ts -> "Someone" in pushes
--         src/app/nfc/[tag]/page.tsx         -> guest greeting falls back
--
-- `auth.users` is not reachable through PostgREST, so application code cannot
-- read names from it directly — which is exactly why the `profiles` mirror
-- exists. This is the standard Supabase pattern: backfill once, then a trigger
-- keeps it in step.
--
-- NOTE: this does NOT gate the statement-import transfer matching. That was
-- reworked to not depend on profile names at all — a legal name on a bank
-- statement ("ELIO ANTOINE AOUN") is not the same string as a display name
-- ("Elio"), so matching on it was fragile even with the table populated.
--
-- Safe to re-run.

-- 1. INSPECT — how many users have no profile row yet.
SELECT count(*) AS users_without_profile
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 2. BACKFILL — prefers the signup metadata, falls back to the email prefix.
INSERT INTO public.profiles (id, full_name)
SELECT
  u.id,
  COALESCE(
    NULLIF(u.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(u.raw_user_meta_data ->> 'name', ''),
    split_part(u.email, '@', 1)
  )
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- 3. KEEP IT IN STEP — new signups get a profile automatically.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. VERIFY — expect 0, then your two rows with readable names.
SELECT count(*) AS still_missing
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

SELECT id, full_name FROM public.profiles ORDER BY full_name;

-- 5. Set the display names you actually want (the backfill only guesses):
--   UPDATE public.profiles SET full_name = 'Elio'  WHERE id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830';
--   UPDATE public.profiles SET full_name = 'Racha' WHERE id = '<partner uuid>';

-- ROLLBACK:
--   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--   DROP FUNCTION IF EXISTS public.handle_new_user();
--   -- profile rows are harmless; delete only if you really want them gone.
