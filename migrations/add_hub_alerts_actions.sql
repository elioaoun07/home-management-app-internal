-- Migration: Add actionable alerts support to hub_alerts
-- Enables alerts to have action buttons (e.g., transaction reminder Yes/No)

-- Add action_type and action_url columns to hub_alerts if they don't exist
DO $$ 
BEGIN
  -- Add action_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'hub_alerts' 
    AND column_name = 'action_type'
  ) THEN
    ALTER TABLE public.hub_alerts ADD COLUMN action_type text;
  END IF;
  
  -- Add action_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'hub_alerts' 
    AND column_name = 'action_url'
  ) THEN
    ALTER TABLE public.hub_alerts ADD COLUMN action_url text;
  END IF;
  
  -- Add metadata column for additional data
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'hub_alerts' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.hub_alerts ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;
END $$;

-- Comment on new columns
COMMENT ON COLUMN public.hub_alerts.action_type IS 'Type of actionable alert: transaction_reminder, budget_alert, etc.';
COMMENT ON COLUMN public.hub_alerts.action_url IS 'URL to navigate to when alert action is clicked';
COMMENT ON COLUMN public.hub_alerts.metadata IS 'Additional JSON data for the alert';

