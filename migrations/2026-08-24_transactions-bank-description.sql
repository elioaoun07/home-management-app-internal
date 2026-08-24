-- migrations/2026-08-24_transactions-bank-description.sql
--
-- WHAT: add `transactions.bank_description` — the statement line exactly as the
--       bank wrote it, kept alongside the human `description`.
-- WHY:  `description` is the owner's wording and drifts ("Spinneys" one month,
--       "Supermarket Spinneys" the next), which makes it a poor grouping key
--       for reporting. The bank's text is machine-generated and stable, so it
--       is the reliable axis to group and compare on.
--
--       It CANNOT be recovered from `statement_hash`: SHA-256 is one-way, and
--       the description is free text, so there is nothing to reverse. Storing
--       it is the only way to have it.
--
-- ⚠️ RUN THIS BEFORE DEPLOYING THE MATCHING CODE. The commit route writes this
--    column; if the code ships first, every statement import fails on an
--    unknown column. Migration first, deploy second.
--
-- Safe to re-run. Additive and nullable — no existing row changes, no rewrite.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS bank_description text;

COMMENT ON COLUMN public.transactions.bank_description IS
  'Raw statement line as the bank wrote it. Set by statement import (create, stamp and rekey); NULL for manually entered transactions. Stable across imports, so it is the grouping key for reporting — unlike `description`, which is the user''s own wording.';

-- Grouping/filtering by bank descriptor is the whole point, so index the shape
-- reporting will actually query: this user's fingerprinted rows.
CREATE INDEX IF NOT EXISTS idx_transactions_bank_description
  ON public.transactions (user_id, bank_description)
  WHERE bank_description IS NOT NULL;

-- VERIFY — expect one row, data_type text, is_nullable YES:
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='transactions'
    AND column_name='bank_description';
--
-- Backfill happens on its own: re-importing a statement writes the bank text
-- onto every row it stamps or re-keys, so the month-by-month pass fills this in
-- for the history as a side effect. Nothing to run by hand.

-- ROLLBACK:
--   DROP INDEX IF EXISTS public.idx_transactions_bank_description;
--   ALTER TABLE public.transactions DROP COLUMN IF EXISTS bank_description;
