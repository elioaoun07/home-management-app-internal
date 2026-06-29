-- Allow balance-history audit rows emitted by transfer lifecycle and statement import flows.
-- Run this manually in Supabase SQL Editor before deploying code that relies on these values.

ALTER TABLE public.account_balance_history
  DROP CONSTRAINT IF EXISTS abh_change_type_check;

ALTER TABLE public.account_balance_history
  DROP CONSTRAINT IF EXISTS account_balance_history_change_type_check;

ALTER TABLE public.account_balance_history
  ADD CONSTRAINT abh_change_type_check
  CHECK (
    change_type = ANY (
      ARRAY[
        'initial_set'::text,
        'manual_set'::text,
        'manual_adjustment'::text,
        'transfer_in'::text,
        'transfer_out'::text,
        'transfer_updated'::text,
        'transfer_deleted'::text,
        'transaction_expense'::text,
        'transaction_income'::text,
        'transaction_deleted'::text,
        'split_bill_paid'::text,
        'split_bill_received'::text,
        'draft_confirmed'::text,
        'correction'::text,
        'transaction'::text,
        'transfer'::text,
        'split_bill'::text,
        'future_payment'::text,
        'debt_settled'::text,
        'statement_import'::text,
        'auto_reconciliation'::text
      ]
    )
  );
