-- migrations/2026-08-24_repair-delete-duplicates.sql
-- DATA-ONLY repair · no schema change.
--
-- WHAT: soft-delete the 10 duplicate COPIES in Debit Card - NEO, keeping the
--       earliest insert of each group.
-- WHY:  duplicates must go before the month-by-month re-import. The re-import
--       gives each surviving row a v2 fingerprint; a duplicated pair would
--       receive occurrence #1 and #2 — two valid-looking fingerprints — and the
--       duplication would become permanent and undetectable.
-- EXPECTED ROWS: 10 (17.04 + 9.12 + 8 x 1.99 = $42.08)
--
-- FX ROWS ARE NOT TOUCHED HERE. They are a separate decision — see the note at
-- the bottom of this file.
--
-- ── BALANCE ─────────────────────────────────────────────────────────────────
-- This deletes rows in SQL, so `account_balances.balance` is NOT updated.
-- Debit Card - NEO will read **$42.08 too LOW** until corrected (these are
-- expenses; removing them should raise the balance). You have accepted that
-- drift for now. Fix it at the end via the app's reconciliation flow:
--   Balance card -> "Doesn't match — correct it" -> enter the real bank balance.
-- That is the sanctioned path (money-rules Invariant 3): it stamps
-- `balance_set_at` and writes an `account_balance_history` audit row. Do NOT
-- UPDATE `account_balances` by hand.
--
-- Soft delete, not hard: rows land in the Recycle Bin, and Restore re-applies
-- the balance correctly (fixed in BUD-23).
-- ────────────────────────────────────────────────────────────────────────────

-- The 10 copies, computed once and reused verbatim by every step below.
-- Rule: keep copy_no = 1 (earliest inserted_at), delete the rest.
CREATE OR REPLACE VIEW public._v_dupes_to_delete_20260824 AS
WITH ranked AS (
  SELECT
    t.id,
    t.date,
    t.amount,
    t.description,
    t.inserted_at,
    t.statement_hash,
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
SELECT id, date, amount, description, inserted_at, statement_hash
FROM ranked
WHERE copy_no > 1;


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. INSPECT — read this before going further. Expect 10 rows / 42.08.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT * FROM public._v_dupes_to_delete_20260824 ORDER BY date DESC;

SELECT count(*) AS rows_to_delete, sum(amount) AS total_amount
FROM public._v_dupes_to_delete_20260824;

-- CHECK THIS ONE AGAINST YOUR JULY STATEMENT BEFORE STEP 3:
--   2026-07-27 · "Bill Payment, Invoice # MAGIC11 … Touch Prepaid" · $17.04
-- Both copies carry a fingerprint and were inserted 0.2s apart in ONE batch.
-- The other nine pairs are one hashed + one hashless copy imported months
-- apart — unambiguously the old formula failing to dedupe. This one is not the
-- same shape, and it may be a genuine double payment. If the statement shows it
-- once, delete it with the rest. If twice, exclude it:
--   … WHERE id <> 'e19a8f1b-1d03-4ed5-bc5b-d7074b7ca12d'


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. BACKUP — full row copies of exactly what step 3 touches.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public._backup_dupes_20260824 AS
SELECT t.*
FROM public.transactions t
WHERE t.id IN (SELECT id FROM public._v_dupes_to_delete_20260824);

SELECT count(*) AS backed_up FROM public._backup_dupes_20260824;  -- expect 10


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. REPAIR — soft-delete, and FREE THE FINGERPRINT.
--
-- `statement_hash = NULL` matters: the partial unique index
-- `transactions_statement_hash_uniq` is on (user_id, statement_hash) WHERE
-- statement_hash IS NOT NULL, and it does NOT exclude soft-deleted rows. A
-- deleted row that kept its hash would keep occupying that fingerprint, and
-- the re-import would report "skipped duplicate" for a row that no longer
-- exists (this is BUD-32). Nulling it is what makes the re-import work.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.transactions
SET deleted_at = now(),
    statement_hash = NULL
WHERE id IN (SELECT id FROM public._v_dupes_to_delete_20260824);
-- Expect: UPDATE 10


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. VERIFY — both must come back empty / zero.
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. No duplicate groups remain anywhere.
SELECT a.name AS account, t.date, t.amount, t.description, count(*) AS copies
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND t.deleted_at IS NULL
GROUP BY a.name, t.date, t.amount, t.description
HAVING count(*) > 1;

-- 4b. No deleted row is still holding a fingerprint.
SELECT count(*) AS deleted_rows_still_holding_a_hash
FROM public.transactions
WHERE user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND deleted_at IS NOT NULL
  AND statement_hash IS NOT NULL;

-- 4c. Debit Card - NEO row count: was 310, expect 300.
SELECT count(*) AS debit_card_rows
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND t.deleted_at IS NULL
  AND a.name = 'Debit Card - NEO';


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ROLLBACK
-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATE public.transactions t
-- SET deleted_at = NULL, statement_hash = b.statement_hash
-- FROM public._backup_dupes_20260824 b
-- WHERE t.id = b.id;

-- Clean up once the whole re-import is finished and verified:
-- DROP VIEW  public._v_dupes_to_delete_20260824;
-- DROP TABLE public._backup_dupes_20260824;


-- ═══════════════════════════════════════════════════════════════════════════
--  ON THE FX ROWS — deliberately NOT deleted here
--
--  Owner's position (2026-08-24): these are real costs that reduced the bank
--  balance. That is very likely right, and my earlier reasoning was weak:
--
--    * Trip - Italy 2026 (EUR) holds ZERO transactions. So the EUR side of a
--      conversion is not tracked anywhere, and the USD leg in Debit Card - NEO
--      is the ONLY record of that money leaving. Deleting it would erase a real
--      outflow rather than remove a phantom.
--    * "The two legs cancel" is only true when BOTH accounts are tracked. Here
--      they are not, so the argument does not apply.
--
--  One thing worth checking against the statement, because it is a direction
--  question rather than an existence question: on 2026-08-07 both directions
--  were imported, and BOTH as expenses (is_debt_return = false → subtract).
--    "USD to EUR"  0.85  → USD leaves  → expense  → correct
--    "EUR to USD"  1.14  → USD arrives → should ADD, not subtract
--  If the statement shows 1.14 in the MONEY IN column, that single row has the
--  wrong sign and is worth fixing on its own — the other nine are fine.
--
--  THE REAL DECISION IS NOT DELETION, IT IS THE IMPORT RULE. As shipped,
--  isTransferDescription() skips every "Own Account Exchange" row, so these
--  will never be imported again and that spending silently stops being
--  captured from now on. Same defect as person-to-person transfers (BUD-38).
--  Tracked as BUD-40.
-- ═══════════════════════════════════════════════════════════════════════════
