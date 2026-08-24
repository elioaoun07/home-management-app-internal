-- migrations/2026-08-24_recount-transfers.sql
-- DATA-ONLY · READ-ONLY — corrects a broken regex in the earlier diagnostic.
--
-- WHAT: the real count of own-account / transfer rows written as money.
-- WHY:  Q2 of 2026-08-24_diagnose-imported-transactions.sql used `\m` (which in
--       POSIX-Postgres means BEGINNING-of-word) as a CLOSING boundary. In
--       "Own Account Exchange" the character after "account" is a space, which
--       is not the start of a word, so the pattern never matched and Q2
--       reported 0 rows. The correct closing boundary is `\M` (end-of-word);
--       `\y` (either side) is used below since it cannot be got backwards.
--
-- The rows are real: V2 of the verification file shows ten
-- "Own Account Exchange: USD to EUR" rows in Debit Card - NEO alone.


-- ─────────────────────────────────────────────────────────────────────────────
-- T1 · Every own-account / transfer row, with what it did to the balance.
--
-- `balance_effect` is the important column. These sit in an EXPENSE account
-- with is_debt_return = false, so getBalanceDelta() subtracts BOTH legs of a
-- conversion instead of them cancelling — this is real balance error, not just
-- polluted analytics.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  a.name  AS account,
  a.type  AS account_type,
  t.date,
  t.description,
  t.amount,
  t.is_debt_return,
  CASE
    WHEN t.is_debt_return   THEN '+' || t.amount::text
    WHEN a.type = 'expense' THEN '-' || t.amount::text
    ELSE '+' || t.amount::text
  END AS balance_effect,
  t.inserted_at::date          AS imported_on,
  t.statement_hash IS NOT NULL AS has_hash,
  t.id
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND t.deleted_at IS NULL
  AND (
        t.description ~* '\yown\s+account\y'
     OR t.description ~* '\yaccount\s+exchange\y'
     OR t.description ~* '\yinternal\s+transfer\y'
     OR t.description ~* '\ytransfer\s+(from|to)\y'
     OR t.description ~* '\ybetween\s+(my|own)\s+accounts?\y'
      )
ORDER BY t.date, t.description;

-- ─────────────────────────────────────────────────────────────────────────────
A1 
-- ─────────────────────────────────────────────────────────────────────────────
| account          | account_type | date       | description                                                              | amount | is_debt_return | balance_effect | imported_on | has_hash | id                                   |
| ---------------- | ------------ | ---------- | ------------------------------------------------------------------------ | ------ | -------------- | -------------- | ----------- | -------- | ------------------------------------ |
| Debit Card - NEO | expense      | 2026-07-09 | Transfer to ELIE JOSEPH AZAR via Mobile - link bowling - mkalles - for 2 | 18     | false          | -18            | 2026-07-21  | true     | 4c7d4ebc-6120-4123-8a61-57665fe8e1a6 |
| Debit Card - NEO | expense      | 2026-08-07 | Own Account Exchange: EUR to USD                                         | 1.14   | false          | -1.14          | 2026-08-18  | true     | 29f3f546-8de6-4f4f-90a8-4b228d2665ed |
| Debit Card - NEO | expense      | 2026-08-07 | Own Account Exchange: USD to EUR                                         | 0.85   | false          | -0.85          | 2026-08-18  | true     | 3f322ce4-f802-465b-b0b5-6770e6180dbb |
| Debit Card - NEO | expense      | 2026-08-08 | Own Account Exchange: USD to EUR                                         | 0.85   | false          | -0.85          | 2026-08-18  | true     | 6278a8c2-b416-4196-85a1-1d6446a437c9 |
| Debit Card - NEO | expense      | 2026-08-09 | Own Account Exchange: USD to EUR                                         | 0.85   | false          | -0.85          | 2026-08-18  | true     | 28093cd5-b5fb-468b-9842-8efa3c1e70fc |
| Debit Card - NEO | expense      | 2026-08-10 | Own Account Exchange: USD to EUR                                         | 0.85   | false          | -0.85          | 2026-08-18  | true     | c5eaca52-d2f7-4ed7-8664-3f2baa86ca61 |
| Debit Card - NEO | expense      | 2026-08-11 | Own Account Exchange: USD to EUR                                         | 0.85   | false          | -0.85          | 2026-08-18  | true     | 698ea1d0-ec67-451e-9bce-a9c1e5b430e4 |
| Debit Card - NEO | expense      | 2026-08-12 | Own Account Exchange: USD to EUR                                         | 0.86   | false          | -0.86          | 2026-08-18  | true     | cb415835-42f8-4eed-80c3-68c4b3a462cc |
| Debit Card - NEO | expense      | 2026-08-13 | Own Account Exchange: USD to EUR                                         | 0.85   | false          | -0.85          | 2026-08-18  | true     | f52408db-72a7-4006-aa91-796fc0dbd15d |
| Debit Card - NEO | expense      | 2026-08-14 | Own Account Exchange: USD to EUR                                         | 0.85   | false          | -0.85          | 2026-08-18  | true     | 2b39304c-48ad-4cc0-9975-ee344604cc70 |
| Debit Card - NEO | expense      | 2026-08-14 | Own Account Exchange: USD to EUR                                         | 0.86   | false          | -0.86          | 2026-08-18  | true     | df2495f0-f79a-4901-8fea-f2d6045dfae3 |
| Debit Card - NEO | expense      | 2026-08-17 | Transfer to CHRISTOPHER JOSEPH STEPHAN via Mobile - Deek Duke            | 14.08  | false          | -14.08         | 2026-08-18  | true     | 6986b2c2-2a89-48ee-a327-a7554b6332aa |

-- ─────────────────────────────────────────────────────────────────────────────
-- T2 · The scale, split by what the app would do with each row TODAY.
--
--   own_account_fx  -> now classified `transfer`, skipped on import. These are
--                      phantom money and should come out of the ledger.
--   person_transfer -> "Transfer to <NAME> via Mobile". Also skipped by the
--                      importer, but this IS money that left your account.
--                      Deleting it would understate spending — decide
--                      separately from the FX rows.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  CASE
    WHEN t.description ~* '\yown\s+account\y'
      OR t.description ~* '\yaccount\s+exchange\y' THEN 'own_account_fx'
    ELSE 'person_transfer'
  END AS kind,
  a.name   AS account,
  count(*) AS rows,
  sum(t.amount) AS total_amount,
  min(t.date)   AS first_date,
  max(t.date)   AS last_date
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND t.deleted_at IS NULL
  AND (
        t.description ~* '\yown\s+account\y'
     OR t.description ~* '\yaccount\s+exchange\y'
     OR t.description ~* '\yinternal\s+transfer\y'
     OR t.description ~* '\ytransfer\s+(from|to)\y'
     OR t.description ~* '\ybetween\s+(my|own)\s+accounts?\y'
      )
GROUP BY kind, a.name
ORDER BY kind, a.name;

-- ─────────────────────────────────────────────────────────────────────────────
A2
-- ─────────────────────────────────────────────────────────────────────────────
| kind            | account          | rows | total_amount | first_date | last_date  |
| --------------- | ---------------- | ---- | ------------ | ---------- | ---------- |
| own_account_fx  | Debit Card - NEO | 10   | 8.81         | 2026-08-07 | 2026-08-14 |
| person_transfer | Debit Card - NEO | 2    | 32.08        | 2026-07-09 | 2026-08-17 |

-- ─────────────────────────────────────────────────────────────────────────────
-- T3 · Full untruncated descriptions for a few rows.
--
-- The earlier output was cut at 46 chars by `left(description, 46)`, so it was
-- not possible to tell whether the bank's continuation line ("at 1.140 - to
-- 501400630004 -") is stored or was dropped by the parser's multi-line branch.
-- This settles it — and it matters, because the description is hashed verbatim.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  t.date,
  t.description                AS full_description,
  length(t.description)        AS description_length,
  t.amount
FROM public.transactions t
WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
  AND t.deleted_at IS NULL
  AND t.description ~* '\yown\s+account\y'
ORDER BY t.date
LIMIT 12;

-- ─────────────────────────────────────────────────────────────────────────────
A3
-- ─────────────────────────────────────────────────────────────────────────────
| date       | full_description                 | description_length | amount |
| ---------- | -------------------------------- | ------------------ | ------ |
| 2026-08-07 | Own Account Exchange: USD to EUR | 32                 | 0.85   |
| 2026-08-07 | Own Account Exchange: EUR to USD | 32                 | 1.14   |
| 2026-08-08 | Own Account Exchange: USD to EUR | 32                 | 0.85   |
| 2026-08-09 | Own Account Exchange: USD to EUR | 32                 | 0.85   |
| 2026-08-10 | Own Account Exchange: USD to EUR | 32                 | 0.85   |
| 2026-08-11 | Own Account Exchange: USD to EUR | 32                 | 0.85   |
| 2026-08-12 | Own Account Exchange: USD to EUR | 32                 | 0.86   |
| 2026-08-13 | Own Account Exchange: USD to EUR | 32                 | 0.85   |
| 2026-08-14 | Own Account Exchange: USD to EUR | 32                 | 0.86   |
| 2026-08-14 | Own Account Exchange: USD to EUR | 32                 | 0.85   |
