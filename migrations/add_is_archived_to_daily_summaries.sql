-- ============================================================
-- Migration: Simplify balance history to use is_archived flag
-- ============================================================

-- Step 1: Add is_archived column to account_daily_summaries
ALTER TABLE account_daily_summaries 
ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ads_is_archived 
ON account_daily_summaries(account_id, is_archived, summary_date DESC);

-- Step 2: Archive all days before current month
UPDATE account_daily_summaries
SET is_archived = true
WHERE summary_date < DATE_TRUNC('month', CURRENT_DATE);

-- Step 3: Verify
SELECT 
  CASE WHEN is_archived THEN 'Archived' ELSE 'Current Month' END as status,
  COUNT(*) as count,
  MIN(summary_date) as earliest,
  MAX(summary_date) as latest
FROM account_daily_summaries
GROUP BY is_archived
ORDER BY is_archived;
