-- Migration: Add indexes and constraints for category customization
-- Date: 2025-11-24

-- Add index for faster category ordering queries
CREATE INDEX IF NOT EXISTS idx_user_categories_position 
ON public.user_categories(user_id, account_id, position) 
WHERE visible = true;

-- Add index for parent-child relationships
CREATE INDEX IF NOT EXISTS idx_user_categories_parent 
ON public.user_categories(parent_id) 
WHERE parent_id IS NOT NULL;

-- Ensure color field has proper default
ALTER TABLE public.user_categories 
ALTER COLUMN color SET DEFAULT '#38bdf8';

-- Add check constraint for position (must be non-negative)
ALTER TABLE public.user_categories 
DROP CONSTRAINT IF EXISTS check_position_nonnegative;

ALTER TABLE public.user_categories 
ADD CONSTRAINT check_position_nonnegative 
CHECK (position >= 0);

-- Comment on columns
COMMENT ON COLUMN public.user_categories.position IS 'Order position for display (0-based). Lower values appear first.';
COMMENT ON COLUMN public.user_categories.color IS 'Hex color code for category display (e.g., #38bdf8)';
COMMENT ON COLUMN public.user_categories.visible IS 'Whether this category is visible to the user. Hidden categories are not shown in UI but are preserved for historical transactions.';
