-- Migration: Add Catalogue Tasks to Calendar Link System
-- This migration extends the catalogue system to support task templates
-- that can be converted to recurring calendar items

-- ============================================
-- EXTEND CATALOGUE_ITEMS FOR TASK TEMPLATES
-- ============================================

-- Add task-specific columns to catalogue_items
ALTER TABLE public.catalogue_items ADD COLUMN IF NOT EXISTS item_type text DEFAULT 'task' CHECK (item_type IS NULL OR item_type = ANY (ARRAY['reminder'::text, 'event'::text, 'task'::text]));
ALTER TABLE public.catalogue_items ADD COLUMN IF NOT EXISTS location_context text CHECK (location_context IS NULL OR location_context = ANY (ARRAY['home'::text, 'outside'::text, 'anywhere'::text]));
ALTER TABLE public.catalogue_items ADD COLUMN IF NOT EXISTS location_url text;
ALTER TABLE public.catalogue_items ADD COLUMN IF NOT EXISTS preferred_time time without time zone;
ALTER TABLE public.catalogue_items ADD COLUMN IF NOT EXISTS preferred_duration_minutes integer;
ALTER TABLE public.catalogue_items ADD COLUMN IF NOT EXISTS recurrence_pattern text CHECK (recurrence_pattern IS NULL OR recurrence_pattern = ANY (ARRAY['daily'::text, 'weekly'::text, 'biweekly'::text, 'monthly'::text, 'quarterly'::text, 'yearly'::text, 'custom'::text]));
ALTER TABLE public.catalogue_items ADD COLUMN IF NOT EXISTS recurrence_custom_rrule text;
ALTER TABLE public.catalogue_items ADD COLUMN IF NOT EXISTS recurrence_days_of_week integer[] DEFAULT '{}';
ALTER TABLE public.catalogue_items ADD COLUMN IF NOT EXISTS subtasks_text text;
ALTER TABLE public.catalogue_items ADD COLUMN IF NOT EXISTS is_active_on_calendar boolean DEFAULT false;
ALTER TABLE public.catalogue_items ADD COLUMN IF NOT EXISTS linked_item_id uuid;
-- Category multi-select (array of item category IDs)
ALTER TABLE public.catalogue_items ADD COLUMN IF NOT EXISTS item_category_ids text[] DEFAULT '{}';
-- Visibility: public (available to household members) or private (only the owner)
ALTER TABLE public.catalogue_items ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

-- Add foreign key for linked_item_id (links to items table)
ALTER TABLE public.catalogue_items ADD CONSTRAINT catalogue_items_linked_item_fkey 
  FOREIGN KEY (linked_item_id) REFERENCES public.items(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS catalogue_items_linked_item_idx ON public.catalogue_items(linked_item_id) WHERE linked_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS catalogue_items_location_context_idx ON public.catalogue_items(location_context) WHERE location_context IS NOT NULL;
CREATE INDEX IF NOT EXISTS catalogue_items_is_active_calendar_idx ON public.catalogue_items(is_active_on_calendar) WHERE is_active_on_calendar = true;

-- ============================================
-- CATALOGUE ITEM CALENDAR HISTORY
-- ============================================

-- Track calendar additions/removals for catalogue items
CREATE TABLE IF NOT EXISTS public.catalogue_item_calendar_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  catalogue_item_id uuid NOT NULL,
  item_id uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type = ANY (ARRAY['added_to_calendar'::text, 'removed_from_calendar'::text, 'updated_recurrence'::text, 'paused'::text, 'resumed'::text])),
  recurrence_start_date date,
  recurrence_end_date date,
  recurrence_pattern text,
  recurrence_rrule text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT catalogue_item_calendar_history_pkey PRIMARY KEY (id),
  CONSTRAINT cich_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT cich_catalogue_item_fkey FOREIGN KEY (catalogue_item_id) REFERENCES public.catalogue_items(id) ON DELETE CASCADE,
  CONSTRAINT cich_item_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS cich_catalogue_item_idx ON public.catalogue_item_calendar_history(catalogue_item_id);
CREATE INDEX IF NOT EXISTS cich_item_idx ON public.catalogue_item_calendar_history(item_id);
CREATE INDEX IF NOT EXISTS cich_user_idx ON public.catalogue_item_calendar_history(user_id);

-- ============================================
-- EXTEND ITEM_SUBTASKS FOR OCCURRENCE TRACKING
-- ============================================

-- Ensure the occurrence_date column exists (for tracking which occurrence a subtask completion belongs to)
-- This is already in schema but ensure it exists
ALTER TABLE public.item_subtasks ADD COLUMN IF NOT EXISTS occurrence_date timestamp with time zone;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS on catalogue_item_calendar_history
ALTER TABLE public.catalogue_item_calendar_history ENABLE ROW LEVEL SECURITY;

-- Users can only see their own history
CREATE POLICY "Users can view their own catalogue calendar history"
  ON public.catalogue_item_calendar_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own catalogue calendar history"
  ON public.catalogue_item_calendar_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own catalogue calendar history"
  ON public.catalogue_item_calendar_history
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own catalogue calendar history"
  ON public.catalogue_item_calendar_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES FOR CATALOGUE_ITEMS VISIBILITY
-- ============================================

-- Drop existing policies if they exist (to recreate with visibility support)
DROP POLICY IF EXISTS "Users can view own catalogue items" ON public.catalogue_items;
DROP POLICY IF EXISTS "Users can view household public catalogue items" ON public.catalogue_items;
DROP POLICY IF EXISTS "Catalogue items visibility policy" ON public.catalogue_items;

-- Enable RLS (if not already enabled)
ALTER TABLE public.catalogue_items ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can see their own items OR public items from household members
CREATE POLICY "Catalogue items visibility policy"
  ON public.catalogue_items
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      is_public = true
      AND EXISTS (
        SELECT 1 FROM public.household_members hm
        WHERE hm.user_id = auth.uid()
          AND hm.household_id = (
            SELECT hm2.household_id 
            FROM public.household_members hm2 
            WHERE hm2.user_id = catalogue_items.user_id
          )
      )
    )
  );

-- INSERT: Users can only insert their own items
CREATE POLICY "Users can insert own catalogue items"
  ON public.catalogue_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can only update their own items
CREATE POLICY "Users can update own catalogue items"
  ON public.catalogue_items
  FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE: Users can only delete their own items
CREATE POLICY "Users can delete own catalogue items"
  ON public.catalogue_items
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for efficient visibility lookups
CREATE INDEX IF NOT EXISTS catalogue_items_is_public_idx ON public.catalogue_items(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS catalogue_items_item_category_ids_idx ON public.catalogue_items USING GIN(item_category_ids) WHERE item_category_ids IS NOT NULL AND array_length(item_category_ids, 1) > 0;

-- ============================================
-- HELPER FUNCTION: Generate RRULE from pattern
-- ============================================

CREATE OR REPLACE FUNCTION generate_rrule_from_pattern(
  p_pattern text,
  p_days_of_week integer[] DEFAULT NULL,
  p_custom_rrule text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- If custom rrule provided, return it
  IF p_custom_rrule IS NOT NULL AND p_custom_rrule != '' THEN
    RETURN p_custom_rrule;
  END IF;
  
  CASE p_pattern
    WHEN 'daily' THEN
      RETURN 'FREQ=DAILY';
    WHEN 'weekly' THEN
      IF p_days_of_week IS NOT NULL AND array_length(p_days_of_week, 1) > 0 THEN
        -- Convert days to RRULE format (0=Sunday, 1=Monday, etc.)
        RETURN 'FREQ=WEEKLY;BYDAY=' || (
          SELECT string_agg(
            CASE d
              WHEN 0 THEN 'SU'
              WHEN 1 THEN 'MO'
              WHEN 2 THEN 'TU'
              WHEN 3 THEN 'WE'
              WHEN 4 THEN 'TH'
              WHEN 5 THEN 'FR'
              WHEN 6 THEN 'SA'
            END, ','
          )
          FROM unnest(p_days_of_week) AS d
        );
      ELSE
        RETURN 'FREQ=WEEKLY';
      END IF;
    WHEN 'biweekly' THEN
      IF p_days_of_week IS NOT NULL AND array_length(p_days_of_week, 1) > 0 THEN
        -- Convert days to RRULE format with INTERVAL=2
        RETURN 'FREQ=WEEKLY;INTERVAL=2;BYDAY=' || (
          SELECT string_agg(
            CASE d
              WHEN 0 THEN 'SU'
              WHEN 1 THEN 'MO'
              WHEN 2 THEN 'TU'
              WHEN 3 THEN 'WE'
              WHEN 4 THEN 'TH'
              WHEN 5 THEN 'FR'
              WHEN 6 THEN 'SA'
            END, ','
          )
          FROM unnest(p_days_of_week) AS d
        );
      ELSE
        RETURN 'FREQ=WEEKLY;INTERVAL=2';
      END IF;
    WHEN 'monthly' THEN
      RETURN 'FREQ=MONTHLY';
    WHEN 'quarterly' THEN
      RETURN 'FREQ=MONTHLY;INTERVAL=3';
    WHEN 'yearly' THEN
      RETURN 'FREQ=YEARLY';
    ELSE
      RETURN NULL;
  END CASE;
END;
$$;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN public.catalogue_items.item_type IS 'Type of item when added to calendar: reminder, event, or task';
COMMENT ON COLUMN public.catalogue_items.location_context IS 'Where this task is typically performed: home, outside, or anywhere';
COMMENT ON COLUMN public.catalogue_items.location_url IS 'Optional Google Maps or location URL';
COMMENT ON COLUMN public.catalogue_items.preferred_time IS 'Preferred time of day for this recurring task';
COMMENT ON COLUMN public.catalogue_items.preferred_duration_minutes IS 'Expected duration in minutes';
COMMENT ON COLUMN public.catalogue_items.recurrence_pattern IS 'High-level recurrence pattern';
COMMENT ON COLUMN public.catalogue_items.recurrence_custom_rrule IS 'Custom iCal RRULE if pattern is custom';
COMMENT ON COLUMN public.catalogue_items.recurrence_days_of_week IS 'Days of week for weekly recurrence (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN public.catalogue_items.subtasks_text IS 'Bullet-point subtasks as text (converted to actual subtasks when added to calendar)';
COMMENT ON COLUMN public.catalogue_items.is_active_on_calendar IS 'Whether this item is currently active on the calendar';
COMMENT ON COLUMN public.catalogue_items.linked_item_id IS 'Reference to the active calendar item (items table)';
COMMENT ON COLUMN public.catalogue_items.item_category_ids IS 'Array of item category IDs (multi-select categories like personal, work, home, etc.)';
COMMENT ON COLUMN public.catalogue_items.is_public IS 'Visibility: true = visible to all household members, false = private (only owner)';
COMMENT ON TABLE public.catalogue_item_calendar_history IS 'History of calendar additions/removals for catalogue items';
