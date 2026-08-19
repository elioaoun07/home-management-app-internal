-- migrations/2026-08-18_statement-import-phase0-drift.sql
--
-- WHAT: Schema-drift reconciliation for statement import — no new objects.
--       Both indexes below ALREADY EXIST in the live DB (verified against
--       migrations/db-state.json 2026-08-18) but were missing from schema.sql,
--       which caused agents to reason wrongly about dedupe/upsert behavior.
--       1. transactions_statement_hash_uniq — dedupe backstop for statement
--          imports (the 23505 → "skipped duplicate" path in the import route).
--       2. merchant_mappings_unique_pattern — the (user_id, merchant_pattern)
--          uniqueness the import route's upsert onConflict relies on.
-- WHY:  Statement Import overhaul Phase 0 (BUD-11..15) — documenting the
--       constraints the code already depends on before building the
--       reconciliation engine on top of them.
-- RUN:  manually in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS);
--       expected outcome on the live DB: both statements are no-ops.

-- 1. Statement-hash dedupe (partial unique)
CREATE UNIQUE INDEX IF NOT EXISTS transactions_statement_hash_uniq
  ON public.transactions (user_id, statement_hash)
  WHERE statement_hash IS NOT NULL;

-- 2. Merchant-mapping upsert target
CREATE UNIQUE INDEX IF NOT EXISTS merchant_mappings_unique_pattern
  ON public.merchant_mappings (user_id, merchant_pattern);
