-- Migration: Add collaborator_account_id to transactions table
-- This allows us to track which account the collaborator used when paying their split bill portion

-- Add the column
ALTER TABLE public.transactions
ADD COLUMN collaborator_account_id uuid REFERENCES public.accounts(id);

-- Add comment
COMMENT ON COLUMN public.transactions.collaborator_account_id IS 'The account ID used by the collaborator when paying their portion of a split bill';
