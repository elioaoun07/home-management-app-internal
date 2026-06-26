-- Fix: accounts SELECT policy from 2026-06-26_public-accounts.sql was too
-- restrictive. It blocked household partners from reading any account where
-- is_public = false, which hid the partner's data from the dashboard entirely.
--
-- The is_public flag's job is to control which accounts appear in the
-- EXPENSE-FORM account picker (so partners can log transactions on your behalf).
-- It is not a view-level privacy flag — household partners share a financial
-- household and should be able to see each other's accounts on the dashboard.
-- Transaction-level privacy is handled by the is_private flag per transaction.
--
-- Fix: remove is_public = true from the SELECT policy so all visible partner
-- accounts are readable. The expense-form account picker continues to filter
-- by is_public at the application layer (/api/accounts without ?household=true).

DROP POLICY IF EXISTS accounts_select_own_or_public_household ON public.accounts;

CREATE POLICY accounts_select_own_or_household
ON public.accounts
FOR SELECT
USING (
  user_id = auth.uid()
  OR (
    visible IS DISTINCT FROM false
    AND EXISTS (
      SELECT 1
        FROM public.household_links hl
       WHERE hl.active = true
         AND (
           (hl.owner_user_id = auth.uid() AND hl.partner_user_id = accounts.user_id)
           OR
           (hl.partner_user_id = auth.uid() AND hl.owner_user_id = accounts.user_id)
         )
    )
  )
);
