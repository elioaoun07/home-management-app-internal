-- ==============================================
-- RLS Policies for account_balances table
-- Ensures users can manage their own balances
-- and household partners can view each other's balances
-- ==============================================

-- Enable RLS (idempotent - safe to run even if already enabled)
ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for clean re-apply)
DROP POLICY IF EXISTS "Users can view own balances" ON public.account_balances;
DROP POLICY IF EXISTS "Users can insert own balances" ON public.account_balances;
DROP POLICY IF EXISTS "Users can update own balances" ON public.account_balances;
DROP POLICY IF EXISTS "Household members can view balances" ON public.account_balances;

-- Users can view their own account balances
CREATE POLICY "Users can view own balances"
ON public.account_balances FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own account balances
CREATE POLICY "Users can insert own balances"
ON public.account_balances FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own account balances
CREATE POLICY "Users can update own balances"
ON public.account_balances FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Household partners can view each other's balances (read-only)
CREATE POLICY "Household members can view balances"
ON public.account_balances FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.household_links
    WHERE active = true
    AND (
      (owner_user_id = auth.uid() AND partner_user_id = user_id)
      OR (partner_user_id = auth.uid() AND owner_user_id = user_id)
    )
  )
);

-- Add helpful comments
COMMENT ON POLICY "Users can view own balances" ON public.account_balances IS 'Users can read their own account balance rows';
COMMENT ON POLICY "Users can insert own balances" ON public.account_balances IS 'Users can create balance rows for their own accounts';
COMMENT ON POLICY "Users can update own balances" ON public.account_balances IS 'Users can update balance rows for their own accounts';
COMMENT ON POLICY "Household members can view balances" ON public.account_balances IS 'Household partners can view each other account balances (read-only)';
