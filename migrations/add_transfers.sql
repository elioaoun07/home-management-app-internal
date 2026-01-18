-- Migration: Add transfers table for internal account transfers
-- This enables moving money between accounts (e.g., Salary → Savings, Salary → Wallet)

-- Create transfers table
CREATE TABLE IF NOT EXISTS public.transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  from_account_id uuid NOT NULL,
  to_account_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  description text DEFAULT ''::text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT transfers_pkey PRIMARY KEY (id),
  CONSTRAINT transfers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT transfers_from_account_id_fkey FOREIGN KEY (from_account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  CONSTRAINT transfers_to_account_id_fkey FOREIGN KEY (to_account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  CONSTRAINT transfers_different_accounts CHECK (from_account_id <> to_account_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON public.transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from_account ON public.transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_account ON public.transfers(to_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_date ON public.transfers(date);

-- Enable RLS
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- RLS policies for transfers
-- Users can only see their own transfers
CREATE POLICY "Users can view own transfers" ON public.transfers
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own transfers
CREATE POLICY "Users can insert own transfers" ON public.transfers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own transfers
CREATE POLICY "Users can update own transfers" ON public.transfers
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own transfers
CREATE POLICY "Users can delete own transfers" ON public.transfers
  FOR DELETE USING (auth.uid() = user_id);

-- Household members can view each other's transfers
CREATE POLICY "Household members can view transfers" ON public.transfers
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

-- Add comment
COMMENT ON TABLE public.transfers IS 'Internal transfers between user accounts (e.g., Income to Wallet, Salary to Savings)';
COMMENT ON COLUMN public.transfers.from_account_id IS 'Source account - balance will be reduced';
COMMENT ON COLUMN public.transfers.to_account_id IS 'Destination account - balance will be increased';
COMMENT ON COLUMN public.transfers.amount IS 'Transfer amount (always positive)';
