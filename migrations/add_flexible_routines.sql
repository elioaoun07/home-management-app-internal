-- Migration: Add flexible routines support
-- Enables recurring tasks without fixed days - user schedules them within a period (weekly/biweekly/monthly)

-- ============================================
-- EXTEND ITEM_RECURRENCE_RULES
-- ============================================

-- Add flexible recurrence columns
ALTER TABLE public.item_recurrence_rules 
ADD COLUMN IF NOT EXISTS is_flexible BOOLEAN DEFAULT FALSE;

ALTER TABLE public.item_recurrence_rules 
ADD COLUMN IF NOT EXISTS flexible_period TEXT CHECK (flexible_period IN ('weekly', 'biweekly', 'monthly'));

-- Index for flexible items lookup
CREATE INDEX IF NOT EXISTS idx_item_recurrence_rules_is_flexible 
ON public.item_recurrence_rules(is_flexible) 
WHERE is_flexible = TRUE;

COMMENT ON COLUMN public.item_recurrence_rules.is_flexible IS 'If true, this recurring item has no fixed day - user schedules it within each period';
COMMENT ON COLUMN public.item_recurrence_rules.flexible_period IS 'For flexible items: the period within which the task must be done (weekly, biweekly, monthly)';

-- ============================================
-- ITEM FLEXIBLE SCHEDULES TABLE
-- ============================================
-- Tracks when user schedules a flexible task for a specific period

CREATE TABLE IF NOT EXISTS public.item_flexible_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  
  -- The period this schedule belongs to (start of week/biweek/month)
  period_start_date DATE NOT NULL,
  
  -- When the user scheduled this task
  scheduled_for_date DATE NOT NULL,
  scheduled_for_time TIME, -- Optional time, NULL means "anytime that day"
  
  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Prevent duplicate schedules for same item in same period
  UNIQUE(item_id, period_start_date)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_item_flexible_schedules_item_id 
ON public.item_flexible_schedules(item_id);

CREATE INDEX IF NOT EXISTS idx_item_flexible_schedules_period 
ON public.item_flexible_schedules(period_start_date);

CREATE INDEX IF NOT EXISTS idx_item_flexible_schedules_scheduled_date 
ON public.item_flexible_schedules(scheduled_for_date);

-- Enable RLS
ALTER TABLE public.item_flexible_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage schedules for their own items
CREATE POLICY "Users can manage their flexible schedules"
ON public.item_flexible_schedules
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = item_flexible_schedules.item_id
    AND (i.user_id = auth.uid() OR i.responsible_user_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = item_flexible_schedules.item_id
    AND (i.user_id = auth.uid() OR i.responsible_user_id = auth.uid())
  )
);

-- Household members can view shared flexible schedules
CREATE POLICY "Household can view shared flexible schedules"
ON public.item_flexible_schedules
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = item_flexible_schedules.item_id
    AND i.is_public = true
    AND EXISTS (
      SELECT 1 FROM public.household_links hl
      WHERE hl.active = true
        AND ((hl.owner_user_id = auth.uid() AND hl.partner_user_id = i.user_id)
         OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = i.user_id))
    )
  )
);

COMMENT ON TABLE public.item_flexible_schedules IS 'Tracks when users schedule flexible recurring tasks for specific periods';
COMMENT ON COLUMN public.item_flexible_schedules.period_start_date IS 'Start date of the period (e.g., start of week for weekly tasks)';
COMMENT ON COLUMN public.item_flexible_schedules.scheduled_for_date IS 'The date the user chose to do this task';
COMMENT ON COLUMN public.item_flexible_schedules.scheduled_for_time IS 'Optional specific time for the task (NULL = anytime)';

-- ============================================
-- EXTEND CATALOGUE_ITEMS FOR FLEXIBLE ROUTINES
-- ============================================

ALTER TABLE public.catalogue_items
ADD COLUMN IF NOT EXISTS is_flexible_routine BOOLEAN DEFAULT FALSE;

ALTER TABLE public.catalogue_items
ADD COLUMN IF NOT EXISTS flexible_period TEXT CHECK (flexible_period IN ('weekly', 'biweekly', 'monthly'));

CREATE INDEX IF NOT EXISTS idx_catalogue_items_flexible_routine
ON public.catalogue_items(is_flexible_routine)
WHERE is_flexible_routine = TRUE;

COMMENT ON COLUMN public.catalogue_items.is_flexible_routine IS 'If true, this is a flexible routine with no fixed schedule day';
COMMENT ON COLUMN public.catalogue_items.flexible_period IS 'For flexible routines: weekly, biweekly, or monthly period';

-- ============================================
-- ITEM COMPLETION PATTERNS VIEW
-- ============================================
-- Analyzes completion patterns to enable AI suggestions

CREATE OR REPLACE VIEW public.item_completion_patterns AS
WITH completion_data AS (
  SELECT 
    a.item_id,
    a.occurrence_date,
    a.created_at as completed_at,
    EXTRACT(DOW FROM a.created_at) as day_of_week, -- 0=Sunday, 6=Saturday
    EXTRACT(HOUR FROM a.created_at) as hour_of_day,
    i.user_id,
    i.title
  FROM public.item_occurrence_actions a
  JOIN public.items i ON i.id = a.item_id
  WHERE a.action_type = 'completed'
),
day_counts AS (
  SELECT 
    item_id,
    day_of_week,
    COUNT(*) as count
  FROM completion_data
  GROUP BY item_id, day_of_week
),
hour_counts AS (
  SELECT 
    item_id,
    hour_of_day,
    COUNT(*) as count
  FROM completion_data
  GROUP BY item_id, hour_of_day
),
day_aggregated AS (
  SELECT 
    item_id,
    jsonb_object_agg(day_of_week::text, count) as day_of_week_histogram
  FROM day_counts
  GROUP BY item_id
),
hour_aggregated AS (
  SELECT 
    item_id,
    jsonb_object_agg(hour_of_day::text, count) as hour_of_day_histogram
  FROM hour_counts
  GROUP BY item_id
)
SELECT 
  cd.item_id,
  cd.user_id,
  cd.title,
  COUNT(*) as total_completions,
  MAX(cd.completed_at) as last_completed_at,
  MIN(cd.completed_at) as first_completed_at,
  
  -- Most common day of week (mode)
  (SELECT day_of_week FROM day_counts dc 
   WHERE dc.item_id = cd.item_id 
   ORDER BY count DESC LIMIT 1) as preferred_day_of_week,
  
  -- Most common hour (mode)  
  (SELECT hour_of_day FROM hour_counts hc 
   WHERE hc.item_id = cd.item_id 
   ORDER BY count DESC LIMIT 1) as preferred_hour_of_day,
  
  -- Full histograms for detailed analysis
  COALESCE(da.day_of_week_histogram, '{}'::jsonb) as day_of_week_histogram,
  COALESCE(ha.hour_of_day_histogram, '{}'::jsonb) as hour_of_day_histogram,
  
  -- Average days between completions
  CASE 
    WHEN COUNT(*) > 1 THEN
      EXTRACT(EPOCH FROM (MAX(cd.completed_at) - MIN(cd.completed_at))) / (COUNT(*) - 1) / 86400
    ELSE NULL
  END as avg_days_between_completions

FROM completion_data cd
LEFT JOIN day_aggregated da ON da.item_id = cd.item_id
LEFT JOIN hour_aggregated ha ON ha.item_id = cd.item_id
GROUP BY cd.item_id, cd.user_id, cd.title, da.day_of_week_histogram, ha.hour_of_day_histogram;

COMMENT ON VIEW public.item_completion_patterns IS 'Analyzes completion patterns for items to enable AI scheduling suggestions';

-- ============================================
-- HELPER FUNCTION: Get period boundaries
-- ============================================

CREATE OR REPLACE FUNCTION public.get_flexible_period_dates(
  p_date DATE,
  p_period TEXT
) RETURNS TABLE(period_start DATE, period_end DATE) AS $$
BEGIN
  CASE p_period
    WHEN 'weekly' THEN
      -- Week starts on Monday
      period_start := p_date - EXTRACT(ISODOW FROM p_date)::integer + 1;
      period_end := period_start + INTERVAL '6 days';
    WHEN 'biweekly' THEN
      -- Bi-week starts on Monday of the ISO week, aligned to even week numbers
      period_start := p_date - EXTRACT(ISODOW FROM p_date)::integer + 1;
      -- If it's an odd week, go back one more week
      IF MOD(EXTRACT(WEEK FROM period_start)::integer, 2) = 1 THEN
        period_start := period_start - INTERVAL '7 days';
      END IF;
      period_end := period_start + INTERVAL '13 days';
    WHEN 'monthly' THEN
      period_start := DATE_TRUNC('month', p_date)::date;
      period_end := (DATE_TRUNC('month', p_date) + INTERVAL '1 month' - INTERVAL '1 day')::date;
    ELSE
      -- Default to weekly
      period_start := p_date - EXTRACT(ISODOW FROM p_date)::integer + 1;
      period_end := period_start + INTERVAL '6 days';
  END CASE;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.get_flexible_period_dates IS 'Calculate period start and end dates for flexible routines';

-- ============================================
-- HELPER FUNCTION: Check if flexible task is scheduled for current period
-- ============================================

CREATE OR REPLACE FUNCTION public.is_flexible_task_scheduled(
  p_item_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS BOOLEAN AS $$
DECLARE
  v_period TEXT;
  v_period_start DATE;
  v_period_end DATE;
  v_scheduled BOOLEAN;
BEGIN
  -- Get the flexible period for this item
  SELECT irr.flexible_period INTO v_period
  FROM public.item_recurrence_rules irr
  WHERE irr.item_id = p_item_id AND irr.is_flexible = TRUE;
  
  IF v_period IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get period boundaries
  SELECT period_start, period_end INTO v_period_start, v_period_end
  FROM public.get_flexible_period_dates(p_date, v_period);
  
  -- Check if there's a schedule for this period
  SELECT EXISTS(
    SELECT 1 FROM public.item_flexible_schedules ifs
    WHERE ifs.item_id = p_item_id
    AND ifs.period_start_date = v_period_start
  ) INTO v_scheduled;
  
  RETURN v_scheduled;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.is_flexible_task_scheduled IS 'Check if a flexible task has been scheduled for the current period';
