-- Migration: Add total_tokens generated column to ai_messages
-- This column auto-calculates input_tokens + output_tokens for easy querying

-- Add total_tokens as a generated column (computed automatically)
ALTER TABLE public.ai_messages
ADD COLUMN IF NOT EXISTS total_tokens integer GENERATED ALWAYS AS (COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) STORED;

-- Create index for efficient monthly usage queries
CREATE INDEX IF NOT EXISTS idx_ai_messages_user_created_tokens 
ON public.ai_messages(user_id, created_at) 
WHERE is_active = true;

-- Add comment for documentation
COMMENT ON COLUMN public.ai_messages.total_tokens IS 'Auto-calculated sum of input_tokens + output_tokens';
