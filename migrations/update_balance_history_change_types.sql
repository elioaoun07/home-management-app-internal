-- Migration: Allow new change_type values for direct delta-based balance updates
-- The adjustAccountBalance() function uses these new types when logging to history.
-- Without this, balance history inserts fail the CHECK constraint (silently, best-effort).

-- Drop the old constraint and recreate with all values
ALTER TABLE public.account_balance_history
  DROP CONSTRAINT IF EXISTS account_balance_history_change_type_check;

ALTER TABLE public.account_balance_history
  ADD CONSTRAINT account_balance_history_change_type_check
  CHECK (change_type = ANY (ARRAY[
    -- Original values
    'initial_set'::text,
    'manual_set'::text,
    'manual_adjustment'::text,
    'transfer_in'::text,
    'transfer_out'::text,
    'transaction_expense'::text,
    'transaction_income'::text,
    'transaction_deleted'::text,
    'split_bill_paid'::text,
    'split_bill_received'::text,
    'draft_confirmed'::text,
    'correction'::text,
    -- New delta-based values
    'transaction'::text,
    'transfer'::text,
    'split_bill'::text,
    'future_payment'::text,
    'debt_settled'::text,
    'auto_reconciliation'::text
  ]));

COMMENT ON COLUMN public.account_balance_history.change_type IS
  'Type of change: initial_set, manual_set, manual_adjustment, transfer_in, transfer_out, '
  'transaction_expense, transaction_income, transaction_deleted, split_bill_paid, split_bill_received, '
  'draft_confirmed, correction, transaction, transfer, split_bill, future_payment, debt_settled, auto_reconciliation';
