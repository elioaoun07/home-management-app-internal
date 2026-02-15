-- Migration: Add notify_all_household column to items
-- Purpose: Allow items to send notifications to all household members (both partners)
-- When notify_all_household is TRUE, alerts are sent to both the owner and partner

-- Add the column with default FALSE (backwards compatible)
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS notify_all_household BOOLEAN NOT NULL DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN public.items.notify_all_household IS 
  'When TRUE, alerts for this item are sent to ALL household members (both partners), not just the responsible_user_id';

-- Create an index for efficient filtering when processing alerts
CREATE INDEX IF NOT EXISTS idx_items_notify_all_household 
  ON public.items(notify_all_household) 
  WHERE notify_all_household = TRUE;
