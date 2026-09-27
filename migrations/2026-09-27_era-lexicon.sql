-- migrations/2026-09-27_era-lexicon.sql
--
-- WHAT: public.era_lexicon — ERA's household lexicon (HUB-80, ERA Top Layer §4
--       component 10): per-person aliases, conditional defaults ("Always")
--       and corrected examples, with revocation ("Forget").
-- WHY:  replaces phrase-template learning (era_templates, now frozen) with
--       rules that re-bind actor/focus/clock/permissions every turn.
-- RLS:  user-owned table → direct user_id = auth.uid() policies for every
--       command (db-migration tree, first branch). Personal by default: the
--       partner never reads or inherits another person's rules.
-- RUN:  manually in the Supabase SQL Editor. Safe to re-run.

-- 1. Table
CREATE TABLE IF NOT EXISTS public.era_lexicon (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['alias'::text, 'default'::text, 'example'::text])),
  -- The capability the rule serves, e.g. 'transfer.create'.
  capability text NOT NULL,
  -- alias: the spoken phrase (normalized); default/example: the slot filled.
  phrase text,
  slot text,
  -- Condition the rule applies under, e.g. {"from": "<accountId>"}.
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- The value it supplies, e.g. {"accountId": "<id>", "name": "Wallet"}.
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Entity ids the rule depends on; re-validated every turn (deleted
  -- account / lost access / unlink makes the rule inert).
  depends_on uuid[] NOT NULL DEFAULT '{}'::uuid[],
  source_message_id uuid,
  use_count integer NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  last_used_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT era_lexicon_pkey PRIMARY KEY (id),
  CONSTRAINT era_lexicon_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT era_lexicon_source_message_id_fkey FOREIGN KEY (source_message_id) REFERENCES public.era_messages(id) ON DELETE SET NULL
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS era_lexicon_user_capability_idx
  ON public.era_lexicon (user_id, capability)
  WHERE revoked_at IS NULL;

-- One live default per (person, capability, slot, condition).
CREATE UNIQUE INDEX IF NOT EXISTS era_lexicon_live_default_uidx
  ON public.era_lexicon (user_id, capability, slot, conditions)
  WHERE kind = 'default' AND revoked_at IS NULL;

-- 3. RLS — owner only, every command.
ALTER TABLE public.era_lexicon ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'era_lexicon' AND policyname = 'era_lexicon_self'
  ) THEN
    CREATE POLICY era_lexicon_self ON public.era_lexicon
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Verify (read-only; paste the output back):
-- select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public' and relname = 'era_lexicon';
-- select policyname, permissive, cmd, qual, with_check from pg_policies
--  where schemaname = 'public' and tablename = 'era_lexicon';
