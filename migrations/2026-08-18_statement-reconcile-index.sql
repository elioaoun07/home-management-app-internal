-- migrations/2026-08-18_statement-reconcile-index.sql
--
-- WHAT: Index supporting the statement reconciliation candidate query:
--         WHERE account_id = ? AND deleted_at IS NULL
--           AND date BETWEEN (min posting date − 7) AND (max posting date + 1)
-- WHY:  BUD-19 — statement upload now matches each parsed row against already
--       logged transactions (posting dates lag real dates by 1–3+ days, so the
--       lookup is a date RANGE, not equality). No (account_id, date) index
--       exists today: only statement_hash and is_imported are indexed, so this
--       query would seq-scan the whole transactions table on every upload.
-- NOTE: equality column first, range column second, so one contiguous index
--       scan serves the whole window. Partial on deleted_at IS NULL because
--       every reconciliation query filters it and soft-deleted rows must never
--       be matched.
-- RUN:  manually in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS idx_transactions_account_date
  ON public.transactions (account_id, date)
  WHERE deleted_at IS NULL;
