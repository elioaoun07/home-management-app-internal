-- Adds a second, independent "default" flag for accounts: is_default_income.
--
-- is_default (existing) is a single app-wide flag shared across every account
-- type — it is what MobileExpenseForm/ExpenseForm/HubPage/watch views/etc use
-- as "the" default account for quick manual entry, and in practice it sits on
-- an expense account (the household's Wallet). Statement Import's
-- suggestAccountForRow() reused that same flag to guess where a received
-- person-to-person transfer should land when the statement's own account is
-- an expense account — but an expense-type default has nothing to do with
-- which INCOME account is the right one, so it fell through to "whichever
-- income account happens to be first in the list" (Drawer, not Salary).
--
-- is_default_income is scoped the same way (one true value per user, enforced
-- by a partial unique index + trigger mirroring the existing
-- ensure_single_default_account pattern) but is independent of is_default, so
-- setting a default income account never disturbs the existing default
-- expense/quick-entry account.

ALTER TABLE public.accounts
  ADD COLUMN is_default_income boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX idx_accounts_default_income_per_user
  ON public.accounts USING btree (user_id)
  WHERE (is_default_income = true);

CREATE OR REPLACE FUNCTION public.ensure_single_default_income_account()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If this account is being set as the default income account
  IF NEW.is_default_income = true THEN
    -- Unset all other default income accounts for this user
    UPDATE public.accounts
    SET is_default_income = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default_income = true;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_ensure_single_default_income_account
  BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW
  WHEN (NEW.is_default_income = true)
  EXECUTE FUNCTION public.ensure_single_default_income_account();
