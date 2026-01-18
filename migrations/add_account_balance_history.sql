-- Migration: Add account_balance_history table for comprehensive balance audit trail
-- This tracks every change to account balances with full context

-- Create the balance history table
CREATE TABLE IF NOT EXISTS public.account_balance_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  
  -- Balance values
  previous_balance numeric NOT NULL DEFAULT 0,
  new_balance numeric NOT NULL,
  change_amount numeric NOT NULL, -- Always: new_balance - previous_balance
  
  -- Change classification
  change_type text NOT NULL,
  
  -- Source entity references (nullable - depends on change_type)
  transaction_id uuid,           -- For transaction-related changes
  transfer_id uuid,              -- For transfer-related changes
  
  -- Manual update metadata
  reason text,                   -- User-provided reason (for manual changes)
  is_reconciliation boolean NOT NULL DEFAULT false,  -- Was this to fix a mismatch?
  
  -- Reconciliation details (only for manual updates)
  expected_balance numeric,      -- What system calculated balance should be
  discrepancy_amount numeric,    -- Difference: expected - actual (before fix)
  discrepancy_explanation text,  -- Why the mismatch occurred
  
  -- Timestamps
  effective_date date NOT NULL DEFAULT CURRENT_DATE,  -- When change is effective
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT account_balance_history_pkey PRIMARY KEY (id),
  CONSTRAINT abh_account_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  CONSTRAINT abh_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT abh_transaction_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL,
  CONSTRAINT abh_transfer_fkey FOREIGN KEY (transfer_id) REFERENCES public.transfers(id) ON DELETE SET NULL,
  CONSTRAINT abh_change_type_check CHECK (
    change_type IN (
      'initial_set', 'manual_set', 'manual_adjustment',
      'transfer_in', 'transfer_out',
      'transaction_expense', 'transaction_income', 'transaction_deleted',
      'split_bill_paid', 'split_bill_received',
      'draft_confirmed', 'correction'
    )
  )
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_abh_account_id ON public.account_balance_history(account_id);
CREATE INDEX IF NOT EXISTS idx_abh_user_id ON public.account_balance_history(user_id);
CREATE INDEX IF NOT EXISTS idx_abh_created_at ON public.account_balance_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abh_effective_date ON public.account_balance_history(effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_abh_change_type ON public.account_balance_history(change_type);
CREATE INDEX IF NOT EXISTS idx_abh_transaction_id ON public.account_balance_history(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_abh_transfer_id ON public.account_balance_history(transfer_id) WHERE transfer_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.account_balance_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Users can view their own balance history
CREATE POLICY "Users can view own balance history" ON public.account_balance_history
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own balance history
CREATE POLICY "Users can insert own balance history" ON public.account_balance_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Household members can view each other's balance history
CREATE POLICY "Household members can view balance history" ON public.account_balance_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.household_links hl
      WHERE hl.active = true
        AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = user_id)
          OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = user_id)
        )
    )
  );

-- Add comments
COMMENT ON TABLE public.account_balance_history IS 'Audit trail for all account balance changes';
COMMENT ON COLUMN public.account_balance_history.change_type IS 'Type of change: initial_set, manual_set, manual_adjustment, transfer_in, transfer_out, transaction_expense, transaction_income, transaction_deleted, split_bill_paid, split_bill_received, draft_confirmed, correction';
COMMENT ON COLUMN public.account_balance_history.previous_balance IS 'Balance before this change';
COMMENT ON COLUMN public.account_balance_history.new_balance IS 'Balance after this change';
COMMENT ON COLUMN public.account_balance_history.change_amount IS 'The delta: new_balance - previous_balance';
COMMENT ON COLUMN public.account_balance_history.is_reconciliation IS 'True if this change was made to fix a discrepancy between expected and actual balance';
COMMENT ON COLUMN public.account_balance_history.expected_balance IS 'For reconciliations: what the system calculated the balance should be';
COMMENT ON COLUMN public.account_balance_history.discrepancy_amount IS 'For reconciliations: the gap between expected and what user is setting';
