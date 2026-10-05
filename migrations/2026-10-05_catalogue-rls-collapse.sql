-- Catalogue sharing: one policy set, public by default, sub-items follow the item (KIT-26)
--
-- Evidence: migrations/output.md (pg_policies, 2026-10-04) — Hard Rule #27.
--
-- Owner rule (2026-10-05): everything is shared with the household unless it is
-- explicitly set to private. Sub-items share their parent item's audience.
--
-- What this changes:
--   1. catalogue_items.is_public defaults to true (was false; modules and
--      categories already default to true). Existing rows are NOT touched.
--   2. catalogue_sub_items gets is_public, always derived from the parent item
--      by trigger (insert + parent flip), so the SELECT policy is a direct
--      column check — no join to catalogue_items (Hard Rule #20).
--   3. Partner can read sub-items of items they can read. Writes stay owner-only.
--   4. Duplicate policy sets collapse to one:
--        catalogue_items      — drops the 4 legacy "Users can ..." / "visibility"
--                               policies (household_members-based SELECT does not
--                               check household_links.active and its scalar
--                               subquery errors for a user in 2+ households).
--        catalogue_sub_items  — 4 legacy policies replaced by *_policy set.
--        catalogue_modules    — legacy delete policy (is_system = false) was
--                               OR-ed with the plain owner delete, so it never
--                               protected system modules; the single delete
--                               policy now carries the is_system guard.
--
-- Run manually in the Supabase SQL Editor (Hard Rule #26). Idempotent.
-- Needs migrations/2026-10-04_catalogue-revision.sql applied first (it already is).

-- ---------------------------------------------------------------------------
-- 0. Read-only pre-check. Rows here are people the legacy household_members
--    policy still shows items to although the link is inactive (the leak step 4
--    closes) — informational, nothing to fix first.
-- ---------------------------------------------------------------------------
-- select hm1.user_id as a, hm2.user_id as b, hl.active
--   from public.household_members hm1
--   join public.household_members hm2
--     on hm2.household_id = hm1.household_id and hm1.user_id < hm2.user_id
--   join public.household_links hl on hl.id = hm1.household_id
--  where hl.active is not true;

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Items default to shared.
-- ---------------------------------------------------------------------------
ALTER TABLE public.catalogue_items
  ALTER COLUMN is_public SET DEFAULT true;

-- ---------------------------------------------------------------------------
-- 2. Sub-items inherit the parent's audience.
-- ---------------------------------------------------------------------------
ALTER TABLE public.catalogue_sub_items
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- Backfill from parents (a NULL parent flag counts as private).
UPDATE public.catalogue_sub_items si
   SET is_public = COALESCE(ci.is_public, false)
  FROM public.catalogue_items ci
 WHERE ci.id = si.item_id
   AND si.is_public IS DISTINCT FROM COALESCE(ci.is_public, false);

CREATE OR REPLACE FUNCTION public.catalogue_sub_item_inherit_audience()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.is_public := COALESCE(
    (SELECT ci.is_public FROM public.catalogue_items ci WHERE ci.id = NEW.item_id),
    false
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_catalogue_sub_items_audience ON public.catalogue_sub_items;
CREATE TRIGGER trigger_catalogue_sub_items_audience
  BEFORE INSERT OR UPDATE OF item_id, is_public ON public.catalogue_sub_items
  FOR EACH ROW EXECUTE FUNCTION public.catalogue_sub_item_inherit_audience();

CREATE OR REPLACE FUNCTION public.catalogue_item_propagate_audience()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.catalogue_sub_items
     SET is_public = COALESCE(NEW.is_public, false)
   WHERE item_id = NEW.id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_catalogue_items_audience ON public.catalogue_items;
CREATE TRIGGER trigger_catalogue_items_audience
  AFTER UPDATE OF is_public ON public.catalogue_items
  FOR EACH ROW
  WHEN (OLD.is_public IS DISTINCT FROM NEW.is_public)
  EXECUTE FUNCTION public.catalogue_item_propagate_audience();

-- ---------------------------------------------------------------------------
-- 3. catalogue_sub_items: one policy set. Read = owner, or partner when shared.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own sub-items"   ON public.catalogue_sub_items;
DROP POLICY IF EXISTS "Users can insert own sub-items" ON public.catalogue_sub_items;
DROP POLICY IF EXISTS "Users can update own sub-items" ON public.catalogue_sub_items;
DROP POLICY IF EXISTS "Users can delete own sub-items" ON public.catalogue_sub_items;
DROP POLICY IF EXISTS catalogue_sub_items_select_policy ON public.catalogue_sub_items;
DROP POLICY IF EXISTS catalogue_sub_items_insert_policy ON public.catalogue_sub_items;
DROP POLICY IF EXISTS catalogue_sub_items_update_policy ON public.catalogue_sub_items;
DROP POLICY IF EXISTS catalogue_sub_items_delete_policy ON public.catalogue_sub_items;

CREATE POLICY catalogue_sub_items_select_policy ON public.catalogue_sub_items
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      is_public = true
      AND EXISTS (
        SELECT 1 FROM public.household_links hl
         WHERE hl.active = true
           AND (
             (hl.owner_user_id = auth.uid() AND hl.partner_user_id = catalogue_sub_items.user_id)
             OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = catalogue_sub_items.user_id)
           )
      )
    )
  );

CREATE POLICY catalogue_sub_items_insert_policy ON public.catalogue_sub_items
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY catalogue_sub_items_update_policy ON public.catalogue_sub_items
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY catalogue_sub_items_delete_policy ON public.catalogue_sub_items
  FOR DELETE USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. catalogue_items: drop the legacy duplicates. The surviving
--    catalogue_items_{select,insert,update,delete}_policy set is household_links-based.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Catalogue items visibility policy"    ON public.catalogue_items;
DROP POLICY IF EXISTS "Users can insert own catalogue items" ON public.catalogue_items;
DROP POLICY IF EXISTS "Users can update own catalogue items" ON public.catalogue_items;
DROP POLICY IF EXISTS "Users can delete own catalogue items" ON public.catalogue_items;

-- ---------------------------------------------------------------------------
-- 5. catalogue_modules: single delete policy that keeps the system-module guard.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can delete own non-system modules" ON public.catalogue_modules;
DROP POLICY IF EXISTS catalogue_modules_delete_policy ON public.catalogue_modules;
CREATE POLICY catalogue_modules_delete_policy ON public.catalogue_modules
  FOR DELETE USING (user_id = auth.uid() AND is_system = false);

COMMIT;

-- ---------------------------------------------------------------------------
-- 6. Verify.
-- ---------------------------------------------------------------------------
-- a) Exactly one policy per command per table (expect 4 rows each, 16 total):
-- select tablename, cmd, count(*) from pg_policies
--  where schemaname = 'public'
--    and tablename in ('catalogue_modules','catalogue_categories','catalogue_items','catalogue_sub_items')
--  group by 1, 2 order by 1, 2;
--
-- b) Every sub-item matches its parent (expect 0):
-- select count(*) from public.catalogue_sub_items si
--   join public.catalogue_items ci on ci.id = si.item_id
--  where si.is_public is distinct from coalesce(ci.is_public, false);
--
-- c) Both triggers present:
-- select tgname from pg_trigger
--  where tgname in ('trigger_catalogue_sub_items_audience','trigger_catalogue_items_audience')
--    and not tgisinternal;
--
-- d) Partner witness: on the partner's phone open a shared item that has a
--    checklist — the sub-items show. Flip the item to private — they vanish.
--
-- Then re-run migrations/db-state.sql and commit the new db-state.json
-- (pnpm db:verify-rls) so the snapshot is no longer stale.

-- ---------------------------------------------------------------------------
-- Optional, NOT run by default: existing items created before today are
-- is_public = false and cannot be told apart from deliberately private ones.
-- Share them all only if none were meant to stay private:
-- UPDATE public.catalogue_items SET is_public = true WHERE is_public IS NOT TRUE;
-- (the audience trigger carries sub-items along)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Rollback (sub-items go back to owner-only; legacy item policies are not restored):
-- ---------------------------------------------------------------------------
-- DROP TRIGGER IF EXISTS trigger_catalogue_items_audience ON public.catalogue_items;
-- DROP TRIGGER IF EXISTS trigger_catalogue_sub_items_audience ON public.catalogue_sub_items;
-- DROP FUNCTION IF EXISTS public.catalogue_item_propagate_audience();
-- DROP FUNCTION IF EXISTS public.catalogue_sub_item_inherit_audience();
-- DROP POLICY IF EXISTS catalogue_sub_items_select_policy ON public.catalogue_sub_items;
-- CREATE POLICY catalogue_sub_items_select_policy ON public.catalogue_sub_items
--   FOR SELECT USING (user_id = auth.uid());
-- ALTER TABLE public.catalogue_items ALTER COLUMN is_public SET DEFAULT false;
-- ALTER TABLE public.catalogue_sub_items DROP COLUMN IF EXISTS is_public;
