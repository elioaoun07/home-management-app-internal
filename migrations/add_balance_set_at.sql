-- Add balance_set_at column to track when balance was manually set
-- This allows us to calculate current balance from transactions after this timestamp

ALTER TABLE public.account_balances 
ADD COLUMN IF NOT EXISTS balance_set_at timestamp with time zone NOT NULL DEFAULT now();

-- Update existing records to use their updated_at as balance_set_at
UPDATE public.account_balances 
SET balance_set_at = updated_at 
WHERE balance_set_at IS NULL OR balance_set_at = now();

-- Add comment to explain the column
COMMENT ON COLUMN public.account_balances.balance_set_at IS 
'Timestamp when the balance was last manually set. Used to calculate current balance from transactions after this date.';
