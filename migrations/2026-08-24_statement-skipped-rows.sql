-- migrations/2026-08-24_statement-skipped-rows.sql
--
-- WHAT: remember which statement rows the owner deliberately skipped, keyed by
--       the row fingerprint.
-- WHY:  a skip is a durable decision about a specific bank row ("this is not a
--       transaction"), not a fact about one upload. Without this, re-uploading
--       the same period — the whole point of the idempotent-import work — makes
--       the owner re-skip the same rows every time.
--
-- Keyed on `statement_hash`, NOT on the file, so the decision survives a wider
-- re-upload (one month vs. a full year) and a re-downloaded PDF.
--
-- Deliberately NOT part of `statement_import_entries`: reverting an import
-- should not silently un-skip rows the owner ruled on separately.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.statement_skipped_rows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  -- The v2 fingerprint of the skipped row.
  statement_hash text NOT NULL,
  -- Context for the UI so a skip can be recognised without re-parsing a file.
  account_id uuid,
  description text,
  amount numeric,
  row_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT statement_skipped_rows_pkey PRIMARY KEY (id),
  CONSTRAINT statement_skipped_rows_user_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT statement_skipped_rows_account_fkey
    FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL,
  -- One decision per row. Re-skipping is an upsert, never a second row.
  CONSTRAINT statement_skipped_rows_uniq UNIQUE (user_id, statement_hash)
);

-- RLS with a DENORMALIZED user_id and a direct predicate — never an
-- EXISTS-subquery policy (Hard Rule #20). Reconcile hits this table on every
-- import, so the check has to be an index lookup, not a join per row.
ALTER TABLE public.statement_skipped_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS statement_skipped_rows_select ON public.statement_skipped_rows;
CREATE POLICY statement_skipped_rows_select ON public.statement_skipped_rows
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS statement_skipped_rows_insert ON public.statement_skipped_rows;
CREATE POLICY statement_skipped_rows_insert ON public.statement_skipped_rows
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS statement_skipped_rows_delete ON public.statement_skipped_rows;
CREATE POLICY statement_skipped_rows_delete ON public.statement_skipped_rows
  FOR DELETE USING (user_id = auth.uid());

-- VERIFY:
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'statement_skipped_rows';   -- true
--   SELECT policyname, cmd, qual FROM pg_policies
--    WHERE tablename = 'statement_skipped_rows';                                    -- 3 rows
--   SELECT count(*) FROM public.statement_skipped_rows;                             -- 0

-- ROLLBACK:
--   DROP TABLE IF EXISTS public.statement_skipped_rows;
