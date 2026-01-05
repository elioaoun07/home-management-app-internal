-- Migration: Add occurrence_date to item_subtasks
-- This links each subtask to a specific occurrence of a recurring item
-- For non-recurring items, this will be NULL (subtasks apply to the single item)

-- Add occurrence_date column to item_subtasks
ALTER TABLE public.item_subtasks 
ADD COLUMN IF NOT EXISTS occurrence_date timestamp with time zone;

-- Add index for efficient querying by occurrence
CREATE INDEX IF NOT EXISTS item_subtasks_occurrence_date_idx 
ON public.item_subtasks(parent_item_id, occurrence_date);

-- Add comment
COMMENT ON COLUMN public.item_subtasks.occurrence_date IS 
'The occurrence date this subtask belongs to. NULL for non-recurring items.';
