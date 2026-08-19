-- migrations/2026-08-19_statement-import-rollback.sql
--
-- WHAT: Make a statement import a first-class, reversible record.
--       1. statement_imports grows the context a revert needs (which account,
--          which file fingerprint, per-action counts, the balance deltas it
--          applied, the merchant mappings it overwrote) + a 'reverted' status.
--       2. NEW statement_import_entries — the per-row ledger. One row per
--          transaction the commit touched, carrying BOTH the prior state
--          (`previous`) and the state it wrote (`applied`), so a revert can
--          restore exactly and can detect a row the user edited since.
--       3. UPDATE policy on statement_imports — it had SELECT + INSERT only
--          (verified in migrations/db-state.json 2026-08-04), so marking an
--          import reverted would have silently affected 0 rows under RLS.
-- WHY:  BUD-23 — bulk imports were one-way. A mis-categorized 70-row statement
--       could only be unpicked transaction by transaction, and stamping/draft
--       confirmation left no trace of what the row looked like before.
-- RUN:  manually in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS /
--       IF EXISTS guards + DO blocks throughout).

-- ───────────────────────────────────────────────────────────────────────────
-- 1. statement_imports — carry enough context to reverse the whole batch
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.statement_imports
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS statement_id text,
  ADD COLUMN IF NOT EXISTS created_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stamped_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drafts_confirmed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_count integer NOT NULL DEFAULT 0,
  -- { "<account_id>": <signed delta applied at commit> } — informational; the
  -- revert recomputes from live row state rather than trusting these.
  ADD COLUMN IF NOT EXISTS balance_deltas jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- [ { pattern, applied: {...}, previous: {...} | null } ] — what the import
  -- taught the merchant map, and what was there before it.
  ADD COLUMN IF NOT EXISTS learned_mappings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reverted_at timestamp with time zone;

-- 'reverted' / 'partially_reverted' are new terminal states. The original
-- constraint was created inline, so Postgres named it statement_imports_status_check.
ALTER TABLE public.statement_imports
  DROP CONSTRAINT IF EXISTS statement_imports_status_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'statement_imports_status_check'
       AND conrelid = 'public.statement_imports'::regclass
  ) THEN
    ALTER TABLE public.statement_imports
      ADD CONSTRAINT statement_imports_status_check
      CHECK (status = ANY (ARRAY[
        'pending'::text,
        'processing'::text,
        'completed'::text,
        'failed'::text,
        'reverted'::text,
        'partially_reverted'::text
      ]));
  END IF;
END $$;

-- The history list is "my imports, newest first".
CREATE INDEX IF NOT EXISTS idx_statement_imports_user_imported_at
  ON public.statement_imports (user_id, imported_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. statement_import_entries — the per-row ledger a revert replays backwards
-- ───────────────────────────────────────────────────────────────────────────
--
-- `previous` / `applied` shape per action:
--   create        previous {}                                    applied { amount, is_debt_return }
--   stamp         previous { amount, statement_hash: null }      applied { amount, statement_hash }
--   confirm_draft previous { amount, is_draft: true,             applied { amount, statement_hash,
--                            category_id, subcategory_id,                  category_id, subcategory_id }
--                            statement_hash: null }
--
-- transaction_id is ON DELETE SET NULL, not CASCADE: if the row is hard-purged
-- (Recycle Bin "empty"), the ledger entry must survive as the record that the
-- import happened — it just becomes un-revertible, which the API reports.

CREATE TABLE IF NOT EXISTS public.statement_import_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL,
  -- Denormalized from statement_imports so RLS is a direct
  -- `user_id = auth.uid()` compare, never an EXISTS subquery (Hard Rule #20).
  user_id uuid NOT NULL,
  row_id text NOT NULL,
  action text NOT NULL CHECK (action = ANY (ARRAY['create'::text, 'stamp'::text, 'confirm_draft'::text])),
  transaction_id uuid,
  account_id uuid NOT NULL,
  statement_hash text NOT NULL,
  -- Signed balance delta this entry applied at commit time.
  applied_delta numeric NOT NULL DEFAULT 0,
  previous jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied jsonb NOT NULL DEFAULT '{}'::jsonb,
  reverted_at timestamp with time zone,
  -- 'reverted' | 'gone' | 'drifted' | 'already_undone' — why a revert skipped it.
  revert_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT statement_import_entries_pkey PRIMARY KEY (id),
  CONSTRAINT statement_import_entries_import_id_fkey FOREIGN KEY (import_id)
    REFERENCES public.statement_imports(id) ON DELETE CASCADE,
  CONSTRAINT statement_import_entries_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users(id),
  CONSTRAINT statement_import_entries_transaction_id_fkey FOREIGN KEY (transaction_id)
    REFERENCES public.transactions(id) ON DELETE SET NULL,
  CONSTRAINT statement_import_entries_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES public.accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_statement_import_entries_import
  ON public.statement_import_entries (import_id);

CREATE INDEX IF NOT EXISTS idx_statement_import_entries_user
  ON public.statement_import_entries (user_id);

-- One entry per (import, row) — makes a retried commit idempotent at the
-- ledger level instead of appending a second copy of the same action.
CREATE UNIQUE INDEX IF NOT EXISTS statement_import_entries_import_row_uniq
  ON public.statement_import_entries (import_id, row_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. RLS
-- ───────────────────────────────────────────────────────────────────────────
--
-- Statement imports are strictly personal — each household member reconciles
-- their own bank statements, and the reconcile route already refuses accounts
-- the caller does not own. So: own-rows-only, no household_links clause.

ALTER TABLE public.statement_import_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                  AND tablename='statement_import_entries'
                  AND policyname='Users can view own statement import entries') THEN
    CREATE POLICY "Users can view own statement import entries"
      ON public.statement_import_entries FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                  AND tablename='statement_import_entries'
                  AND policyname='Users can insert own statement import entries') THEN
    CREATE POLICY "Users can insert own statement import entries"
      ON public.statement_import_entries FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                  AND tablename='statement_import_entries'
                  AND policyname='Users can update own statement import entries') THEN
    CREATE POLICY "Users can update own statement import entries"
      ON public.statement_import_entries FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                  AND tablename='statement_import_entries'
                  AND policyname='Users can delete own statement import entries') THEN
    CREATE POLICY "Users can delete own statement import entries"
      ON public.statement_import_entries FOR DELETE
      USING (auth.uid() = user_id);
  END IF;

  -- statement_imports had SELECT + INSERT only. Without this, marking an
  -- import 'reverted' updates 0 rows and reports success — RLS never errors.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                  AND tablename='statement_imports'
                  AND policyname='Users can update own statement imports') THEN
    CREATE POLICY "Users can update own statement imports"
      ON public.statement_imports FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Verification (run after, expect the described output)
-- ───────────────────────────────────────────────────────────────────────────
--
-- select column_name from information_schema.columns
--  where table_name='statement_imports' order by ordinal_position;
--   → includes account_id, statement_id, *_count, balance_deltas,
--     learned_mappings, reverted_at
--
-- select relname, relrowsecurity from pg_class c
--   join pg_namespace n on n.oid=c.relnamespace
--  where n.nspname='public' and relname='statement_import_entries';
--   → relrowsecurity = true
--
-- select policyname, cmd from pg_policies
--  where schemaname='public'
--    and tablename in ('statement_imports','statement_import_entries')
--  order by tablename, cmd;
--   → statement_imports: INSERT, SELECT, UPDATE
--   → statement_import_entries: DELETE, INSERT, SELECT, UPDATE
