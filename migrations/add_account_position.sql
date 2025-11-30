-- Add position column to accounts table for drag-and-drop reordering
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

-- Create index for faster ordering
CREATE INDEX IF NOT EXISTS idx_accounts_user_position ON public.accounts(user_id, position);

-- Initialize positions based on current order (by inserted_at)
WITH ranked AS (
  SELECT id, user_id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY inserted_at) - 1 as new_position
  FROM public.accounts
)
UPDATE public.accounts a
SET position = r.new_position
FROM ranked r
WHERE a.id = r.id;
