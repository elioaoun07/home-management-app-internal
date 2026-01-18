-- Migration: Add "saving" account type
-- Saving accounts are shared across household members (both can read/write)
-- They behave like income accounts (positive = positive balance)

-- ==============================================
-- 1. Update the accounts table type constraint
-- ==============================================

-- Drop the existing constraint
ALTER TABLE public.accounts 
DROP CONSTRAINT IF EXISTS accounts_type_check;

-- Add the new constraint with "saving" type
ALTER TABLE public.accounts
ADD CONSTRAINT accounts_type_check 
CHECK (type = ANY (ARRAY['income'::text, 'expense'::text, 'saving'::text]));

-- ==============================================
-- 2. Add RLS policies for saving accounts (household shared)
-- ==============================================

-- Drop existing saving-specific policies if they exist
DROP POLICY IF EXISTS "Household members can view saving accounts" ON public.accounts;
DROP POLICY IF EXISTS "Household members can update saving accounts" ON public.accounts;
DROP POLICY IF EXISTS "Household members can insert saving accounts" ON public.accounts;

-- Policy: Household members can view each other's saving accounts
CREATE POLICY "Household members can view saving accounts"
ON public.accounts FOR SELECT
USING (
  type = 'saving' AND EXISTS (
    SELECT 1 FROM public.household_links
    WHERE active = true
    AND (
      (owner_user_id = auth.uid() AND partner_user_id = user_id)
      OR (partner_user_id = auth.uid() AND owner_user_id = user_id)
    )
  )
);

-- Policy: Household members can update each other's saving accounts
CREATE POLICY "Household members can update saving accounts"
ON public.accounts FOR UPDATE
USING (
  type = 'saving' AND (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.household_links
      WHERE active = true
      AND (
        (owner_user_id = auth.uid() AND partner_user_id = user_id)
        OR (partner_user_id = auth.uid() AND owner_user_id = user_id)
      )
    )
  )
)
WITH CHECK (
  type = 'saving' AND (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.household_links
      WHERE active = true
      AND (
        (owner_user_id = auth.uid() AND partner_user_id = user_id)
        OR (partner_user_id = auth.uid() AND owner_user_id = user_id)
      )
    )
  )
);

-- ==============================================
-- 3. Add RLS policies for saving account balances
-- ==============================================

-- Drop existing saving-specific balance policies if they exist
DROP POLICY IF EXISTS "Household members can view saving account balances" ON public.account_balances;
DROP POLICY IF EXISTS "Household members can update saving account balances" ON public.account_balances;

-- Policy: Household members can view saving account balances
CREATE POLICY "Household members can view saving account balances"
ON public.account_balances FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.accounts a
    JOIN public.household_links hl ON hl.active = true
    WHERE a.id = account_id
      AND a.type = 'saving'
      AND (
        (hl.owner_user_id = auth.uid() AND hl.partner_user_id = a.user_id)
        OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = a.user_id)
      )
  )
);

-- Policy: Household members can update saving account balances
CREATE POLICY "Household members can update saving account balances"
ON public.account_balances FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = account_id
      AND a.type = 'saving'
      AND (
        a.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.household_links hl
          WHERE hl.active = true
          AND (
            (hl.owner_user_id = auth.uid() AND hl.partner_user_id = a.user_id)
            OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = a.user_id)
          )
        )
      )
  )
);

-- Policy: Household members can insert saving account balances
CREATE POLICY "Household members can insert saving account balances"
ON public.account_balances FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = account_id
      AND a.type = 'saving'
      AND (
        a.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.household_links hl
          WHERE hl.active = true
          AND (
            (hl.owner_user_id = auth.uid() AND hl.partner_user_id = a.user_id)
            OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = a.user_id)
          )
        )
      )
  )
);

-- ==============================================
-- 4. Add RLS policies for saving account balance history
-- ==============================================

-- Drop existing saving-specific history policies if they exist
DROP POLICY IF EXISTS "Household members can view saving balance history" ON public.account_balance_history;
DROP POLICY IF EXISTS "Household members can insert saving balance history" ON public.account_balance_history;

-- Policy: Household members can view saving account balance history
CREATE POLICY "Household members can view saving balance history"
ON public.account_balance_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.accounts a
    JOIN public.household_links hl ON hl.active = true
    WHERE a.id = account_id
      AND a.type = 'saving'
      AND (
        (hl.owner_user_id = auth.uid() AND hl.partner_user_id = a.user_id)
        OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = a.user_id)
      )
  )
);

-- Policy: Household members can insert saving account balance history
CREATE POLICY "Household members can insert saving balance history"
ON public.account_balance_history FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = account_id
      AND a.type = 'saving'
      AND (
        a.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.household_links hl
          WHERE hl.active = true
          AND (
            (hl.owner_user_id = auth.uid() AND hl.partner_user_id = a.user_id)
            OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = a.user_id)
          )
        )
      )
  )
);

-- ==============================================
-- 5. Add comments
-- ==============================================

COMMENT ON CONSTRAINT accounts_type_check ON public.accounts IS 'Account types: income (salary, etc.), expense (wallet, credit card), saving (shared savings goals)';
