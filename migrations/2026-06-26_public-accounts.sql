-- Public/shared accounts
--
-- Private accounts remain owner-only. Public accounts are visible to the
-- active household partner and can be used by both partners through API routes
-- that perform their own account-access checks.

ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_accounts_user_public_visible
ON public.accounts(user_id, is_public, visible);

CREATE INDEX IF NOT EXISTS idx_transactions_account_user_private
ON public.transactions(account_id, user_id, is_private)
WHERE deleted_at IS NULL;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Replace older account policies that allowed broad household read access.
DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'accounts'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.accounts',
      policy_record.policyname
    );
  END LOOP;
END $$;

CREATE POLICY accounts_select_own_or_public_household
ON public.accounts
FOR SELECT
USING (
  user_id = auth.uid()
  OR (
    is_public = true
    AND visible IS DISTINCT FROM false
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

CREATE POLICY accounts_insert_own
ON public.accounts
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY accounts_update_own
ON public.accounts
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY accounts_delete_own
ON public.accounts
FOR DELETE
USING (user_id = auth.uid());
