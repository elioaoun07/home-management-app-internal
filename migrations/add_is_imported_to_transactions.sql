-- Migration: Add is_imported flag to transactions
-- This distinguishes between manually created transactions and those imported from bank statements
-- Default is false (manual), set to true when using statement import feature

-- Add the is_imported column
ALTER TABLE public.transactions
ADD COLUMN is_imported boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.transactions.is_imported IS 'Whether this transaction was imported from a bank statement (true) or manually created (false)';

-- Create an index for potential filtering by import status
CREATE INDEX idx_transactions_is_imported ON public.transactions(is_imported);
