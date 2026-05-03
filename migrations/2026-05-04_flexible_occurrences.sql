-- 2026-05-04 — Flexible "N times per period" routines
-- Adds support for catalogue items that should occur multiple times per
-- period (e.g. "workout 3 times per week"). Each occurrence gets its own
-- row in item_flexible_schedules, distinguished by occurrence_index.

-- 1) Catalogue: how many times per period for flexible routines (default 1)
ALTER TABLE public.catalogue_items
  ADD COLUMN IF NOT EXISTS flexible_occurrences integer NOT NULL DEFAULT 1
    CHECK (flexible_occurrences >= 1 AND flexible_occurrences <= 31);

-- 2) Schedules: distinguish multiple slots within the same period
ALTER TABLE public.item_flexible_schedules
  ADD COLUMN IF NOT EXISTS occurrence_index integer NOT NULL DEFAULT 0;

-- 3) Replace any existing UNIQUE(item_id, period_start_date) constraint with
--    one that includes occurrence_index. Use a guarded block so this is idempotent.
DO $$
DECLARE
  conname text;
BEGIN
  -- Drop the old single-slot uniqueness if present
  SELECT c.conname
    INTO conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
   WHERE t.relname = 'item_flexible_schedules'
     AND c.contype = 'u'
     AND pg_get_constraintdef(c.oid) ILIKE '%(item_id, period_start_date)%'
     AND pg_get_constraintdef(c.oid) NOT ILIKE '%occurrence_index%'
   LIMIT 1;

  IF conname IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.item_flexible_schedules DROP CONSTRAINT %I',
      conname
    );
  END IF;

  -- Add the new multi-slot uniqueness if not already present
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
     WHERE t.relname = 'item_flexible_schedules'
       AND c.contype = 'u'
       AND pg_get_constraintdef(c.oid) ILIKE '%(item_id, period_start_date, occurrence_index)%'
  ) THEN
    ALTER TABLE public.item_flexible_schedules
      ADD CONSTRAINT item_flexible_schedules_unique_slot
      UNIQUE (item_id, period_start_date, occurrence_index);
  END IF;
END $$;
