-- Migration: Add item occurrence actions for tracking completion/postponement/cancellation
-- This enables tracking of actions on individual occurrences of recurring items

-- ============================================
-- ITEM OCCURRENCE ACTIONS TABLE
-- ============================================
-- Tracks actions taken on specific occurrences of items (especially recurring)
-- Each row represents an action on a specific date occurrence

CREATE TABLE IF NOT EXISTS public.item_occurrence_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  occurrence_date TIMESTAMPTZ NOT NULL, -- The specific occurrence date this action applies to
  action_type TEXT NOT NULL CHECK (action_type IN ('completed', 'postponed', 'cancelled', 'skipped')),
  
  -- For postponed items: where was it postponed to?
  postponed_to TIMESTAMPTZ,
  postpone_type TEXT CHECK (postpone_type IN ('next_occurrence', 'tomorrow', 'custom', 'ai_slot')),
  
  -- Optional reason for missing/postponing (especially for prayer meetings, etc.)
  reason TEXT,
  
  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Prevent duplicate actions on same occurrence
  UNIQUE(item_id, occurrence_date, action_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_item_occurrence_actions_item_id ON public.item_occurrence_actions(item_id);
CREATE INDEX IF NOT EXISTS idx_item_occurrence_actions_occurrence_date ON public.item_occurrence_actions(occurrence_date);
CREATE INDEX IF NOT EXISTS idx_item_occurrence_actions_action_type ON public.item_occurrence_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_item_occurrence_actions_created_at ON public.item_occurrence_actions(created_at);

-- Enable Row Level Security
ALTER TABLE public.item_occurrence_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage actions on their own items
CREATE POLICY "Users can manage their item occurrence actions"
  ON public.item_occurrence_actions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.items i 
      WHERE i.id = item_occurrence_actions.item_id 
      AND (i.user_id = auth.uid() OR i.responsible_user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.items i 
      WHERE i.id = item_occurrence_actions.item_id 
      AND (i.user_id = auth.uid() OR i.responsible_user_id = auth.uid())
    )
  );

-- ============================================
-- ITEM STATS VIEW
-- ============================================
-- Aggregate stats for items showing completion rates, streaks, etc.

CREATE OR REPLACE VIEW public.item_completion_stats AS
SELECT 
  i.id as item_id,
  i.user_id,
  i.title,
  i.type,
  COUNT(CASE WHEN a.action_type = 'completed' THEN 1 END) as completed_count,
  COUNT(CASE WHEN a.action_type = 'postponed' THEN 1 END) as postponed_count,
  COUNT(CASE WHEN a.action_type = 'cancelled' THEN 1 END) as cancelled_count,
  COUNT(CASE WHEN a.action_type = 'skipped' THEN 1 END) as skipped_count,
  COUNT(a.id) as total_actions,
  MAX(CASE WHEN a.action_type = 'completed' THEN a.created_at END) as last_completed_at
FROM public.items i
LEFT JOIN public.item_occurrence_actions a ON i.id = a.item_id
GROUP BY i.id, i.user_id, i.title, i.type;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE public.item_occurrence_actions IS 'Tracks actions (complete, postpone, cancel, skip) on specific occurrences of items, especially for recurring events';
COMMENT ON COLUMN public.item_occurrence_actions.occurrence_date IS 'The specific date/time of the occurrence this action applies to';
COMMENT ON COLUMN public.item_occurrence_actions.action_type IS 'Type of action: completed, postponed, cancelled, or skipped';
COMMENT ON COLUMN public.item_occurrence_actions.postponed_to IS 'For postponed items, the new date/time it was rescheduled to';
COMMENT ON COLUMN public.item_occurrence_actions.postpone_type IS 'How was it postponed: next_occurrence, tomorrow, custom time, or ai_slot';
COMMENT ON COLUMN public.item_occurrence_actions.reason IS 'Optional reason for the action (e.g., why a prayer meeting was missed)';
