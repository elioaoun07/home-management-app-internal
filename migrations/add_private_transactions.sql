-- Migration: Add is_private column to transactions table
-- Purpose: Allow users to mark transactions as private within household sharing

-- Add is_private column to transactions
ALTER TABLE public.transactions 
ADD COLUMN is_private boolean NOT NULL DEFAULT false;

-- Add index for faster filtering of private transactions
CREATE INDEX idx_transactions_is_private ON public.transactions(is_private);

-- Add comment for documentation
COMMENT ON COLUMN public.transactions.is_private IS 'When true, transaction is hidden from household partner in dashboard views';
