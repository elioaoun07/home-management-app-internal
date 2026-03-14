-- Allow standalone debts (debts without a linked transaction)
-- This enables users to log "someone owes me $X" without creating a transaction

-- 1. Drop the NOT NULL constraint on transaction_id
ALTER TABLE public.debts ALTER COLUMN transaction_id DROP NOT NULL;

-- 2. Drop the existing foreign key and re-add with ON DELETE SET NULL for standalone debts
ALTER TABLE public.debts DROP CONSTRAINT IF EXISTS debts_transaction_id_fkey;
ALTER TABLE public.debts ADD CONSTRAINT debts_transaction_id_fkey 
  FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;

-- 3. Update RLS policy to also allow standalone debts (transaction_id IS NULL)
-- The existing policy should already work since it checks user_id, not transaction_id
