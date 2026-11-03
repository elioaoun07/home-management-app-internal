-- migrations/2026-11-03_balance-history-change-types.sql
--
-- WHAT: Widen account_balance_history's change_type CHECK so it accepts every
--       value the app writes. The new allowed set is the union of:
--         (a) what the live constraint(s) already allow, parsed from their definition
--         (b) every change_type already stored in the table
--         (c) every value the app writes (list below)
--       so no existing row or currently-working insert can start failing.
-- WHY:  BUD-88. The live constraint `abh_change_type_check` rejects
--       'transfer_deleted' (error_logs 2026-10-28 17:15:48 and 17:15:50, SQLSTATE
--       23514, transfer a9dcf212-…). adjustAccountBalance moves the balance first
--       and writes history second, so balances were right but the history rows were
--       dropped for: transfer edits/deletes, transaction edits/moves, split deletes,
--       statement-import reverts and recycle-bin restores.
-- RUN:  manually in the Supabase SQL Editor. Safe to re-run. No data is changed;
--       only the CHECK definition. Brief ACCESS EXCLUSIVE lock on
--       account_balance_history while the new constraint validates.
-- NOTE: Past dropped history rows are NOT recreated here. That would be a separate
--       data-repair runbook (they can be rebuilt from error_logs' failing-row details).

BEGIN;

DO $$
DECLARE
  con record;
  allowed text[] := ARRAY[
    -- (c) values written by src/ (adjustAccountBalance callers + balance POST)
    'initial_set', 'manual_set', 'manual_adjustment',
    'transfer_in', 'transfer_out', 'transfer_updated', 'transfer_deleted', 'transfer',
    'transaction', 'transaction_expense', 'transaction_income',
    'transaction_updated', 'transaction_moved', 'transaction_deleted', 'transaction_restored',
    'split_bill', 'split_bill_paid', 'split_bill_received', 'split_deleted',
    'draft_confirmed', 'future_payment', 'debt_settled',
    'statement_import', 'statement_import_revert',
    'correction', 'auto_reconciliation'
  ];
BEGIN
  -- (a) + drop: every CHECK on this table that constrains change_type
  -- (the live one is abh_change_type_check; an older inline one may also exist)
  FOR con IN
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'public.account_balance_history'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%change_type%'
  LOOP
    allowed := allowed || ARRAY(
      SELECT m[1] FROM regexp_matches(con.def, '''([A-Za-z0-9_]+)''', 'g') AS m
    );
    EXECUTE format(
      'ALTER TABLE public.account_balance_history DROP CONSTRAINT %I',
      con.conname
    );
  END LOOP;

  -- (b) values already stored
  allowed := allowed || ARRAY(
    SELECT DISTINCT change_type FROM public.account_balance_history
  );

  SELECT array_agg(DISTINCT v ORDER BY v) INTO allowed
  FROM unnest(allowed) AS v
  WHERE v IS NOT NULL;

  EXECUTE format(
    'ALTER TABLE public.account_balance_history
       ADD CONSTRAINT abh_change_type_check CHECK (change_type = ANY (%L::text[]))',
    allowed
  );
END $$;

COMMIT;

-- VERIFY (expect exactly one row, and its list includes transfer_deleted,
-- transfer_updated, transaction_moved, split_deleted, statement_import_revert):
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.account_balance_history'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%change_type%';
