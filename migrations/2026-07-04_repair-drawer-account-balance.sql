-- migrations/2026-07-04_repair-drawer-account-balance.sql  (DATA-ONLY repair, no schema change)
-- WHAT: Reset the corrupted stored balance on the "Drawer" account and remove 6 orphan
--       test-only history rows.
-- WHY:  computeAccountBalance() (src/lib/balance.ts) double-counted transfer deltas when
--       called by the now-disabled auto-reconciliation route (POST /api/accounts/reconcile),
--       because it fell back to using the *current* stored balance as the anchor for
--       accounts with no genuine manual_set/initial_set checkpoint, then re-added the full
--       transfer total on top. Repeated app-loads compounded the drift, leaving
--       account_balances.balance = 398 for this account instead of the correct 3600
--       (= +2000 + 2000 - 400 from the 3 active, non-deleted transfers on this account).
--       That auto-reconciliation path has already been disabled in this session
--       (src/lib/balance.ts, src/app/api/accounts/reconcile/route.ts, src/contexts/SyncContext.tsx)
--       so this repair only needs to run once.
-- EXPECTED ROWS: 1 account_balances row corrected, 6 account_balance_history rows deleted.

-- ============================================================
-- PART 1 — Correct the stored balance
-- ============================================================

-- 1. INSPECT — confirm current (wrong) state before touching anything
SELECT account_id, balance, balance_set_at, updated_at
FROM public.account_balances
WHERE account_id = '7d2d34ac-c642-424f-af1b-329b47e453ea';
-- Expect: balance = 398

-- 2. BACKUP
CREATE TABLE IF NOT EXISTS public._backup_account_balances_20260704 AS
SELECT * FROM public.account_balances
WHERE account_id = '7d2d34ac-c642-424f-af1b-329b47e453ea';

-- 3. REPAIR — set balance to the value derivable from the account's own transfers
--    (anchor 0 + transfer_in 2000 + transfer_in 2000 - transfer_out 400 = 3600).
--    balance_set_at is left untouched (Invariant 3 — it is not a real reconciliation event).
UPDATE public.account_balances
SET balance = 3600,
    updated_at = now()
WHERE account_id = '7d2d34ac-c642-424f-af1b-329b47e453ea';

-- Audit trail entry documenting the correction (change_type 'correction' is whitelisted
-- by the abh_change_type_check constraint added in 2026-06-29_account-balance-history-change-types.sql).
INSERT INTO public.account_balance_history
  (account_id, user_id, previous_balance, new_balance, change_amount, change_type, reason, effective_date)
VALUES (
  '7d2d34ac-c642-424f-af1b-329b47e453ea',
  '1cb9c50a-2a41-4fb3-8e90-2e270ca28830',
  398,
  3600,
  3202,
  'correction',
  'Data repair 2026-07-04: reset drifted balance to match active transfers (auto-reconciliation double-counting bug, now disabled)',
  CURRENT_DATE
);

-- 4. VERIFY — must show balance = 3600
SELECT account_id, balance, balance_set_at, updated_at
FROM public.account_balances
WHERE account_id = '7d2d34ac-c642-424f-af1b-329b47e453ea';

-- 5. ROLLBACK (if needed):
--    UPDATE public.account_balances ab
--    SET balance = b.balance, updated_at = b.updated_at
--    FROM public._backup_account_balances_20260704 b
--    WHERE ab.account_id = b.account_id;
--    DELETE FROM public.account_balance_history
--    WHERE account_id = '7d2d34ac-c642-424f-af1b-329b47e453ea' AND change_type = 'correction'
--      AND reason LIKE 'Data repair 2026-07-04%';

-- ============================================================
-- PART 2 — Remove orphan test-only history rows
-- ============================================================
-- These 6 rows (from 2026-06-27 / 2026-06-29) have transfer_id IS NULL and are $1-$3
-- manual test increments with no corresponding row in public.transfers. They do not
-- affect balance calculation (computeAccountBalance only reads initial_set/manual_set/
-- manual_adjustment rows for the anchor, never transfer_in/out rows), so this is purely
-- an audit-trail cleanup for the Activity tab.

-- 1. INSPECT — confirm these are exactly the 6 expected rows
SELECT id, change_type, change_amount, previous_balance, new_balance, effective_date, created_at
FROM public.account_balance_history
WHERE id IN (
  '1eac84cf-08de-4b93-ae13-94ca2ffe4c67',
  'c90841de-518e-4241-b5f6-a24356b20fa9',
  '6c90832c-9606-40de-be3e-2ca05d2e5c4f',
  'a356b2f8-038b-4d03-97fd-6f3ef7c99cdf',
  '1c42a808-fa02-47d8-b4cc-82a544ec6692',
  'e9f5094e-c051-4044-9e42-bc118f2b812f'
);
-- Expect: 6 rows, all change_type transfer_in/transfer_out, transfer_id IS NULL, amounts 1-3

-- 2. BACKUP
CREATE TABLE IF NOT EXISTS public._backup_account_balance_history_20260704 AS
SELECT * FROM public.account_balance_history
WHERE id IN (
  '1eac84cf-08de-4b93-ae13-94ca2ffe4c67',
  'c90841de-518e-4241-b5f6-a24356b20fa9',
  '6c90832c-9606-40de-be3e-2ca05d2e5c4f',
  'a356b2f8-038b-4d03-97fd-6f3ef7c99cdf',
  '1c42a808-fa02-47d8-b4cc-82a544ec6692',
  'e9f5094e-c051-4044-9e42-bc118f2b812f'
);

-- 3. REPAIR — delete the orphan test rows (same WHERE as inspect, verbatim)
DELETE FROM public.account_balance_history
WHERE id IN (
  '1eac84cf-08de-4b93-ae13-94ca2ffe4c67',
  'c90841de-518e-4241-b5f6-a24356b20fa9',
  '6c90832c-9606-40de-be3e-2ca05d2e5c4f',
  'a356b2f8-038b-4d03-97fd-6f3ef7c99cdf',
  '1c42a808-fa02-47d8-b4cc-82a544ec6692',
  'e9f5094e-c051-4044-9e42-bc118f2b812f'
);

-- 4. VERIFY — must return 0 rows
SELECT count(*) FROM public.account_balance_history
WHERE id IN (
  '1eac84cf-08de-4b93-ae13-94ca2ffe4c67',
  'c90841de-518e-4241-b5f6-a24356b20fa9',
  '6c90832c-9606-40de-be3e-2ca05d2e5c4f',
  'a356b2f8-038b-4d03-97fd-6f3ef7c99cdf',
  '1c42a808-fa02-47d8-b4cc-82a544ec6692',
  'e9f5094e-c051-4044-9e42-bc118f2b812f'
);

-- 5. ROLLBACK (if needed):
--    INSERT INTO public.account_balance_history
--    SELECT * FROM public._backup_account_balance_history_20260704;

-- ============================================================
-- Drop backup tables only after confirming the fix looks correct in the app.
-- DROP TABLE public._backup_account_balances_20260704;
-- DROP TABLE public._backup_account_balance_history_20260704;
