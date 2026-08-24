-- migrations/2026-08-24_verify-hash-reconstruction.sql
-- DATA-ONLY · READ-ONLY VERIFICATION — every statement is a SELECT.
--
-- WHAT: prove (or disprove) that the app's v2 fingerprint can be rebuilt in
--       pure SQL from columns already stored on `transactions`.
-- WHY:  if it can, the whole history can be RE-KEYED in place instead of being
--       deleted and re-imported — 293 of your 310 Debit Card rows and 16 of 18
--       Salary rows currently carry either a dead v1 fingerprint or none at
--       all, which is why re-uploading an old statement would duplicate them.
--
-- The app computes (src/lib/bank-statement-parser.ts, generateStatementHash):
--     sha256( "v2|" || account_id || "|" || date || "|" ||
--             lower(trim(description)) || "|" || moneyOut || "|" || moneyIn )
--   where moneyOut / moneyIn are toFixed(2) or "" when that column was blank,
--   and a "#n" suffix is appended for the 2nd+ identical row within one file.
--
-- Everything in that preimage is still on the row EXCEPT which money column the
-- amount came from — so V2 below computes BOTH readings and lets the data say
-- which one is right, rather than assuming.
--
-- RUN V1 AND V2 AND PASTE THE OUTPUT. Do not run any backfill before that:
-- if the reconstruction does not reproduce known-good hashes exactly, re-keying
-- would write fingerprints that match nothing and the next import would
-- duplicate everything.
--
-- NOTE: needs pgcrypto's digest(). If "function extensions.digest does not
-- exist", drop the `extensions.` prefix. If it still fails, run
--   CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
-- first (that is the one non-SELECT here, and it only installs a function).


-- ─────────────────────────────────────────────────────────────────────────────
-- V0 · Is digest() reachable at all? Expect the known SHA-256 of "abc".
--      ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
-- ─────────────────────────────────────────────────────────────────────────────
SELECT encode(extensions.digest('abc', 'sha256'), 'hex') AS sha256_of_abc;
-- ─────────────────────────────────────────────────────────────────────────────
A0
-- ─────────────────────────────────────────────────────────────────────────────
| sha256_of_abc                                                    |
| ---------------------------------------------------------------- |
| ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad |

-- ─────────────────────────────────────────────────────────────────────────────
-- V1 · THE PROOF — rebuild the fingerprint for every row that already has one,
--      and count how many reconstructions land on the stored value.
--
-- Only rows inserted on/after 2026-08-18 can possibly match: before that the
-- formula was v1 (`date|desc|out|in|balance`), and `balance` is not stored, so
-- v1 hashes are unreproducible by design. Those rows are the ones being
-- replaced, not verified.
--
-- WHAT THE RESULT MEANS
--   matched_as_debit  > 0 and matched_as_credit = 0 → money-out rows; formula
--                                                     proven for this account
--   matched_as_credit > 0                           → money-in rows; ditto
--   both 0 for post-2026-08-18 rows                 → STOP. Formula is wrong,
--                                                     do not backfill.
-- ─────────────────────────────────────────────────────────────────────────────
WITH base AS (
  SELECT
    t.id,
    a.name AS account,
    a.type AS account_type,
    t.account_id,
    t.date,
    t.description,
    t.amount,
    t.is_debt_return,
    t.statement_hash,
    t.inserted_at,
    trim(to_char(t.amount, 'FM9999999999990.00')) AS amt_text,
    row_number() OVER (
      PARTITION BY t.account_id, t.date, lower(trim(t.description)), t.amount
      ORDER BY t.inserted_at, t.id
    ) AS occurrence
  FROM public.transactions t
  JOIN public.accounts a ON a.id = t.account_id
  WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
    AND t.deleted_at IS NULL
    AND t.statement_hash IS NOT NULL
),
rebuilt AS (
  SELECT
    b.*,
    -- amount sat in MONEY OUT (a debit): "…|123.45|"
    encode(extensions.digest(
      'v2|' || b.account_id::text || '|' || b.date::text || '|'
            || lower(trim(b.description)) || '|' || b.amt_text || '|'
            || CASE WHEN b.occurrence > 1 THEN '#' || b.occurrence ELSE '' END,
      'sha256'), 'hex') AS hash_as_debit,
    -- amount sat in MONEY IN (a credit): "…||123.45"
    encode(extensions.digest(
      'v2|' || b.account_id::text || '|' || b.date::text || '|'
            || lower(trim(b.description)) || '||' || b.amt_text
            || CASE WHEN b.occurrence > 1 THEN '#' || b.occurrence ELSE '' END,
      'sha256'), 'hex') AS hash_as_credit
  FROM base b
)
SELECT
  account,
  account_type,
  CASE WHEN inserted_at < '2026-08-18' THEN 'pre-v2 (unreproducible)'
       ELSE 'v2 era' END                                    AS era,
  count(*)                                                  AS rows,
  count(*) FILTER (WHERE statement_hash = hash_as_debit)    AS matched_as_debit,
  count(*) FILTER (WHERE statement_hash = hash_as_credit)   AS matched_as_credit,
  count(*) FILTER (WHERE statement_hash NOT IN (hash_as_debit, hash_as_credit))
                                                            AS matched_neither
FROM rebuilt
GROUP BY account, account_type, era
ORDER BY account, era;

-- ─────────────────────────────────────────────────────────────────────────────
A1
-- ─────────────────────────────────────────────────────────────────────────────
| account          | account_type | era                     | rows | matched_as_debit | matched_as_credit | matched_neither |
| ---------------- | ------------ | ----------------------- | ---- | ---------------- | ----------------- | --------------- |
| Debit Card - NEO | expense      | pre-v2 (unreproducible) | 136  | 0                | 0                 | 136             |
| Debit Card - NEO | expense      | v2 era                  | 17   | 0                | 0                 | 17              |
| Salary           | income       | pre-v2 (unreproducible) | 16   | 0                | 0                 | 16              |
| Salary           | income       | v2 era                  | 1    | 0                | 0                 | 1               |

-- ─────────────────────────────────────────────────────────────────────────────
-- V2 · The same thing row by row for the v2-era rows only, so a mismatch can
--      actually be diagnosed instead of just counted.
-- ─────────────────────────────────────────────────────────────────────────────
WITH base AS (
  SELECT
    t.id,
    a.name AS account,
    t.account_id,
    t.date,
    t.description,
    t.amount,
    t.is_debt_return,
    t.statement_hash,
    t.inserted_at,
    trim(to_char(t.amount, 'FM9999999999990.00')) AS amt_text,
    row_number() OVER (
      PARTITION BY t.account_id, t.date, lower(trim(t.description)), t.amount
      ORDER BY t.inserted_at, t.id
    ) AS occurrence
  FROM public.transactions t
  JOIN public.accounts a ON a.id = t.account_id
  WHERE t.user_id = '1cb9c50a-2a41-4fb3-8e90-2e270ca28830'
    AND t.deleted_at IS NULL
    AND t.statement_hash IS NOT NULL
    AND t.inserted_at >= '2026-08-18'
)
SELECT
  account,
  date,
  left(description, 46) AS description,
  amount,
  is_debt_return,
  occurrence,
  CASE
    WHEN statement_hash = encode(extensions.digest(
      'v2|' || account_id::text || '|' || date::text || '|'
            || lower(trim(description)) || '|' || amt_text || '|'
            || CASE WHEN occurrence > 1 THEN '#' || occurrence ELSE '' END,
      'sha256'), 'hex') THEN 'debit'
    WHEN statement_hash = encode(extensions.digest(
      'v2|' || account_id::text || '|' || date::text || '|'
            || lower(trim(description)) || '||' || amt_text
            || CASE WHEN occurrence > 1 THEN '#' || occurrence ELSE '' END,
      'sha256'), 'hex') THEN 'credit'
    ELSE 'NO MATCH'
  END AS reconstruction,
  left(statement_hash, 12) AS stored_hash_prefix
FROM base
ORDER BY account, date;

-- ─────────────────────────────────────────────────────────────────────────────
A2
-- ─────────────────────────────────────────────────────────────────────────────
| account          | date       | description                                    | amount  | is_debt_return | occurrence | reconstruction | stored_hash_prefix |
| ---------------- | ---------- | ---------------------------------------------- | ------- | -------------- | ---------- | -------------- | ------------------ |
| Debit Card - NEO | 2026-08-07 | Online Purchase BKG*HOTEL AT BOOKING.C AMSTERD | 1177.79 | false          | 1          | NO MATCH       | 7c9d42df2ba5       |
| Debit Card - NEO | 2026-08-07 | Own Account Exchange: EUR to USD               | 1.14    | false          | 1          | NO MATCH       | 7b9ed47dbe25       |
| Debit Card - NEO | 2026-08-07 | Own Account Exchange: USD to EUR               | 0.85    | false          | 1          | NO MATCH       | c9d9668c3ab4       |
| Debit Card - NEO | 2026-08-07 | Purchase of esim mamma-mia-in- 30days-3gb, Ita | 2.5     | false          | 1          | NO MATCH       | 262e5fbfc511       |
| Debit Card - NEO | 2026-08-08 | Own Account Exchange: USD to EUR               | 0.85    | false          | 1          | NO MATCH       | d51176333685       |
| Debit Card - NEO | 2026-08-09 | Own Account Exchange: USD to EUR               | 0.85    | false          | 1          | NO MATCH       | 2df4dad99e92       |
| Debit Card - NEO | 2026-08-10 | Own Account Exchange: USD to EUR               | 0.85    | false          | 1          | NO MATCH       | 2d98e501a2d1       |
| Debit Card - NEO | 2026-08-10 | Online Purchase SEILBAHNEN SECEDA AG ORTISEI I | 179.11  | false          | 1          | NO MATCH       | edfd3e2e068e       |
| Debit Card - NEO | 2026-08-10 | POS Purchase STAZIONE CENTRALE MILA MILANO IT  | 50.41   | false          | 1          | NO MATCH       | 4d8308d0ea26       |
| Debit Card - NEO | 2026-08-11 | Own Account Exchange: USD to EUR               | 0.85    | false          | 1          | NO MATCH       | 2ed2bf521324       |
| Debit Card - NEO | 2026-08-11 | POS Purchase PARCHEGGIO PONTECHIESA CORTINA D | 2.43    | false          | 1          | NO MATCH       | be4fc9ca4de7       |
| Debit Card - NEO | 2026-08-12 | Own Account Exchange: USD to EUR               | 0.86    | false          | 1          | NO MATCH       | 97f4daff43aa       |
| Debit Card - NEO | 2026-08-12 | Online Purchase ANTHROPIC* CLAUDE SUB SAN FRAN | 20.3    | false          | 1          | NO MATCH       | 88dd9d10c707       |
| Debit Card - NEO | 2026-08-13 | Own Account Exchange: USD to EUR               | 0.85    | false          | 1          | NO MATCH       | fe170a571b7f       |
| Debit Card - NEO | 2026-08-14 | Own Account Exchange: USD to EUR               | 0.85    | false          | 1          | NO MATCH       | a5540f17ac69       |
| Debit Card - NEO | 2026-08-14 | Own Account Exchange: USD to EUR               | 0.86    | false          | 1          | NO MATCH       | 7e37989f8539       |
| Debit Card - NEO | 2026-08-17 | Transfer to CHRISTOPHER JOSEPH STEPHAN via Mob | 14.08   | false          | 1          | NO MATCH       | a4d33ac526a4       |
| Salary           | 2026-08-17 | 3% Cash Back Campaign-                         | 30      | false          | 1          | NO MATCH       | cb02d57a92b2       |

-- ─────────────────────────────────────────────────────────────────────────────
-- V3 · The 10 duplicate pairs from Q4, with enough detail to decide which copy
--      to keep. These must be resolved BEFORE any re-keying: two rows that are
--      the same money would otherwise be handed occurrence 1 and 2, i.e. two
--      valid-looking fingerprints, and the duplication becomes permanent.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  a.name AS account,
  t.date,
  t.description,
  t.amount,
  t.inserted_at,
  t.statement_hash IS NOT NULL AS has_hash,
  t.category_id IS NOT NULL    AS has_category,
  t.id
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
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
ORDER BY t.date DESC, t.description, t.inserted_at;

-- ─────────────────────────────────────────────────────────────────────────────
A3
-- ─────────────────────────────────────────────────────────────────────────────
| account          | date       | description                                                     | amount | inserted_at                   | has_hash | has_category | id                                   |
| ---------------- | ---------- | --------------------------------------------------------------- | ------ | ----------------------------- | -------- | ------------ | ------------------------------------ |
| Debit Card - NEO | 2026-07-27 | Bill Payment, Invoice # MAGIC11 - for 71189528 to Touch Prepaid | 17.04  | 2026-07-31 16:53:20.960319+00 | true     | true         | c2050109-befe-4a80-aa3c-fa29e9883f0c |
| Debit Card - NEO | 2026-07-27 | Bill Payment, Invoice # MAGIC11 - for 71189528 to Touch Prepaid | 17.04  | 2026-07-31 16:53:21.144243+00 | true     | true         | e19a8f1b-1d03-4ed5-bc5b-d7074b7ca12d |
| Debit Card - NEO | 2026-04-01 | Monthly Charges-Standard Plan                                   | 1.99   | 2026-04-03 10:11:05.365658+00 | false    | true         | 2744c0ae-72a8-4c70-a644-1907e59bed1a |
| Debit Card - NEO | 2026-04-01 | Monthly Charges-Standard Plan                                   | 1.99   | 2026-05-10 17:56:23.711057+00 | true     | true         | d27750c9-fa67-49c6-ac85-d78ea8f41cdc |
| Debit Card - NEO | 2026-03-16 | POS Purchase GOOGLE *YOUTUBE MOUNTAIN VIEWUS 0000               | 9.12   | 2026-03-16 16:42:54.681098+00 | false    | true         | 5a7c9ebc-6061-40f5-94e6-bb1528730e85 |
| Debit Card - NEO | 2026-03-16 | POS Purchase GOOGLE *YOUTUBE MOUNTAIN VIEWUS 0000               | 9.12   | 2026-04-03 10:28:53.239936+00 | true     | true         | ccaa626c-eff3-4150-b46b-807fa9792f8c |
| Debit Card - NEO | 2026-03-01 | Monthly Charges-Standard Plan                                   | 1.99   | 2026-03-16 17:04:07.604874+00 | false    | true         | 59b18443-27ca-4c05-acfd-663af4599f9f |
| Debit Card - NEO | 2026-03-01 | Monthly Charges-Standard Plan                                   | 1.99   | 2026-05-28 09:13:53.247045+00 | true     | true         | 0f00398f-3caa-4e16-a67f-ca6d42f61f4f |
| Debit Card - NEO | 2026-02-01 | Monthly Charges-Standard Plan                                   | 1.99   | 2026-03-16 17:04:07.39424+00  | false    | true         | 88ca1520-6970-4ca0-ad33-43179b412471 |
| Debit Card - NEO | 2026-02-01 | Monthly Charges-Standard Plan                                   | 1.99   | 2026-05-28 09:13:53.000569+00 | true     | true         | b5acafd6-b737-4810-bcf3-8a8cec331c9d |
| Debit Card - NEO | 2026-01-01 | Monthly Charges-Standard Plan                                   | 1.99   | 2026-03-16 17:04:07.181945+00 | false    | true         | 1229640d-28e2-434d-b507-633c0abf1cac |
| Debit Card - NEO | 2026-01-01 | Monthly Charges-Standard Plan                                   | 1.99   | 2026-05-28 09:13:52.758487+00 | true     | true         | 3b411c62-b433-49ca-a1ea-021997132376 |
| Debit Card - NEO | 2025-12-01 | Monthly Charges-Standard Plan                                   | 1.99   | 2025-12-02 16:33:23.311714+00 | false    | true         | aae13a35-88b7-4645-aeae-dba5eaa363dc |
| Debit Card - NEO | 2025-12-01 | Monthly Charges-Standard Plan                                   | 1.99   | 2026-05-28 09:13:52.56678+00  | true     | true         | 2633fb9a-5af0-4584-98f4-9ee875024be1 |
| Debit Card - NEO | 2025-11-01 | Monthly Charges-Standard Plan                                   | 1.99   | 2025-12-02 16:33:23.1312+00   | false    | true         | 0436be33-b38a-4f1b-97f7-f59a586e54e3 |
| Debit Card - NEO | 2025-11-01 | Monthly Charges-Standard Plan                                   | 1.99   | 2026-05-28 09:13:52.400723+00 | true     | true         | 8173fc83-18b4-4b81-b4f7-07e89696798c |
| Debit Card - NEO | 2025-10-01 | Monthly Charges-Standard Plan                                   | 1.99   | 2025-12-02 16:33:22.948354+00 | false    | true         | 1abe2056-1b68-4758-9291-61d0506faf7c |
| Debit Card - NEO | 2025-10-01 | Monthly Charges-Standard Plan                                   | 1.99   | 2026-05-28 09:13:52.25758+00  | true     | true         | 11a012f0-3697-4c34-a3d9-1dea036b608f |
| Debit Card - NEO | 2025-09-01 | Monthly Charges-Standard Plan                                   | 1.99   | 2025-12-02 16:33:22.717359+00 | false    | true         | 045d9f7d-c8ff-4de5-b50b-27bf9e118cab |
| Debit Card - NEO | 2025-09-01 | Monthly Charges-Standard Plan                                   | 1.99   | 2026-05-28 09:13:52.034869+00 | true     | true         | 9fdfbcfc-9e6f-45d6-b15a-35c21b086d87 |
