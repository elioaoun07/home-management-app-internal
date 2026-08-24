-- migrations/2026-08-24_statement-import-transfers.sql
--
-- WHAT: let a statement import create a household TRANSFER, and make that
--       write revertible like every other thing the importer does.
-- WHY:  "Transfer to RACHA SAMIR TOUMA via Mobile" is money moving between two
--       people in the same household. It nets to zero across the household, so
--       it must never be written as spending (money-rules Invariant 4). The
--       `transfers` table already models it — separate from `transactions`, so
--       it is excluded from every spending aggregate by construction rather
--       than by a flag someone can forget.
--
-- Two changes, both additive:
--   1. `statement_import_entries.action` accepts 'create_transfer'.
--   2. `statement_import_entries.transfer_id` records WHICH transfer, so the
--      batch revert can delete it and put both balances back. Without this the
--      import could move money on TWO users' accounts with no way back.
--
-- ⚠️ RUN BEFORE DEPLOYING. The commit route writes both; code-first fails the
--    ledger insert and returns 503.
--
-- Safe to re-run.

ALTER TABLE public.statement_import_entries
  ADD COLUMN IF NOT EXISTS transfer_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'statement_import_entries_transfer_fkey'
  ) THEN
    ALTER TABLE public.statement_import_entries
      ADD CONSTRAINT statement_import_entries_transfer_fkey
      FOREIGN KEY (transfer_id) REFERENCES public.transfers(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.statement_import_entries
  DROP CONSTRAINT IF EXISTS statement_import_entries_action_check;

ALTER TABLE public.statement_import_entries
  ADD CONSTRAINT statement_import_entries_action_check
  CHECK (action = ANY (ARRAY[
    'create'::text,
    'stamp'::text,
    'confirm_draft'::text,
    'rekey'::text,
    'create_transfer'::text
  ]));

-- VERIFY:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'statement_import_entries_action_check';   -- 5 values
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'statement_import_entries'
--      AND column_name = 'transfer_id';                          -- 1 row

-- ROLLBACK (only if no 'create_transfer' entries exist — check first):
--   SELECT count(*) FROM public.statement_import_entries WHERE action = 'create_transfer';
--   ALTER TABLE public.statement_import_entries
--     DROP CONSTRAINT statement_import_entries_action_check;
--   ALTER TABLE public.statement_import_entries
--     ADD CONSTRAINT statement_import_entries_action_check
--     CHECK (action = ANY (ARRAY['create'::text,'stamp'::text,'confirm_draft'::text,'rekey'::text]));
--   ALTER TABLE public.statement_import_entries DROP COLUMN transfer_id;
