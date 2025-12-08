-- Migration: Add Reminder Templates System
-- This migration adds reminder templates similar to transaction_templates
-- and changes the item type from 'note' to 'task'

-- ============================================
-- UPDATE ITEM TYPE ENUM
-- ============================================

-- Change 'note' to 'task' in item_type_enum
-- First, we need to rename the existing enum value
ALTER TYPE item_type_enum RENAME VALUE 'note' TO 'task';

-- ============================================
-- REMINDER TEMPLATES TABLE
-- ============================================

CREATE TABLE public.reminder_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])),
  item_type text NOT NULL DEFAULT 'task' CHECK (item_type = ANY (ARRAY['reminder'::text, 'event'::text, 'task'::text])),
  -- Duration/time fields
  default_duration_minutes integer,
  default_start_time time, -- e.g., '19:00' for 7pm
  -- Location
  location_text text,
  -- Metadata
  icon text DEFAULT 'clipboard-list'::text,
  color text DEFAULT '#38bdf8'::text,
  -- Tracking
  use_count integer NOT NULL DEFAULT 0,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reminder_templates_pkey PRIMARY KEY (id),
  CONSTRAINT reminder_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for common queries
CREATE INDEX reminder_templates_user_id_idx ON public.reminder_templates(user_id);
CREATE INDEX reminder_templates_item_type_idx ON public.reminder_templates(item_type);
CREATE INDEX reminder_templates_use_count_idx ON public.reminder_templates(use_count DESC);

-- Enable RLS
ALTER TABLE public.reminder_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own reminder templates"
  ON public.reminder_templates
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reminder templates"
  ON public.reminder_templates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminder templates"
  ON public.reminder_templates
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reminder templates"
  ON public.reminder_templates
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- HELPER FUNCTION
-- ============================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_reminder_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER reminder_templates_updated_at_trigger
  BEFORE UPDATE ON public.reminder_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_reminder_templates_updated_at();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.reminder_templates IS 'Templates for quickly creating reminders, events, and tasks';
COMMENT ON COLUMN public.reminder_templates.name IS 'Display name for the template (e.g., "Laundry")';
COMMENT ON COLUMN public.reminder_templates.title IS 'Default title for the created item';
COMMENT ON COLUMN public.reminder_templates.item_type IS 'Type of item to create: reminder, event, or task';
COMMENT ON COLUMN public.reminder_templates.default_duration_minutes IS 'Default duration in minutes (e.g., 90 for 1.5 hours)';
COMMENT ON COLUMN public.reminder_templates.default_start_time IS 'Default start time of day (e.g., 19:00)';
COMMENT ON COLUMN public.reminder_templates.use_count IS 'Number of times this template has been used';
