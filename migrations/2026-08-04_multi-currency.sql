-- WHAT: Multi-currency accounts + frozen per-transaction exchange rates + conversion transfers.
--       (1) accounts.currency + accounts.exchange_rate (current USD value of 1 unit of the account's currency)
--       (2) transactions.exchange_rate, stamped automatically from the account at insert/account-move time
--       (3) transfers.to_amount + transfers.exchange_rate, for cross-currency transfers (e.g. USD wallet -> EUR trip cash)
-- WHY:  Trip - Italy needs a EUR account. Historical dashboard totals must stay frozen at the rate that was
--       in effect when each transaction was logged, even if the account's rate is edited later.
-- RUN:  Manually in the Supabase SQL Editor. Idempotent (safe to re-run).

-- ============================================================
-- 1. accounts: currency + current rate
-- ============================================================
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS exchange_rate numeric NOT NULL DEFAULT 1 CHECK (exchange_rate > 0);

-- ============================================================
-- 2. transactions: frozen rate at time of logging
--    NULL on pre-migration rows = treated as 1 (USD) by application code.
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS exchange_rate numeric CHECK (exchange_rate > 0);

-- Stamping trigger. SECURITY DEFINER + pinned search_path: `accounts` has RLS enabled
-- and transaction inserts run as the authenticated user, so the account lookup must
-- run with definer rights to be unconditional regardless of account visibility policy.
-- Fires BEFORE INSERT (stamp once, only if not already provided) and BEFORE UPDATE OF
-- account_id (re-stamp when a transaction is moved to a different-currency account,
-- e.g. bulk-reassign or draft confirm).
CREATE OR REPLACE FUNCTION public.stamp_transaction_exchange_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.exchange_rate IS NULL THEN
      SELECT a.exchange_rate INTO NEW.exchange_rate
        FROM public.accounts a
       WHERE a.id = NEW.account_id;
    END IF;
  ELSIF NEW.account_id IS DISTINCT FROM OLD.account_id THEN
    SELECT a.exchange_rate INTO NEW.exchange_rate
      FROM public.accounts a
     WHERE a.id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_tx_exchange_rate ON public.transactions;
CREATE TRIGGER trg_stamp_tx_exchange_rate
  BEFORE INSERT OR UPDATE OF account_id ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_transaction_exchange_rate();

-- ============================================================
-- 3. transfers: cross-currency conversion support
--    NULL to_amount/exchange_rate = legacy symmetric transfer (same currency both sides).
-- ============================================================
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS to_amount numeric CHECK (to_amount > 0),
  ADD COLUMN IF NOT EXISTS exchange_rate numeric CHECK (exchange_rate > 0);

-- ============================================================
-- 4. OPTIONAL BACKFILL — run manually, only after setting an account's
--    currency/rate, to stamp its pre-existing transactions with that rate.
--    Left commented out; the owner decides if/when to run it per account.
-- ============================================================
-- UPDATE public.transactions t
--    SET exchange_rate = a.exchange_rate
--   FROM public.accounts a
--  WHERE a.id = t.account_id
--    AND t.exchange_rate IS NULL
--    AND a.currency <> 'USD';
