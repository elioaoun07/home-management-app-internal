-- 2026-06-26: Budget AI suggestion transparency metadata
-- Adds columns so each stored AI budget suggestion records how it was produced
-- (LLM vs. statistical estimate fallback), a short human summary, and how many
-- one-off outlier transactions were filtered out of the spend history.
-- Run manually in the Supabase SQL Editor.

ALTER TABLE public.ai_budget_suggestions
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS generation_method text
    CHECK (generation_method IS NULL OR generation_method = ANY (ARRAY['ai'::text, 'estimate'::text])),
  ADD COLUMN IF NOT EXISTS excluded_outlier_count integer NOT NULL DEFAULT 0;
