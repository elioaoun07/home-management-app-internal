-- Persist Budget AI structured reports so "View as Dashboard" survives history reloads.

ALTER TABLE public.ai_messages
ADD COLUMN IF NOT EXISTS analysis_report jsonb;
