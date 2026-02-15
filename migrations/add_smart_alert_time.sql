-- Migration: Add Smart Alert Time Support
-- Allows alerts to be set as "X days before at specific time"
-- e.g., "1 day before at 9:00 AM" instead of just "1440 minutes before"

-- Add custom_time column to item_alerts
-- When set, the alert fires at this specific time instead of calculated offset
ALTER TABLE public.item_alerts ADD COLUMN IF NOT EXISTS custom_time TIME;

-- Add comment explaining the field
COMMENT ON COLUMN public.item_alerts.custom_time IS 
  'When set with relative alerts, fires at this specific time on the calculated day. '
  'E.g., offset_minutes=1440 (1 day) + custom_time=09:00 means "1 day before at 9am"';

-- Create index for queries that filter by custom_time
CREATE INDEX IF NOT EXISTS idx_item_alerts_custom_time 
  ON public.item_alerts (custom_time) 
  WHERE custom_time IS NOT NULL;
