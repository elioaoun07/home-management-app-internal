-- Migration: Add parent_transaction_id to transactions
-- Purpose: Link child transactions (debt settlements, recurring confirmations)
--          to their parent transaction so the dashboard stays clean.
-- Date: 2026-02-07

-- ============================================================
-- 1. Add parent_transaction_id column
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS parent_transaction_id uuid
    REFERENCES public.transactions(id) ON DELETE SET NULL;

-- Index for fast child lookup
CREATE INDEX IF NOT EXISTS idx_transactions_parent
  ON public.transactions (parent_transaction_id)
  WHERE parent_transaction_id IS NOT NULL;

-- ============================================================
-- 2. Retroactively link existing debt-return transactions
--    to their parent (the original debt transaction).
--    A debt-return's account_id + category_id + user_id should
--    match the debt's original transaction.
-- ============================================================
UPDATE public.transactions t
SET parent_transaction_id = d.transaction_id
FROM public.debts d
JOIN public.transactions parent_tx ON parent_tx.id = d.transaction_id
WHERE t.is_debt_return = true
  AND t.parent_transaction_id IS NULL
  AND t.user_id = d.user_id
  AND t.account_id = parent_tx.account_id
  AND t.description LIKE '%Debt return from ' || d.debtor_name || '%';
