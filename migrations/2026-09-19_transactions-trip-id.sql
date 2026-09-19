-- migrations/2026-09-19_transactions-trip-id.sql
--
-- WHAT: 1. transactions.trip_id — optional, nullable FK to trips(id).
--       2. Partial index for "all transactions tagged with trip X" lookups.
-- WHY:  A trip's spend is not confined to its linked account. Pre-trip costs
--       (visa fees, flights) are paid from a different account — often a
--       different currency — and must still count toward the trip. Tagging the
--       transaction decouples "belongs to this trip" from "sits in this account".
-- RUN:  manually in Supabase SQL Editor. Safe to re-run (idempotent guards below).
--
-- NOTES:
--   * NULL is the only value existing rows get — no backfill, nothing moves.
--   * ON DELETE SET NULL is deliberate: DELETE /api/trips/[id] hard-deletes the
--     trip row, and a money row must never disappear (or block the delete)
--     because of a tag. Untagging on trip delete is the only safe behavior.
--   * No RLS change needed. transactions RLS is row-level on user_id /
--     household_links (verified in migrations/db-state.json, generated
--     2026-08-04) — a new column inherits the existing policies unchanged.

-- 1. The column
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS trip_id uuid;

-- 2. The foreign key (guarded — ADD CONSTRAINT has no IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transactions_trip_id_fkey'
      AND conrelid = 'public.transactions'::regclass
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_trip_id_fkey
      FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Trip-expense lookup index.
--    Partial: only a small minority of transactions are ever trip-tagged, so the
--    index stays tiny and the untagged write path pays nothing.
CREATE INDEX IF NOT EXISTS idx_transactions_trip_id
  ON public.transactions (trip_id)
  WHERE trip_id IS NOT NULL;

-- 4. Verification (run after; expect 1 column row, 1 FK row, 1 index row,
--    and a trip-tagged count of 0 on a fresh apply).
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'trip_id';
-- SELECT conname, confdeltype FROM pg_constraint          -- confdeltype 'n' = SET NULL
--  WHERE conname = 'transactions_trip_id_fkey';
-- SELECT indexname FROM pg_indexes
--  WHERE schemaname = 'public' AND indexname = 'idx_transactions_trip_id';
-- SELECT count(*) AS tagged FROM public.transactions WHERE trip_id IS NOT NULL;
