-- Create account_balances table to track account balance snapshots
CREATE TABLE IF NOT EXISTS public.account_balances (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT account_balances_pkey PRIMARY KEY (id),
  CONSTRAINT account_balances_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  CONSTRAINT account_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Ensure only one balance record per account
  CONSTRAINT account_balances_account_id_unique UNIQUE (account_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_account_balances_account_id ON public.account_balances(account_id);
CREATE INDEX IF NOT EXISTS idx_account_balances_user_id ON public.account_balances(user_id);

-- Enable Row Level Security
ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own account balances"
  ON public.account_balances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own account balances"
  ON public.account_balances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own account balances"
  ON public.account_balances FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own account balances"
  ON public.account_balances FOR DELETE
  USING (auth.uid() = user_id);
