-- migrations/2026-08-24_statement-import-rekey-action.sql
--
-- WHAT: allow 'rekey' as a statement_import_entries.action.
-- WHY:  re-importing a statement now UPGRADES an outdated fingerprint on a row
--       the fuzzy duplicate tier recognised (v1 -> v2), so the next import
--       matches it by identity instead of by resemblance. That write needs a
--       ledger entry like every other, or it would not be revertible.
--
-- WITHOUT THIS MIGRATION the feature is not merely absent — it BREAKS the
-- import: the ledger is written as one batch, the CHECK rejects the 'rekey'
-- row, and the commit route returns 503 having changed nothing. Run this
-- BEFORE re-importing any statement.
--
-- Safe to re-run. No data is modified; the constraint is only widened, so no
-- existing row can violate it.

ALTER TABLE public.statement_import_entries
  DROP CONSTRAINT IF EXISTS statement_import_entries_action_check;

ALTER TABLE public.statement_import_entries
  ADD CONSTRAINT statement_import_entries_action_check
  CHECK (action = ANY (ARRAY[
    'create'::text,
    'stamp'::text,
    'confirm_draft'::text,
    'rekey'::text
  ]));

-- VERIFY — expect the four values listed in the constraint body:
  SELECT pg_get_constraintdef(oid)
  FROM pg_constraint
  WHERE conname = 'statement_import_entries_action_check';

| pg_get_constraintdef                                                                                |
| --------------------------------------------------------------------------------------------------- |
| CHECK ((action = ANY (ARRAY['create'::text, 'stamp'::text, 'confirm_draft'::text, 'rekey'::text]))) |

-- ROLLBACK (only if no 'rekey' entries exist yet — check first):
  SELECT count(*) FROM public.statement_import_entries WHERE action = 'rekey';

| count |
| ----- |
| 0     |

[BELOW QUERY CANCELLED]
  -- ALTER TABLE public.statement_import_entries
  --   DROP CONSTRAINT statement_import_entries_action_check;
  -- ALTER TABLE public.statement_import_entries
  --   ADD CONSTRAINT statement_import_entries_action_check
  --   CHECK (action = ANY (ARRAY['create'::text,'stamp'::text,'confirm_draft'::text]));
