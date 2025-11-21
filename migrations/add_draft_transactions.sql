-- Add draft transaction support for voice entries
-- Run this in Supabase SQL Editor

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_transcript text,
ADD COLUMN IF NOT EXISTS confidence_score numeric(3,2);

-- Make category_id and subcategory_id nullable for drafts
ALTER TABLE public.transactions 
ALTER COLUMN category_id DROP NOT NULL,
ALTER COLUMN subcategory_id DROP NOT NULL;

-- Add constraint: if not draft, category_id must be set
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_category_required_if_not_draft 
CHECK (is_draft = true OR category_id IS NOT NULL);

-- Index for quickly fetching drafts
CREATE INDEX IF NOT EXISTS transactions_is_draft_idx ON public.transactions(user_id, is_draft) WHERE is_draft = true;

-- Comment for documentation
COMMENT ON COLUMN public.transactions.is_draft IS 'True if transaction was created via voice and needs review/confirmation';
COMMENT ON COLUMN public.transactions.voice_transcript IS 'Original voice input text for reference';
COMMENT ON COLUMN public.transactions.confidence_score IS 'NLP confidence 0-1 for category matching';
