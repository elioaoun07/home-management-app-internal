-- Migration: Debt Payment & Future Payment features
-- Date: 2026-02-07

-- ============================================================
-- 1. Add scheduled_date and is_debt_return to transactions
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS is_debt_return boolean NOT NULL DEFAULT false;

-- Index for efficient future payment queries
CREATE INDEX IF NOT EXISTS idx_transactions_scheduled_date
  ON public.transactions (account_id, user_id)
  WHERE is_draft = true AND scheduled_date IS NOT NULL;

-- Index for debt return filtering
CREATE INDEX IF NOT EXISTS idx_transactions_debt_return
  ON public.transactions (account_id, user_id)
  WHERE is_debt_return = true;

-- ============================================================
-- 2. Create debts table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.debts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  debtor_name text NOT NULL,
  original_amount numeric NOT NULL CHECK (original_amount > 0),
  returned_amount numeric NOT NULL DEFAULT 0 CHECK (returned_amount >= 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'archived', 'closed')),
  notes text,
  archived_at timestamp with time zone,
  closed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT debts_pkey PRIMARY KEY (id),
  CONSTRAINT debts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT debts_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE,
  CONSTRAINT debts_returned_lte_original CHECK (returned_amount <= original_amount)
);

-- Indexes for debts
CREATE INDEX IF NOT EXISTS idx_debts_user_status ON public.debts (user_id, status);
CREATE INDEX IF NOT EXISTS idx_debts_transaction ON public.debts (transaction_id);
CREATE INDEX IF NOT EXISTS idx_debts_auto_archive ON public.debts (user_id, status, created_at)
  WHERE status = 'open';

-- ============================================================
-- 3. Extend balance_change_type CHECK constraint
-- ============================================================
-- Drop and recreate the CHECK constraint to add new types
ALTER TABLE public.account_balance_history
  DROP CONSTRAINT IF EXISTS account_balance_history_change_type_check;

ALTER TABLE public.account_balance_history
  ADD CONSTRAINT account_balance_history_change_type_check
  CHECK (change_type = ANY (ARRAY[
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
    'debt_settled'::text
  ]));

-- ============================================================
-- 4. RLS policies for debts table
-- ============================================================
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- Users can see their own debts
CREATE POLICY debts_select_own ON public.debts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can see household partner's debts (if the linked transaction is not private)
CREATE POLICY debts_select_partner ON public.debts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.household_links hl
      WHERE hl.active = true
        AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = debts.user_id)
          OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = debts.user_id)
        )
    )
    AND EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = debts.transaction_id
        AND t.is_private = false
    )
  );

-- Users can insert their own debts
CREATE POLICY debts_insert_own ON public.debts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own debts
CREATE POLICY debts_update_own ON public.debts
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own debts
CREATE POLICY debts_delete_own ON public.debts
  FOR DELETE USING (auth.uid() = user_id);
