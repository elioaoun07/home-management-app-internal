-- 2026-08-25 — Statement Import: fingerprint the transfers a statement creates.
--
-- WHY
-- ---
-- `transactions` has carried `statement_hash` + a unique index since the import
-- feature shipped, so re-importing a statement recognises every spend row it
-- already wrote. Transfers had NO such column: the fingerprint was recorded
-- only in the `statement_import_entries` ledger, which the reconciler never
-- reads. So on a re-import every transfer row (household transfer, cash
-- withdrawal to wallet, own-account FX exchange) came back as brand new, and
-- confirming it wrote the SAME money movement a second time — two balances
-- moved twice, with nothing anywhere to flag it.
--
-- This gives transfers the same identity backstop transactions already have.
--
-- The partial index excludes soft-deleted rows deliberately: a transfer can be
-- removed either by reverting its import or from the Transfers module, and in
-- both cases the statement row must become importable again. (`transactions`
-- gets the same effect a different way — its revert nulls `statement_hash`.)

BEGIN;

ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS statement_hash text;

-- Heal the history: the ledger already knows which transfer each statement row
-- produced. DISTINCT ON keeps only the FIRST transfer of any fingerprint that
-- was already imported twice, so the unique index below can be created; the
-- later copies stay hashless and are listed by the verification query at the
-- bottom for the owner to delete by hand.
WITH ranked AS (
  SELECT DISTINCT ON (t.user_id, e.statement_hash)
         t.id AS transfer_id,
         e.statement_hash
    FROM public.statement_import_entries e
    JOIN public.transfers t ON t.id = e.transfer_id
   WHERE e.action = 'create_transfer'
     AND e.statement_hash IS NOT NULL
     AND t.deleted_at IS NULL
     AND t.statement_hash IS NULL
   ORDER BY t.user_id, e.statement_hash, t.created_at, t.id
)
UPDATE public.transfers t
   SET statement_hash = r.statement_hash
  FROM ranked r
 WHERE t.id = r.transfer_id;

CREATE UNIQUE INDEX IF NOT EXISTS transfers_statement_hash_uniq
  ON public.transfers (user_id, statement_hash)
  WHERE statement_hash IS NOT NULL AND deleted_at IS NULL;

-- Reconciler lookup: "is any live transfer already carrying one of this
-- statement's fingerprints?"
CREATE INDEX IF NOT EXISTS idx_transfers_statement_hash
  ON public.transfers (user_id, statement_hash)
  WHERE statement_hash IS NOT NULL;

COMMIT;

-- ── Verification ───────────────────────────────────────────────────────────
-- 1. How many historical transfers got a fingerprint back:
--    select count(*) from public.transfers where statement_hash is not null;
--
-- 2. Duplicates that were already written before this migration (each group is
--    the same bank line imported twice — review and soft-delete the extras):
--    select e.statement_hash, count(*) as copies,
--           array_agg(t.id order by t.created_at) as transfer_ids,
--           min(t.date) as date, min(t.amount) as amount
--      from public.statement_import_entries e
--      join public.transfers t on t.id = e.transfer_id
--     where e.action = 'create_transfer' and t.deleted_at is null
--     group by e.statement_hash
--    having count(*) > 1;
