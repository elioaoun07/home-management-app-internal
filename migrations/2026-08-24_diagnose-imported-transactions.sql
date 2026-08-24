-- migrations/2026-08-24_diagnose-imported-transactions.sql
-- DATA-ONLY · READ-ONLY DIAGNOSTIC — every statement here is a SELECT.
-- Nothing is written, nothing is deleted. Safe to run in full, in any order.
--
-- WHAT: work out whether the imported transactions can be repaired in place or
--       genuinely need wiping and re-importing.
-- WHY:  three known defects overlap in this data —
--         (a) the fingerprint formula changed on 2026-08-18 (v1 -> v2), so
--             anything imported before that cannot be matched by exact hash;
--         (b) own-account FX rows were written as real income/expense until
--             2026-08-24 (fixed, BUD-30) — they still sit in the ledger;
--         (c) rows could land in the wrong account (no deliberate account
--             choice until 2026-08-24, BUD-33).
--
-- HOW TO USE: run Q1 first and paste the output back. Q1 decides which of the
-- rest are worth running and which date to export statements from.
--
-- NOTE ON user_id: every query is scoped to '1cb9c50a-2a41-4fb3-8e90-2e270ca28830' so it returns only your
-- own rows. If you run these as the service role in the SQL Editor, '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
-- is NULL — in that case replace `'1cb9c50a-2a41-4fb3-8e90-2e270ca28830'` with your literal user uuid,
-- which Q0 prints.


-- ─────────────────────────────────────────────────────────────────────────────
-- Q0 · Who am I / which accounts exist
-- ─────────────────────────────────────────────────────────────────────────────
SELECT id AS account_id, name, type, currency, visible, is_default
FROM public.accounts
WHERE user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
ORDER BY name;

-- ─────────────────────────────────────────────────────────────────────────────
-- A0
-- ─────────────────────────────────────────────────────────────────────────────
| account_id                           | name              | type    | currency | visible | is_default |
| ------------------------------------ | ----------------- | ------- | -------- | ------- | ---------- |
| 9aa00832-52fa-4c58-9fb1-15cd3396152b | Debit Card - NEO  | expense | USD      | true    | false      |
| 7d2d34ac-c642-424f-af1b-329b47e453ea | Drawer            | income  | USD      | true    | false      |
| ad2137c0-a250-4121-9f90-0143ffb2a92d | Our Savings       | saving  | USD      | true    | false      |
| 816a2bc4-37c7-441d-baff-d7bf8a1632d7 | Salary            | income  | USD      | true    | false      |
| d59ef3ee-a667-4d09-bf69-7946201e4d93 | Trip - Italy 2026 | expense | EUR      | true    | false      |
| 95e86bc8-a531-4f58-bf2a-e0f442a58230 | Wallet            | expense | USD      | true    | true       |


-- ─────────────────────────────────────────────────────────────────────────────
-- Q1 · THE LANDSCAPE — imported rows per account, per fingerprint era
--
-- `hash_era` is derived from inserted_at, because a v1 and a v2 hash are both
-- 64 hex chars and cannot be told apart by value. 2026-08-18 is the day the
-- formula changed.
--   v1_hashed        -> imported pre-2026-08-18; exact-hash re-match will MISS
--                       these, they rely on the fuzzy duplicate tier
--   v2_hashed        -> imported after; exact-hash re-match works
--   imported_no_hash -> flagged is_imported but carries no fingerprint at all;
--                       these are invisible to dedupe and will re-import
--   manual           -> you typed it; not an import at all
--
-- READ THIS OUTPUT FIRST. `first_date`/`last_date` tell you which statement
-- periods to export.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  a.name                                   AS account,
  a.type                                   AS account_type,
  CASE
    WHEN t.statement_hash IS NOT NULL AND t.inserted_at < '2026-08-18'
      THEN 'v1_hashed'
    WHEN t.statement_hash IS NOT NULL
      THEN 'v2_hashed'
    WHEN t.is_imported
      THEN 'imported_no_hash'
    ELSE 'manual'
  END                                      AS hash_era,
  count(*)                                 AS rows,
  min(t.date)                              AS first_date,
  max(t.date)                              AS last_date,
  sum(t.amount) FILTER (WHERE NOT t.is_debt_return) AS sum_outgoing,
  sum(t.amount) FILTER (WHERE t.is_debt_return)     AS sum_incoming
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND t.deleted_at IS NULL
GROUP BY a.name, a.type, hash_era
ORDER BY a.name, hash_era;

-- ─────────────────────────────────────────────────────────────────────────────
-- A1
-- ─────────────────────────────────────────────────────────────────────────────
| account          | account_type | hash_era         | rows | first_date | last_date  | sum_outgoing | sum_incoming |
| ---------------- | ------------ | ---------------- | ---- | ---------- | ---------- | ------------ | ------------ |
| Debit Card - NEO | expense      | imported_no_hash | 157  | 2025-08-07 | 2026-04-01 | 8345.91      | null         |
| Debit Card - NEO | expense      | v1_hashed        | 136  | 2025-08-01 | 2026-07-31 | 5318.86      | null         |
| Debit Card - NEO | expense      | v2_hashed        | 17   | 2026-08-07 | 2026-08-17 | 1455.43      | null         |
| Salary           | income       | manual           | 1    | 2026-07-04 | 2026-07-04 | 50           | null         |
| Salary           | income       | v1_hashed        | 16   | 2025-07-29 | 2026-07-28 | 39708        | null         |
| Salary           | income       | v2_hashed        | 1    | 2026-08-17 | 2026-08-17 | 30           | null         |
| Wallet           | expense      | manual           | 183  | 2025-09-30 | 2026-08-21 | 9296         | null         |

-- ─────────────────────────────────────────────────────────────────────────────
-- Q2 · PHANTOM TRANSFERS — own-account moves written as real money (BUD-30)
--
-- These should never have become transactions. Each internal move produces a
-- pair that cancels on the balance, which is why this was invisible: the
-- account total stayed correct while analytics gained phantom income AND
-- phantom spend. Expect an even number of rows that sums to ~0 per pair.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  a.name        AS account,
  t.date,
  t.description,
  t.amount,
  t.is_debt_return,
  t.inserted_at::date AS imported_on,
  t.statement_hash IS NOT NULL AS has_fingerprint,
  t.id
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND t.deleted_at IS NULL
  AND (
        t.description ~* '\mown\s+account\m'
     OR t.description ~* '\maccount\s+exchange\m'
     OR t.description ~* '\minternal\s+transfer\m'
     OR t.description ~* '\mtransfer\s+(from|to)\m'
     OR t.description ~* '\mbetween\s+(my|own)\s+accounts?\m'
      )
ORDER BY t.date, t.description;

-- Q2b · the same thing as one number, so you can see the scale at a glance
SELECT
  count(*)                                          AS phantom_rows,
  count(*) FILTER (WHERE is_debt_return)            AS booked_as_income,
  count(*) FILTER (WHERE NOT is_debt_return)        AS booked_as_expense,
  sum(amount) FILTER (WHERE is_debt_return)         AS phantom_income_total,
  sum(amount) FILTER (WHERE NOT is_debt_return)     AS phantom_expense_total
FROM public.transactions
WHERE user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND deleted_at IS NULL
  AND (
        description ~* '\mown\s+account\m'
     OR description ~* '\maccount\s+exchange\m'
     OR description ~* '\minternal\s+transfer\m'
     OR description ~* '\mtransfer\s+(from|to)\m'
     OR description ~* '\mbetween\s+(my|own)\s+accounts?\m'
      );

-- ─────────────────────────────────────────────────────────────────────────────
-- A2a
-- ─────────────────────────────────────────────────────────────────────────────
0 Rows returned.
-- ─────────────────────────────────────────────────────────────────────────────
-- A2b
-- ─────────────────────────────────────────────────────────────────────────────
| phantom_rows | booked_as_income | booked_as_expense | phantom_income_total | phantom_expense_total |
| ------------ | ---------------- | ----------------- | -------------------- | --------------------- |
| 0            | 0                | 0                 | null                 | null                  |

-- ─────────────────────────────────────────────────────────────────────────────
-- Q3 · SAME MONEY, TWO ACCOUNTS — the cross-account duplicate check
--
-- Exact date + exact amount + same direction, appearing in more than one
-- account. Some of these are legitimate (two real £20 charges on one day);
-- the ones to look at are where the descriptions clearly describe one event.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  t.date,
  t.amount,
  t.is_debt_return,
  count(DISTINCT t.account_id)                    AS accounts_involved,
  array_agg(DISTINCT a.name)                      AS account_names,
  array_agg(t.description ORDER BY t.inserted_at) AS descriptions,
  array_agg(t.id ORDER BY t.inserted_at)          AS transaction_ids
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND t.deleted_at IS NULL
  AND t.is_draft = false
GROUP BY t.date, t.amount, t.is_debt_return
HAVING count(DISTINCT t.account_id) > 1
ORDER BY t.date DESC
LIMIT 200;
-- ─────────────────────────────────────────────────────────────────────────────
-- A3
-- ─────────────────────────────────────────────────────────────────────────────
0 Rows returned.

-- ─────────────────────────────────────────────────────────────────────────────
-- Q4 · TRUE DUPLICATES INSIDE ONE ACCOUNT
--
-- Same account, same date, same amount, same description, more than once.
-- This is what a re-import under a changed hash formula looks like.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  a.name                                      AS account,
  t.date,
  t.amount,
  t.description,
  count(*)                                    AS copies,
  count(DISTINCT t.statement_hash)            AS distinct_fingerprints,
  array_agg(t.inserted_at::date ORDER BY t.inserted_at) AS imported_on,
  array_agg(t.id ORDER BY t.inserted_at)      AS transaction_ids
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND t.deleted_at IS NULL
GROUP BY a.name, t.date, t.amount, t.description
HAVING count(*) > 1
ORDER BY count(*) DESC, t.date DESC
LIMIT 200;
-- ─────────────────────────────────────────────────────────────────────────────
-- A4
-- ─────────────────────────────────────────────────────────────────────────────
| account          | date       | amount | description                                                     | copies | distinct_fingerprints | imported_on                 | transaction_ids                                                                 |
| ---------------- | ---------- | ------ | --------------------------------------------------------------- | ------ | --------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| Debit Card - NEO | 2026-07-27 | 17.04  | Bill Payment, Invoice # MAGIC11 - for 71189528 to Touch Prepaid | 2      | 2                     | ["2026-07-31","2026-07-31"] | ["c2050109-befe-4a80-aa3c-fa29e9883f0c","e19a8f1b-1d03-4ed5-bc5b-d7074b7ca12d"] |
| Debit Card - NEO | 2026-04-01 | 1.99   | Monthly Charges-Standard Plan                                   | 2      | 1                     | ["2026-04-03","2026-05-10"] | ["2744c0ae-72a8-4c70-a644-1907e59bed1a","d27750c9-fa67-49c6-ac85-d78ea8f41cdc"] |
| Debit Card - NEO | 2026-03-16 | 9.12   | POS Purchase GOOGLE *YOUTUBE MOUNTAIN VIEWUS 0000               | 2      | 1                     | ["2026-03-16","2026-04-03"] | ["5a7c9ebc-6061-40f5-94e6-bb1528730e85","ccaa626c-eff3-4150-b46b-807fa9792f8c"] |
| Debit Card - NEO | 2026-03-01 | 1.99   | Monthly Charges-Standard Plan                                   | 2      | 1                     | ["2026-03-16","2026-05-28"] | ["59b18443-27ca-4c05-acfd-663af4599f9f","0f00398f-3caa-4e16-a67f-ca6d42f61f4f"] |
| Debit Card - NEO | 2026-02-01 | 1.99   | Monthly Charges-Standard Plan                                   | 2      | 1                     | ["2026-03-16","2026-05-28"] | ["88ca1520-6970-4ca0-ad33-43179b412471","b5acafd6-b737-4810-bcf3-8a8cec331c9d"] |
| Debit Card - NEO | 2026-01-01 | 1.99   | Monthly Charges-Standard Plan                                   | 2      | 1                     | ["2026-03-16","2026-05-28"] | ["1229640d-28e2-434d-b507-633c0abf1cac","3b411c62-b433-49ca-a1ea-021997132376"] |
| Debit Card - NEO | 2025-12-01 | 1.99   | Monthly Charges-Standard Plan                                   | 2      | 1                     | ["2025-12-02","2026-05-28"] | ["aae13a35-88b7-4645-aeae-dba5eaa363dc","2633fb9a-5af0-4584-98f4-9ee875024be1"] |
| Debit Card - NEO | 2025-11-01 | 1.99   | Monthly Charges-Standard Plan                                   | 2      | 1                     | ["2025-12-02","2026-05-28"] | ["0436be33-b38a-4f1b-97f7-f59a586e54e3","8173fc83-18b4-4b81-b4f7-07e89696798c"] |
| Debit Card - NEO | 2025-10-01 | 1.99   | Monthly Charges-Standard Plan                                   | 2      | 1                     | ["2025-12-02","2026-05-28"] | ["1abe2056-1b68-4758-9291-61d0506faf7c","11a012f0-3697-4c34-a3d9-1dea036b608f"] |
| Debit Card - NEO | 2025-09-01 | 1.99   | Monthly Charges-Standard Plan                                   | 2      | 1                     | ["2025-12-02","2026-05-28"] | ["045d9f7d-c8ff-4de5-b50b-27bf9e118cab","9fdfbcfc-9e6f-45d6-b15a-35c21b086d87"] |

-- ─────────────────────────────────────────────────────────────────────────────
-- Q5 · WRONG-DIRECTION ROWS — e.g. bank fees sitting in an income account
--
-- Your Salary example: the statement carries salary credits AND bank-fee
-- debits. Anything in an `income` account that is NOT a credit, or in an
-- `expense` account that IS a credit, is worth a look.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  a.name    AS account,
  a.type    AS account_type,
  t.date,
  t.description,
  t.amount,
  t.is_debt_return,
  t.inserted_at::date AS imported_on,
  t.id
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND t.deleted_at IS NULL
  AND (
        (a.type = 'income'  AND t.is_debt_return = false)
     OR (a.type = 'expense' AND t.is_debt_return = true)
      )
ORDER BY a.name, t.date DESC
LIMIT 200;
-- ─────────────────────────────────────────────────────────────────────────────
-- A5
-- ─────────────────────────────────────────────────────────────────────────────
| account | account_type | date       | description                                           | amount | is_debt_return | imported_on | id                                   |
| ------- | ------------ | ---------- | ----------------------------------------------------- | ------ | -------------- | ----------- | ------------------------------------ |
| Salary  | income       | 2026-08-17 | 3% Cash Back Campaign-                                | 30     | false          | 2026-08-18  | 436548e7-1628-4de5-a16e-73e4167919c7 |
| Salary  | income       | 2026-07-28 | Incoming Payments DIRECT DISTRIBUTION SAL AUDBLBBXXXX | 2526   | false          | 2026-07-31  | 523b6e27-2775-4982-8feb-39606cf9e5a6 |
| Salary  | income       | 2026-07-04 | Anthony - chewye                                      | 50     | false          | 2026-07-07  | ec4e171e-0001-4d5d-8821-5f3a6fa7b905 |
| Salary  | income       | 2026-06-25 | Incoming Payments DIRECT DISTRIBUTION SAL AUDBLBBXXXX | 3959   | false          | 2026-06-27  | 32b7669d-93db-41a2-a8ed-ac3a96fddcda |
| Salary  | income       | 2026-05-22 | Incoming Payments DIRECT DISTRIBUTION SAL AUDBLBBXXXX | 2526   | false          | 2026-05-28  | 22af22bd-4daf-47f2-a978-227fc49c785c |
| Salary  | income       | 2026-04-28 | Incoming Payments DIRECT DISTRIBUTION SAL AUDBLBBXXXX | 2564   | false          | 2026-05-28  | 4e311508-3b29-4016-803a-e4b71c00b136 |
| Salary  | income       | 2026-03-30 | INCOMING                                              | 2568   | false          | 2026-05-28  | b9e25962-7220-4258-8c5c-def982d15d22 |
| Salary  | income       | 2026-03-30 | Bonus - Closing                                       | 3823   | false          | 2026-05-28  | 27464168-d032-4180-aa74-77f07a99e76b |
| Salary  | income       | 2026-02-26 | Incoming Payments DIRECT DISTRIBUTION SAL AUDBLBBXXXX | 2568   | false          | 2026-05-28  | ffeda0fa-9df7-4613-8a22-06756ddb7496 |
| Salary  | income       | 2026-01-28 | Incoming Payments DIRECT DISTRIBUTION SAL AUDBLBBXXXX | 2568   | false          | 2026-05-28  | 30fb30e8-a898-4bb1-b31e-e3abe66ce294 |
| Salary  | income       | 2025-12-29 | Incoming Payments DIRECT DISTRIBUTION SAL AUDBLBBXXXX | 1575   | false          | 2026-05-28  | ae350d7a-07f7-4170-b7c5-37b3577093fe |
| Salary  | income       | 2025-12-12 | INCOMING                                              | 1300   | false          | 2026-05-28  | dff1dcc5-aa7b-43ac-a49e-d64bf7032a0b |
| Salary  | income       | 2025-11-26 | Incoming Payments DIRECT DISTRIBUTION SAL AUDBLBBXXXX | 2524   | false          | 2026-05-28  | b0a3b182-cf91-40f6-b8af-4fb4f058b1f7 |
| Salary  | income       | 2025-10-28 | Incoming Payments DIRECT DISTRIBUTION SAL AUDBLBBXXXX | 2524   | false          | 2026-05-28  | 668f9a3c-dce4-429e-96fe-cad8636d684a |
| Salary  | income       | 2025-09-26 | Bonus                                                 | 1101   | false          | 2026-05-28  | 548cf606-9068-4e4e-abdf-9255faf07d5a |
| Salary  | income       | 2025-09-26 | INCOMING                                              | 2524   | false          | 2026-05-28  | 2d0619f3-c1c1-4b0f-a677-0533b39a016f |
| Salary  | income       | 2025-08-26 | Incoming Payments DIRECT DISTRIBUTION SAL AUDBLBBXXXX | 2524   | false          | 2026-05-28  | 21eefb3d-a3da-47bc-b7a9-db8d5df83c4b |
| Salary  | income       | 2025-07-29 | Incoming Payments DIRECT DISTRIBUTION SAL AUDBLBBXXXX | 2534   | false          | 2026-05-28  | 59a21f9a-66ce-401a-9b1d-3b83a3873401 |

-- ─────────────────────────────────────────────────────────────────────────────
-- Q6 · IMPORT BATCHES — what can be walked back with the built-in Revert
--
-- Any batch listed here with status 'completed' can be undone from the app
-- (Statement Import -> upload screen -> Import History -> Revert). That path
-- also FREES the fingerprint, which a plain delete does not.
-- `has_ledger` = false means the batch predates the rollback ledger and is NOT
-- revertible from the app.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  si.imported_at::date            AS imported_on,
  si.file_name,
  a.name                          AS account,
  si.status,
  si.transactions_count,
  si.created_count,
  si.stamped_count,
  si.skipped_count,
  si.error_count,
  si.balance_deltas,
  EXISTS (
    SELECT 1 FROM public.statement_import_entries e WHERE e.import_id = si.id
  )                               AS has_ledger,
  si.id                           AS import_id
FROM public.statement_imports si
LEFT JOIN public.accounts a ON a.id = si.account_id
WHERE si.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
ORDER BY si.imported_at DESC;
-- ─────────────────────────────────────────────────────────────────────────────
-- A6
-- ─────────────────────────────────────────────────────────────────────────────
| imported_on | file_name                        | account | status    | transactions_count | created_count | stamped_count | skipped_count | error_count | balance_deltas | has_ledger | import_id                            |
| ----------- | -------------------------------- | ------- | --------- | ------------------ | ------------- | ------------- | ------------- | ----------- | -------------- | ---------- | ------------------------------------ |
| 2026-08-18  | account_statement_EURO.pdf       | null    | completed | 56                 | 0             | 0             | 0             | 0           | {}             | false      | 4770ce86-99f2-4aac-a80e-5d0d591684c4 |
| 2026-08-18  | account_statement4.pdf           | null    | completed | 1                  | 0             | 0             | 0             | 0           | {}             | false      | 17b03d14-9b60-49c1-835b-217cd0d6ac81 |
| 2026-08-18  | account_statement4.pdf           | null    | completed | 2                  | 0             | 0             | 0             | 0           | {}             | false      | 22ca776d-25f7-4468-89a2-e21a9d796d21 |
| 2026-08-18  | account_statement4.pdf           | null    | completed | 4                  | 0             | 0             | 0             | 0           | {}             | false      | d669346e-94f1-454c-9fa2-5f8c945a581e |
| 2026-08-18  | account_statement3.pdf           | null    | completed | 2                  | 0             | 0             | 0             | 0           | {}             | false      | 45f51b87-d96c-42fa-8187-da25452a3b38 |
| 2026-08-18  | account_statement2.pdf           | null    | completed | 1                  | 0             | 0             | 0             | 0           | {}             | false      | 6ef1e1e8-02a7-4e24-8314-7af6e00e19f3 |
| 2026-08-18  | account_statement2.pdf           | null    | completed | 8                  | 0             | 0             | 0             | 0           | {}             | false      | 7d65f090-0f2e-4d7b-8860-94a68b04b9a5 |
| 2026-07-31  | account_statement1.pdf           | null    | completed | 15                 | 0             | 0             | 0             | 0           | {}             | false      | b51e9a00-50bb-452f-8e8e-d14cf71c6ffd |
| 2026-07-31  | account_statement.pdf            | null    | completed | 1                  | 0             | 0             | 0             | 0           | {}             | false      | ebc4380f-227d-4474-ac0d-7401cb27e182 |
| 2026-07-21  | account_statement (1).pdf        | null    | completed | 3                  | 0             | 0             | 0             | 0           | {}             | false      | 392a8f15-b831-44a5-81b0-09a7f6f33d97 |
| 2026-07-21  | account_statement (1).pdf        | null    | completed | 18                 | 0             | 0             | 0             | 0           | {}             | false      | 808f9979-5cf1-4d47-8d19-0a21d4102a06 |
| 2026-07-21  | account_statement.pdf            | null    | completed | 1                  | 0             | 0             | 0             | 0           | {}             | false      | e1a138e8-0cf0-43c5-87c7-cb4c80c98f4c |
| 2026-06-27  | account_statement (2).pdf        | null    | completed | 1                  | 0             | 0             | 0             | 0           | {}             | false      | f58c943e-4cd8-4d3a-82f0-49e90fd8e130 |
| 2026-06-27  | account_statement (1).pdf        | null    | completed | 26                 | 0             | 0             | 0             | 0           | {}             | false      | 4fe98cb0-26c1-45eb-b6c9-7c4ef9f6881e |
| 2026-06-27  | account_statement.pdf            | null    | completed | 1                  | 0             | 0             | 0             | 0           | {}             | false      | f03719af-ee01-43eb-9665-869575e9207a |
| 2026-05-28  | account_statement3.pdf           | null    | completed | 18                 | 0             | 0             | 0             | 0           | {}             | false      | 9013fe82-5c87-4c15-be5b-ea8a1e5d0cec |
| 2026-05-28  | account_statement4.pdf           | null    | completed | 0                  | 0             | 0             | 0             | 0           | {}             | false      | 07809580-069d-4df0-81d0-9e6d3b4c1e64 |
| 2026-05-28  | account_statement.pdf            | null    | completed | 9                  | 0             | 0             | 0             | 0           | {}             | false      | 6d3bcaca-bdaf-4ddd-949d-c6472a9609c7 |
| 2026-05-28  | account_statement.pdf            | null    | completed | 14                 | 0             | 0             | 0             | 0           | {}             | false      | 8ecadc42-8064-4d3c-86ee-94e60037d883 |
| 2026-05-10  | account_statement (2).pdf        | null    | completed | 1                  | 0             | 0             | 0             | 0           | {}             | false      | 367dc45e-2055-43b3-905f-81a28f3d9abd |
| 2026-05-10  | account_statement (2).pdf        | null    | completed | 2                  | 0             | 0             | 0             | 0           | {}             | false      | 40880d5e-0e5c-4d10-b11c-68d1ce38ae3e |
| 2026-05-10  | account_statement (1).pdf        | null    | completed | 9                  | 0             | 0             | 0             | 0           | {}             | false      | 53ba0e7f-07f8-401e-a5bf-709e29f45084 |
| 2026-05-10  | account_statement.pdf            | null    | completed | 1                  | 0             | 0             | 0             | 0           | {}             | false      | 7b0c16ca-bf29-4eaa-b445-56f83d179e99 |
| 2026-05-10  | account_statement.pdf            | null    | completed | 18                 | 0             | 0             | 0             | 0           | {}             | false      | d421fe34-7b2f-4b3e-a2a0-61fb2e102b3e |
| 2026-04-03  | account_statement (1).pdf        | null    | completed | 16                 | 0             | 0             | 0             | 0           | {}             | false      | 15c25167-63b3-4c97-8ee1-324965407897 |
| 2026-04-03  | account_statement.pdf            | null    | completed | 0                  | 0             | 0             | 0             | 0           | {}             | false      | 032510f6-ab7d-417b-acc7-9794cb4b2e44 |
| 2026-04-03  | account_statement.pdf            | null    | completed | 1                  | 0             | 0             | 0             | 0           | {}             | false      | 1d61e244-5560-42b7-96b5-3657ebcc9f3d |
| 2026-04-03  | account_statement.pdf            | null    | completed | 1                  | 0             | 0             | 0             | 0           | {}             | false      | ccd753eb-20ed-4050-8053-ddb15d8f307d |
| 2026-04-03  | account_statement (1).pdf        | null    | completed | 16                 | 0             | 0             | 0             | 0           | {}             | false      | 5643b5b7-005c-418c-9c94-39443a160a62 |
| 2026-04-03  | account_statement (1).pdf        | null    | completed | 16                 | 0             | 0             | 0             | 0           | {}             | false      | 1a5db6f2-ff2d-49f9-b9e3-6455c68ce444 |
| 2026-04-03  | account_statement (1).pdf        | null    | completed | 16                 | 0             | 0             | 0             | 0           | {}             | false      | b0825e5a-c18d-4bc6-a8ed-7b22c9e76e14 |
| 2026-04-03  | account_statement (1).pdf        | null    | completed | 16                 | 0             | 0             | 0             | 0           | {}             | false      | a6fb96cf-db12-4380-bd5e-a1e4da9a6dc1 |
| 2026-04-03  | account_statement (1).pdf        | null    | completed | 16                 | 0             | 0             | 0             | 0           | {}             | false      | 4cbea7fc-b6f6-446f-b801-4d671f61f9b7 |
| 2026-04-03  | account_statement (1).pdf        | null    | completed | 16                 | 0             | 0             | 0             | 0           | {}             | false      | 63d3ae95-a7b9-4f09-ac9d-21d32358857b |
| 2026-04-03  | account_statement (1).pdf        | null    | completed | 16                 | 0             | 0             | 0             | 0           | {}             | false      | 8e3e0ef7-5a75-4ecd-b4aa-9cfecd0bb028 |
| 2026-04-03  | account_statement (1).pdf        | null    | completed | 16                 | 0             | 0             | 0             | 0           | {}             | false      | 39239641-3189-437e-b87b-4d1b50c944ab |
| 2026-04-03  | account_statement.pdf            | null    | completed | 1                  | 0             | 0             | 0             | 0           | {}             | false      | 0af13efa-1637-4b1d-bd5d-8aba00044506 |
| 2026-03-16  | account_statement (1).pdf        | null    | completed | 3                  | 0             | 0             | 0             | 0           | {}             | false      | 3b545bac-b421-4586-90ec-cea4a032012f |
| 2026-03-16  | account_statement (1).pdf        | null    | completed | 4                  | 0             | 0             | 0             | 0           | {}             | false      | adde6256-b988-48d9-ba00-7cbb2a50d3db |
| 2026-03-16  | account_statement.pdf            | null    | completed | 92                 | 0             | 0             | 0             | 0           | {}             | false      | cc536f49-5549-4d3d-aa64-68b2581a239b |
| 2025-12-02  | account_statement-USDAccount.pdf | null    | completed | 4                  | 0             | 0             | 0             | 0           | {}             | false      | f7c0bad2-ad94-4d79-be0c-b5288d91824d |
| 2025-12-01  | account_statement-USDAccount.pdf | null    | completed | 6                  | 0             | 0             | 0             | 0           | {}             | false      | 5fc43e8b-bfc7-4e07-9571-8933ee83e4f5 |
| 2025-12-01  | account_statement.pdf            | null    | completed | 1                  | 0             | 0             | 0             | 0           | {}             | false      | 187d1e9f-92aa-4e3d-a2fd-4ab990d9acfa |
| 2025-12-01  | account_statement.pdf            | null    | completed | 57                 | 0             | 0             | 0             | 0           | {}             | false      | 154c80fa-16ea-4b5b-9d01-2eeeadab7293 |
| 2025-12-01  | account_statement.pdf            | null    | completed | 57                 | 0             | 0             | 0             | 0           | {}             | false      | 5d3d0945-5eda-4171-90a4-b491b73333ce |

-- ─────────────────────────────────────────────────────────────────────────────
-- Q7 · FINGERPRINTS HELD BY DELETED ROWS (the BUD-32 trap)
--
-- A plain delete only sets deleted_at; the unique index on
-- (user_id, statement_hash) still holds the fingerprint. Re-importing those
-- statements reports "skipped duplicate" and the rows never come back.
-- Anything here is a row that CANNOT currently be re-imported.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  a.name AS account,
  t.date,
  t.description,
  t.amount,
  t.deleted_at::date AS deleted_on,
  t.id
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND t.deleted_at IS NOT NULL
  AND t.statement_hash IS NOT NULL
ORDER BY t.deleted_at DESC
LIMIT 200;
-- ─────────────────────────────────────────────────────────────────────────────
-- A7
-- ─────────────────────────────────────────────────────────────────────────────
0 Rows returned.

-- ─────────────────────────────────────────────────────────────────────────────
-- Q8 · COVERAGE PER MONTH — where the gaps and the pile-ups are
--
-- Compare this against the statements you still have. A month with far fewer
-- rows than the statement is a gap; far more is duplication.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  a.name                        AS account,
  date_trunc('month', t.date)::date AS month,
  count(*)                      AS rows,
  count(*) FILTER (WHERE t.statement_hash IS NOT NULL) AS fingerprinted,
  count(*) FILTER (WHERE t.is_imported)                AS imported,
  sum(t.amount) FILTER (WHERE NOT t.is_debt_return)    AS outgoing,
  sum(t.amount) FILTER (WHERE t.is_debt_return)        AS incoming
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND t.deleted_at IS NULL
GROUP BY a.name, month
ORDER BY a.name, month DESC;
-- ─────────────────────────────────────────────────────────────────────────────
-- A8
-- ─────────────────────────────────────────────────────────────────────────────
| account          | month      | rows | fingerprinted | imported | outgoing | incoming |
| ---------------- | ---------- | ---- | ------------- | -------- | -------- | -------- |
| Debit Card - NEO | 2026-08-01 | 17   | 17            | 17       | 1455.43  | null     |
| Debit Card - NEO | 2026-07-01 | 33   | 33            | 33       | 1785.51  | null     |
| Debit Card - NEO | 2026-06-01 | 31   | 31            | 31       | 1578.26  | null     |
| Debit Card - NEO | 2026-05-01 | 23   | 23            | 23       | 642.21   | null     |
| Debit Card - NEO | 2026-04-01 | 26   | 25            | 26       | 923.30   | null     |
| Debit Card - NEO | 2026-03-01 | 32   | 16            | 32       | 832.22   | null     |
| Debit Card - NEO | 2026-02-01 | 32   | 1             | 32       | 989.53   | null     |
| Debit Card - NEO | 2026-01-01 | 17   | 1             | 17       | 410.83   | null     |
| Debit Card - NEO | 2025-12-01 | 33   | 1             | 33       | 1458.83  | null     |
| Debit Card - NEO | 2025-11-01 | 19   | 1             | 19       | 1208.22  | null     |
| Debit Card - NEO | 2025-10-01 | 23   | 1             | 23       | 1245.75  | null     |
| Debit Card - NEO | 2025-09-01 | 12   | 1             | 12       | 603.17   | null     |
| Debit Card - NEO | 2025-08-01 | 12   | 2             | 12       | 1986.94  | null     |
| Salary           | 2026-08-01 | 1    | 1             | 1        | 30       | null     |
| Salary           | 2026-07-01 | 2    | 1             | 1        | 2576     | null     |
| Salary           | 2026-06-01 | 1    | 1             | 1        | 3959     | null     |
| Salary           | 2026-05-01 | 1    | 1             | 1        | 2526     | null     |
| Salary           | 2026-04-01 | 1    | 1             | 1        | 2564     | null     |
| Salary           | 2026-03-01 | 2    | 2             | 2        | 6391     | null     |
| Salary           | 2026-02-01 | 1    | 1             | 1        | 2568     | null     |
| Salary           | 2026-01-01 | 1    | 1             | 1        | 2568     | null     |
| Salary           | 2025-12-01 | 2    | 2             | 2        | 2875     | null     |
| Salary           | 2025-11-01 | 1    | 1             | 1        | 2524     | null     |
| Salary           | 2025-10-01 | 1    | 1             | 1        | 2524     | null     |
| Salary           | 2025-09-01 | 2    | 2             | 2        | 3625     | null     |
| Salary           | 2025-08-01 | 1    | 1             | 1        | 2524     | null     |
| Salary           | 2025-07-01 | 1    | 1             | 1        | 2534     | null     |
| Wallet           | 2026-08-01 | 8    | 0             | 0        | 103      | null     |
| Wallet           | 2026-07-01 | 21   | 0             | 0        | 1070     | null     |
| Wallet           | 2026-06-01 | 21   | 0             | 0        | 670      | null     |
| Wallet           | 2026-05-01 | 12   | 0             | 0        | 280      | null     |
| Wallet           | 2026-04-01 | 16   | 0             | 0        | 670      | null     |
| Wallet           | 2026-03-01 | 13   | 0             | 0        | 791      | null     |
| Wallet           | 2026-02-01 | 16   | 0             | 0        | 1418     | null     |
| Wallet           | 2026-01-01 | 15   | 0             | 0        | 1264     | null     |
| Wallet           | 2025-12-01 | 15   | 0             | 0        | 1400     | null     |
| Wallet           | 2025-11-01 | 21   | 0             | 0        | 800      | null     |
| Wallet           | 2025-10-01 | 24   | 0             | 0        | 820      | null     |
| Wallet           | 2025-09-01 | 1    | 0             | 0        | 10       | null     |
