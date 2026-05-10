-- 2026-05-12 — Add UNIQUE (rule_id, exdate) to item_recurrence_exceptions
--
-- Why:
--   Application code treats a recurrence exception as keyed by
--   (rule_id, exdate). Without a unique constraint we cannot use
--   PostgREST `.upsert(..., { onConflict: "rule_id,exdate" })`, and we are
--   also exposed to duplicate-row drift if two clients write at the same
--   moment.
--
-- Safety:
--   1. Pre-cleans any existing duplicates (keeps the most-recent row,
--      merges by `created_at DESC`). On a fresh database this is a no-op.
--   2. Adds the constraint. Idempotent via `IF NOT EXISTS`.
--
-- Note: the application also tolerates the absence of this constraint
-- (it does a manual select-then-update/insert), so this migration is a
-- consistency hardening, not a hard requirement.

BEGIN;

-- 1. Resolve any existing duplicates.
WITH ranked AS (
  SELECT
    id,
    rule_id,
    exdate,
    row_number() OVER (
      PARTITION BY rule_id, exdate
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.item_recurrence_exceptions
)
DELETE FROM public.item_recurrence_exceptions x
USING ranked r
WHERE x.id = r.id
  AND r.rn > 1;

-- 2. Add the unique constraint (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'item_recurrence_exceptions_rule_id_exdate_key'
      AND conrelid = 'public.item_recurrence_exceptions'::regclass
  ) THEN
    ALTER TABLE public.item_recurrence_exceptions
      ADD CONSTRAINT item_recurrence_exceptions_rule_id_exdate_key
      UNIQUE (rule_id, exdate);
  END IF;
END$$;

COMMIT;
