-- Migration: Add Catalogue Items Reverse Link
-- This migration creates bi-directional linking between catalogue_items and items tables
-- Enables proper sync when editing/deleting from either side

-- ============================================
-- PHASE 1: ADD REVERSE FOREIGN KEY TO ITEMS
-- ============================================

-- Add source_catalogue_item_id to items table (reverse link)
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS source_catalogue_item_id uuid;

-- Add is_template_instance flag to identify items created from catalogue templates
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS is_template_instance boolean DEFAULT false;

-- Add foreign key constraint (ON DELETE SET NULL preserves calendar history when catalogue item deleted)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'items_source_catalogue_item_fkey'
  ) THEN
    ALTER TABLE public.items 
    ADD CONSTRAINT items_source_catalogue_item_fkey 
    FOREIGN KEY (source_catalogue_item_id) 
    REFERENCES public.catalogue_items(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for efficient reverse lookups
CREATE INDEX IF NOT EXISTS items_source_catalogue_item_idx 
  ON public.items(source_catalogue_item_id) 
  WHERE source_catalogue_item_id IS NOT NULL;

-- ============================================
-- PHASE 2: SYNC TRIGGER - ITEM DELETION
-- ============================================

-- When a calendar item is deleted, update the linked catalogue item
CREATE OR REPLACE FUNCTION sync_catalogue_on_item_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- If this item was linked to a catalogue item, reset the catalogue item's calendar flags
  IF OLD.source_catalogue_item_id IS NOT NULL THEN
    UPDATE public.catalogue_items
    SET 
      is_active_on_calendar = FALSE,
      linked_item_id = NULL,
      updated_at = NOW()
    WHERE id = OLD.source_catalogue_item_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists, then create
DROP TRIGGER IF EXISTS on_item_delete_sync_catalogue ON public.items;
CREATE TRIGGER on_item_delete_sync_catalogue
  BEFORE DELETE ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION sync_catalogue_on_item_delete();

-- ============================================
-- PHASE 3: SYNC TRIGGER - CATALOGUE DISABLE
-- ============================================

-- When catalogue item is disabled (is_active_on_calendar set to false), 
-- we need a function to handle the calendar item
-- This is called from the application, not automatically
CREATE OR REPLACE FUNCTION disable_catalogue_item_calendar(
  p_catalogue_item_id uuid,
  p_action text DEFAULT 'pause' -- 'pause' or 'delete_future'
)
RETURNS jsonb AS $$
DECLARE
  v_linked_item_id uuid;
  v_result jsonb;
BEGIN
  -- Get the linked item id
  SELECT linked_item_id INTO v_linked_item_id
  FROM public.catalogue_items
  WHERE id = p_catalogue_item_id;
  
  IF v_linked_item_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No linked calendar item found');
  END IF;
  
  IF p_action = 'pause' THEN
    -- Pause: Set end_until on recurrence rule to today
    UPDATE public.item_recurrence_rules
    SET end_until = CURRENT_DATE::text
    WHERE item_id = v_linked_item_id;
    
    -- Update catalogue item
    UPDATE public.catalogue_items
    SET 
      is_active_on_calendar = FALSE,
      updated_at = NOW()
    WHERE id = p_catalogue_item_id;
    
    v_result := jsonb_build_object(
      'success', true, 
      'action', 'paused',
      'item_id', v_linked_item_id
    );
    
  ELSIF p_action = 'delete_future' THEN
    -- Delete future: Remove future occurrences but keep the item (with past history)
    -- First, delete any future occurrence actions
    DELETE FROM public.item_occurrence_actions
    WHERE item_id = v_linked_item_id
    AND occurrence_date > NOW();
    
    -- Set end_until on recurrence
    UPDATE public.item_recurrence_rules
    SET end_until = CURRENT_DATE::text
    WHERE item_id = v_linked_item_id;
    
    -- Update catalogue item
    UPDATE public.catalogue_items
    SET 
      is_active_on_calendar = FALSE,
      updated_at = NOW()
    WHERE id = p_catalogue_item_id;
    
    v_result := jsonb_build_object(
      'success', true, 
      'action', 'deleted_future',
      'item_id', v_linked_item_id
    );
  ELSE
    v_result := jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PHASE 4: BACKFILL EXISTING DATA
-- ============================================

-- Backfill source_catalogue_item_id for existing linked items
-- This creates the reverse link from items back to catalogue_items
UPDATE public.items i
SET 
  source_catalogue_item_id = ci.id,
  is_template_instance = TRUE
FROM public.catalogue_items ci
WHERE ci.linked_item_id = i.id
  AND i.source_catalogue_item_id IS NULL;

-- Fix orphaned is_active_on_calendar flags
-- (catalogue items marked as active but with no valid linked item)
UPDATE public.catalogue_items
SET 
  is_active_on_calendar = FALSE,
  linked_item_id = NULL
WHERE is_active_on_calendar = TRUE 
  AND (
    linked_item_id IS NULL 
    OR NOT EXISTS (SELECT 1 FROM public.items WHERE id = linked_item_id)
  );

-- ============================================
-- PHASE 5: HELPER FUNCTIONS
-- ============================================

-- Function to get all calendar items linked to a catalogue item
CREATE OR REPLACE FUNCTION get_catalogue_linked_items(p_catalogue_item_id uuid)
RETURNS TABLE (
  item_id uuid,
  item_title text,
  item_type text,
  created_at timestamptz,
  has_future_occurrences boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.title,
    i.type::text,
    i.created_at,
    EXISTS (
      SELECT 1 FROM public.item_recurrence_rules irr
      WHERE irr.item_id = i.id
      AND (irr.end_until IS NULL OR irr.end_until::date > CURRENT_DATE)
    ) as has_future_occurrences
  FROM public.items i
  WHERE i.source_catalogue_item_id = p_catalogue_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync catalogue item updates to linked calendar items
CREATE OR REPLACE FUNCTION sync_catalogue_to_items(
  p_catalogue_item_id uuid,
  p_update_scope text DEFAULT 'future' -- 'future' or 'all'
)
RETURNS jsonb AS $$
DECLARE
  v_catalogue_item RECORD;
  v_updated_count integer := 0;
BEGIN
  -- Get the catalogue item
  SELECT * INTO v_catalogue_item
  FROM public.catalogue_items
  WHERE id = p_catalogue_item_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Catalogue item not found');
  END IF;
  
  -- Update all linked items
  UPDATE public.items
  SET 
    title = v_catalogue_item.name,
    description = v_catalogue_item.description,
    updated_at = NOW()
  WHERE source_catalogue_item_id = p_catalogue_item_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'scope', p_update_scope
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to promote a calendar item to catalogue template
CREATE OR REPLACE FUNCTION promote_item_to_catalogue(
  p_item_id uuid,
  p_module_id uuid,
  p_category_id uuid DEFAULT NULL,
  p_keep_linked boolean DEFAULT TRUE
)
RETURNS jsonb AS $$
DECLARE
  v_item RECORD;
  v_new_catalogue_id uuid;
  v_recurrence RECORD;
BEGIN
  -- Get the item
  SELECT * INTO v_item
  FROM public.items
  WHERE id = p_item_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item not found');
  END IF;
  
  -- Check if already linked to a catalogue item
  IF v_item.source_catalogue_item_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item is already linked to a catalogue template');
  END IF;
  
  -- Get recurrence info if exists
  SELECT * INTO v_recurrence
  FROM public.item_recurrence_rules
  WHERE item_id = p_item_id
  LIMIT 1;
  
  -- Create the catalogue item
  INSERT INTO public.catalogue_items (
    user_id,
    module_id,
    category_id,
    name,
    description,
    item_type,
    is_active_on_calendar,
    linked_item_id,
    recurrence_pattern,
    recurrence_custom_rrule,
    is_flexible_routine,
    flexible_period
  ) VALUES (
    v_item.user_id,
    p_module_id,
    p_category_id,
    v_item.title,
    v_item.description,
    v_item.type::text,
    p_keep_linked,
    CASE WHEN p_keep_linked THEN p_item_id ELSE NULL END,
    CASE 
      WHEN v_recurrence.is_flexible THEN 'custom'
      ELSE NULL
    END,
    v_recurrence.rrule,
    COALESCE(v_recurrence.is_flexible, FALSE),
    v_recurrence.flexible_period
  )
  RETURNING id INTO v_new_catalogue_id;
  
  -- If keeping linked, update the item with reverse link
  IF p_keep_linked THEN
    UPDATE public.items
    SET 
      source_catalogue_item_id = v_new_catalogue_id,
      is_template_instance = TRUE,
      updated_at = NOW()
    WHERE id = p_item_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'catalogue_item_id', v_new_catalogue_id,
    'linked', p_keep_linked
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PHASE 6: UPDATE ADD TO CALENDAR FUNCTION
-- ============================================

-- Helper function to use when adding catalogue item to calendar
-- Ensures bi-directional link is always created
CREATE OR REPLACE FUNCTION link_catalogue_to_item(
  p_catalogue_item_id uuid,
  p_item_id uuid
)
RETURNS void AS $$
BEGIN
  -- Update catalogue item with forward link
  UPDATE public.catalogue_items
  SET 
    linked_item_id = p_item_id,
    is_active_on_calendar = TRUE,
    updated_at = NOW()
  WHERE id = p_catalogue_item_id;
  
  -- Update item with reverse link
  UPDATE public.items
  SET 
    source_catalogue_item_id = p_catalogue_item_id,
    is_template_instance = TRUE,
    updated_at = NOW()
  WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN public.items.source_catalogue_item_id IS 'Reference to the catalogue template this item was created from';
COMMENT ON COLUMN public.items.is_template_instance IS 'True if this item is an instance of a catalogue template and should sync with it';
COMMENT ON FUNCTION sync_catalogue_on_item_delete IS 'Trigger function: Reset catalogue item flags when linked calendar item is deleted';
COMMENT ON FUNCTION disable_catalogue_item_calendar IS 'Disable a catalogue item''s calendar presence (pause or delete future)';
COMMENT ON FUNCTION get_catalogue_linked_items IS 'Get all calendar items linked to a specific catalogue item';
COMMENT ON FUNCTION sync_catalogue_to_items IS 'Sync catalogue item changes to all linked calendar items';
COMMENT ON FUNCTION promote_item_to_catalogue IS 'Promote a standalone calendar item to a catalogue template';
COMMENT ON FUNCTION link_catalogue_to_item IS 'Create bi-directional link between catalogue item and calendar item';
