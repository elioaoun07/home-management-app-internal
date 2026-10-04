-- Catalogue revision + ERA module roles (KIT-20 / Catalogue C02, HUB-94)
--
-- Why:
--   1. PATCH /api/catalogue/items/[id] replaced metadata_json wholesale and had
--      no stale-write check: an edit on one phone silently erased fields set on
--      the other, and any field a form didn't know about was dropped on save.
--      `revision` is the compare-and-set token: the route writes
--      `WHERE revision = expected`, a mismatch returns 409.
--      The trigger owns the increment so EVERY writer (routes, RPCs, direct SDK
--      writes, inventory) participates without code changes. Personal flags
--      (pin/favorite/position) and compatibility hints (linked_item_id,
--      is_active_on_calendar) do not bump it — pinning on one phone must not
--      make an open editor on the other phone conflict.
--   2. ERA owns modules by role (`settings_json.era_role`, e.g. "places").
--      One role per user, enforced, so a race can't create two Places modules.
--
-- The app tolerates this migration not being applied yet (it skips the
-- revision check when the column is absent), so deploy order doesn't matter.
--
-- Run manually in the Supabase SQL Editor (Hard Rule #26 — no agent applies
-- DB changes). Idempotent: safe to run twice.

-- ---------------------------------------------------------------------------
-- 0. Inspect FIRST. Step 3 fails if this returns rows — paste them to Claude.
-- ---------------------------------------------------------------------------
-- select user_id, settings_json->>'era_role' as era_role, count(*), array_agg(id)
--   from public.catalogue_modules
--  where settings_json ? 'era_role'
--  group by 1, 2 having count(*) > 1;

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Revision column. Existing rows start at 1.
-- ---------------------------------------------------------------------------
ALTER TABLE public.catalogue_items
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------------------
-- 2. Trigger: bump on any authored change, never on personal/compat flags.
--    Clients cannot set revision directly — the trigger always overrides it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bump_catalogue_item_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_ignored text[] := ARRAY[
    'revision', 'updated_at', 'position', 'is_pinned', 'is_favorite',
    'linked_item_id', 'is_active_on_calendar'
  ];
BEGIN
  IF (to_jsonb(NEW) - v_ignored) IS DISTINCT FROM (to_jsonb(OLD) - v_ignored) THEN
    NEW.revision := OLD.revision + 1;
  ELSE
    NEW.revision := OLD.revision;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_catalogue_items_revision ON public.catalogue_items;
CREATE TRIGGER trigger_catalogue_items_revision
  BEFORE UPDATE ON public.catalogue_items
  FOR EACH ROW EXECUTE FUNCTION public.bump_catalogue_item_revision();

-- ---------------------------------------------------------------------------
-- 3. One ERA role per user (Places today; future ERA-owned modules too).
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS catalogue_modules_era_role_uidx
  ON public.catalogue_modules (user_id, (settings_json->>'era_role'))
  WHERE settings_json ? 'era_role';

COMMIT;

-- ---------------------------------------------------------------------------
-- 4. Verify.
-- ---------------------------------------------------------------------------
-- a) Column exists, every row at revision >= 1:
-- select count(*) as rows, min(revision), max(revision) from public.catalogue_items;
--
-- b) Trigger present:
-- select tgname from pg_trigger
--  where tgrelid = 'public.catalogue_items'::regclass and not tgisinternal;
--   → expect trigger_catalogue_items_revision among them.
--
-- c) Index present:
-- select indexdef from pg_indexes where indexname = 'catalogue_modules_era_role_uidx';

-- ---------------------------------------------------------------------------
-- 5. Read-only: current Catalogue RLS (db-state.json is from 2026-08-04 and
--    shows duplicate policy sets mixing household_members and household_links).
--    Paste the UNTRUNCATED output to Claude; nothing here changes anything.
-- ---------------------------------------------------------------------------
-- select tablename, policyname, permissive, cmd, qual, with_check
--   from pg_policies
--  where schemaname = 'public'
--    and tablename in ('catalogue_modules','catalogue_categories',
--                      'catalogue_items','catalogue_sub_items')
--  order by tablename, cmd, policyname;

-- ---------------------------------------------------------------------------
-- Rollback (safe at any time; the app tolerates a missing revision column):
-- ---------------------------------------------------------------------------
-- DROP TRIGGER IF EXISTS trigger_catalogue_items_revision ON public.catalogue_items;
-- DROP FUNCTION IF EXISTS public.bump_catalogue_item_revision();
-- DROP INDEX IF EXISTS public.catalogue_modules_era_role_uidx;
-- ALTER TABLE public.catalogue_items DROP COLUMN IF EXISTS revision;
