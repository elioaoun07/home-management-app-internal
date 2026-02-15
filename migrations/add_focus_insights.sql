-- migrations/add_focus_insights.sql
-- Cache for AI-generated focus insights to minimize API calls
-- One insight per user per day/week - smart caching strategy

CREATE TABLE IF NOT EXISTS focus_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Cache management
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  items_snapshot_hash TEXT, -- Hash of items at generation time to detect major changes
  item_count_at_generation INT DEFAULT 0, -- Number of items when insight was generated
  
  -- AI-generated content
  greeting TEXT NOT NULL,
  summary TEXT NOT NULL, -- Brief overview of the day/week
  focus_tip TEXT, -- AI suggestion for productivity
  priority_insights JSONB DEFAULT '[]'::jsonb, -- Which items AI thinks are most important and why
  pattern_observations TEXT, -- Any patterns AI noticed (e.g., "You tend to have many tasks on Mondays")
  encouragement TEXT, -- Motivational message based on completion rate
  
  -- Metadata for smart refreshing
  week_start DATE NOT NULL DEFAULT DATE_TRUNC('week', CURRENT_DATE)::date,
  completed_count_at_generation INT DEFAULT 0,
  overdue_count_at_generation INT DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_user_week_insight UNIQUE (user_id, week_start)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_focus_insights_user_expires 
ON focus_insights(user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_focus_insights_user_week 
ON focus_insights(user_id, week_start);

-- Enable RLS
ALTER TABLE focus_insights ENABLE ROW LEVEL SECURITY;

-- Users can only access their own insights
CREATE POLICY "Users can view own focus insights"
ON focus_insights FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own focus insights"
ON focus_insights FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own focus insights"
ON focus_insights FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own focus insights"
ON focus_insights FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_focus_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_focus_insights_updated_at
BEFORE UPDATE ON focus_insights
FOR EACH ROW
EXECUTE FUNCTION update_focus_insights_updated_at();

-- Add comment
COMMENT ON TABLE focus_insights IS 'Cached AI-generated insights for the Focus page. One per user per week, refreshed daily if expired.';
