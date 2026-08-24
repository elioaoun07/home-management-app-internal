-- migrations/2026-08-24_repair-duplicates-and-phantom-fx.sql
-- DATA-ONLY repair · no schema change.
--
-- WHAT: remove 10 duplicate rows and 10 phantom own-account FX rows from
--       Debit Card - NEO, before the month-by-month re-import.
-- WHY:  duplicates must go FIRST — the re-import hands each surviving row a
--       fingerprint, and a duplicated pair would receive two valid-looking
--       fingerprints and become permanent. The FX rows are money that never
--       moved: own-account conversions written as real expenses.
--
-- ═══════════════════════════════════════════════════════════════════════════
--  READ THIS BEFORE RUNNING ANYTHING
-- ═══════════════════════════════════════════════════════════════════════════
--
--  DELETE THESE ROWS IN THE APP, NOT WITH SQL.
--
--  `account_balances.balance` is a STORED value maintained by
--  adjustAccountBalance() (money-rules Invariant 1). A SQL delete removes the
--  transaction but leaves the stored balance untouched, so Debit Card - NEO
--  would silently sit $50.89 too low forever. Deleting through the app routes
--  the change through the balance choke point and gives you an Undo toast on
--  every row.
--
--  So: run STEP 1 to get the list, run STEP 2 to snapshot it, then delete the
--  20 rows in the app, then run STEP 4 to verify.
--
--  Expected balance movement on Debit Card - NEO: **+$50.89**
--      duplicates   +42.08  (17.04 + 9.12 + 8 x 1.99)
--      phantom FX    +8.81
--  Both groups are expenses, so removing them RAISES the balance.
--
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 · INSPECT — the exact rows to delete. Expect 20.
--
-- `verdict` says which copy to remove. The rule for duplicates is KEEP THE
-- EARLIEST insert: it is the original import, and the later one is the
-- accidental re-import. The survivor gets a correct fingerprint on re-import,
-- so nothing is lost by dropping the newer copy.
-- ─────────────────────────────────────────────────────────────────────────────
WITH dupes AS (
  SELECT
    t.id,
    t.date,
    t.description,
    t.amount,
    t.inserted_at,
    row_number() OVER (
      PARTITION BY t.account_id, t.date, t.amount, t.description
      ORDER BY t.inserted_at, t.id
    ) AS copy_no
  FROM public.transactions t
  WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
    AND t.deleted_at IS NULL
    AND (t.account_id, t.date, t.amount, t.description) IN (
      SELECT t2.account_id, t2.date, t2.amount, t2.description
      FROM public.transactions t2
      WHERE t2.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
        AND t2.deleted_at IS NULL
      GROUP BY t2.account_id, t2.date, t2.amount, t2.description
      HAVING count(*) > 1
    )
)
SELECT 'duplicate' AS kind,
       'DELETE (copy ' || copy_no || ' of the pair)' AS verdict,
       date, description, amount, inserted_at, id
FROM dupes
WHERE copy_no > 1

UNION ALL

SELECT 'phantom_fx' AS kind,
       'DELETE (own-account move, never real spending)' AS verdict,
       t.date, t.description, t.amount, t.inserted_at, t.id
FROM public.transactions t
WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND t.deleted_at IS NULL
  AND (t.description ~* '\yown\s+account\y' OR t.description ~* '\yaccount\s+exchange\y')

ORDER BY kind, date;

-- Sanity total — should read 20 rows / 50.89.
WITH dupes AS (
  SELECT t.id, t.amount,
    row_number() OVER (
      PARTITION BY t.account_id, t.date, t.amount, t.description
      ORDER BY t.inserted_at, t.id
    ) AS copy_no
  FROM public.transactions t
  WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
    AND t.deleted_at IS NULL
    AND (t.account_id, t.date, t.amount, t.description) IN (
      SELECT t2.account_id, t2.date, t2.amount, t2.description
      FROM public.transactions t2
      WHERE t2.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
        AND t2.deleted_at IS NULL
      GROUP BY t2.account_id, t2.date, t2.amount, t2.description
      HAVING count(*) > 1
    )
)
SELECT count(*) AS rows_to_delete, sum(amount) AS total_amount
FROM (
  SELECT id, amount FROM dupes WHERE copy_no > 1
  UNION ALL
  SELECT t.id, t.amount FROM public.transactions t
  WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
    AND t.deleted_at IS NULL
    AND (t.description ~* '\yown\s+account\y' OR t.description ~* '\yaccount\s+exchange\y')
) x;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 · BACKUP — snapshot before touching anything. Safe to run; creates a
--          table, changes no existing row.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public._backup_tx_cleanup_20260824 AS
WITH dupes AS (
  SELECT t.*,
    row_number() OVER (
      PARTITION BY t.account_id, t.date, t.amount, t.description
      ORDER BY t.inserted_at, t.id
    ) AS copy_no
  FROM public.transactions t
  WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
    AND t.deleted_at IS NULL
    AND (t.account_id, t.date, t.amount, t.description) IN (
      SELECT t2.account_id, t2.date, t2.amount, t2.description
      FROM public.transactions t2
      WHERE t2.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
        AND t2.deleted_at IS NULL
      GROUP BY t2.account_id, t2.date, t2.amount, t2.description
      HAVING count(*) > 1
    )
)
SELECT id, user_id, account_id, date, amount, description, category_id,
       subcategory_id, is_debt_return, is_imported, statement_hash, inserted_at
FROM dupes WHERE copy_no > 1
UNION ALL
SELECT id, user_id, account_id, date, amount, description, category_id,
       subcategory_id, is_debt_return, is_imported, statement_hash, inserted_at
FROM public.transactions
WHERE user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND deleted_at IS NULL
  AND (description ~* '\yown\s+account\y' OR description ~* '\yaccount\s+exchange\y');

SELECT count(*) AS backed_up FROM public._backup_tx_cleanup_20260824;  -- expect 20


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 · DELETE — in the app, one row at a time, using STEP 1's list.
--
-- Not scripted here on purpose: see the balance note at the top. Each delete
-- reverses its own balance delta through adjustAccountBalance() and offers an
-- Undo toast; a SQL delete would do neither.
--
-- CHECK THIS ONE AGAINST YOUR STATEMENT FIRST:
--   2026-07-27 · "Bill Payment, Invoice # MAGIC11 - for 71189528 to Touch
--   Prepaid" · $17.04 · two copies, inserted 0.2s apart in one batch, and
--   BOTH carry a fingerprint.
-- The other nine pairs are one hashed + one hashless copy imported months
-- apart, which is unambiguously the v1 formula failing to dedupe. This one is
-- different: two hashes in one batch means the v1 hash (which included the
-- running balance) saw two genuinely different statement lines. It may be a
-- real double payment. Same invoice number twice on one day is unlikely — but
-- your statement is the authority, not this file.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4 · VERIFY — after deleting. Both queries must return 0 rows.
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. No duplicate groups left.
SELECT a.name AS account, t.date, t.amount, t.description, count(*) AS copies
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND t.deleted_at IS NULL
GROUP BY a.name, t.date, t.amount, t.description
HAVING count(*) > 1;

-- 4b. No own-account rows left.
SELECT count(*) AS phantom_fx_remaining
FROM public.transactions
WHERE user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND deleted_at IS NULL
  AND (description ~* '\yown\s+account\y' OR description ~* '\yaccount\s+exchange\y');

-- 4c. Confirm the balance moved by +50.89. Compare against what you noted
--     before starting; the app's balance card is the number that matters.
SELECT a.name, ab.balance, ab.updated_at
FROM public.account_balances ab
JOIN public.accounts a ON a.id = ab.account_id
WHERE a.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND a.name = 'Debit Card - NEO';


-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK
--
-- Deleting in the app is a SOFT delete, so the real undo is the Undo toast, or
-- Recycle Bin -> Restore (which re-applies the balance, fixed in BUD-23).
-- The backup table is the belt-and-braces copy of what those rows held.
--
-- Drop it only once the re-import is finished and verified:
--   DROP TABLE public._backup_tx_cleanup_20260824;
-- ─────────────────────────────────────────────────────────────────────────────
